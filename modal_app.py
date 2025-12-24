"""
Modal Audio Analysis Service for Music Commentary
Uses yt-dlp with cookies to download YouTube audio and librosa for analysis
"""

import modal
import json
import tempfile
import os
from pathlib import Path

# Create Modal app
app = modal.App("music-analysis")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")  # Required for audio processing
    .pip_install(
        "fastapi[standard]",  # Required for web endpoints
        "yt-dlp",  # YouTube download with cookie support
        "librosa",  # Audio analysis
        "numpy",  # Librosa dependency
        "scipy",  # Librosa dependency
        "soundfile",  # Audio file I/O
        "audioread",  # Audio loading
        "numba",  # Librosa performance
    )
)


def write_cookies_to_netscape_file(cookies_dict: dict, filepath: str):
    """
    Write cookies dictionary to Netscape format file for yt-dlp.

    Format: domain, flag, path, secure, expiration, name, value
    Example: .youtube.com	TRUE	/	TRUE	0	VISITOR_INFO1_LIVE	value
    """
    with open(filepath, 'w') as f:
        # Write header
        f.write("# Netscape HTTP Cookie File\n")
        f.write("# This is a generated file! Do not edit.\n\n")

        # Write cookies
        for name, value in cookies_dict.items():
            # Format: domain, flag, path, secure, expiration, name, value
            line = f".youtube.com\tTRUE\t/\tTRUE\t0\t{name}\t{value}\n"
            f.write(line)

    print(f"Wrote {len(cookies_dict)} cookies to {filepath}")


def estimate_key_from_chroma(chroma):
    """
    Estimate musical key from chroma features.
    Returns format like "C major" or "A minor"
    """
    import numpy as np

    # Average chroma across time
    chroma_mean = np.mean(chroma, axis=1)

    # Find the dominant pitch class
    dominant_pitch = np.argmax(chroma_mean)

    # Pitch class names
    pitch_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # Simple heuristic: check if it's major or minor
    # Major tends to have strong 1st, 3rd (major), and 5th
    # Minor tends to have strong 1st, 3rd (minor), and 5th
    major_third = (dominant_pitch + 4) % 12
    minor_third = (dominant_pitch + 3) % 12

    major_strength = chroma_mean[major_third]
    minor_strength = chroma_mean[minor_third]

    mode = "major" if major_strength > minor_strength else "minor"

    return f"{pitch_names[dominant_pitch]} {mode}"


@app.function(
    image=image,
    timeout=300,  # 5 minute timeout
    memory=2048,  # 2GB RAM
)
def analyze_youtube_audio(youtube_url: str, cookies: dict) -> dict:
    """
    Download YouTube audio using cookies and analyze with librosa.

    Args:
        youtube_url: Full YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)
        cookies: Dictionary of cookie names to values

    Returns:
        Dictionary with analysis results including duration, tempo, key, beats, sections
    """
    import librosa
    import numpy as np

    print(f"Starting analysis for: {youtube_url}")
    print(f"Received {len(cookies)} cookies")

    # Create temporary directory for work
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Write cookies to file
        cookie_file = temp_path / "cookies.txt"
        write_cookies_to_netscape_file(cookies, str(cookie_file))

        # Download audio using yt-dlp
        audio_file = temp_path / "audio.%(ext)s"

        print("Downloading audio with yt-dlp...")
        import subprocess

        yt_dlp_cmd = [
            "yt-dlp",
            "--cookies", str(cookie_file),
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",  # Best quality
            "--output", str(audio_file),
            "--no-playlist",
            "--quiet",
            "--no-warnings",
            youtube_url
        ]

        result = subprocess.run(yt_dlp_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "Unknown error"
            print(f"yt-dlp error: {error_msg}")
            raise Exception(f"Failed to download audio: {error_msg}")

        # Find the downloaded audio file
        audio_files = list(temp_path.glob("audio.*"))
        if not audio_files:
            raise Exception("Audio file not found after download")

        downloaded_audio = audio_files[0]
        print(f"Downloaded audio to: {downloaded_audio}")

        # Load audio with librosa
        print("Loading audio with librosa...")
        y, sr = librosa.load(str(downloaded_audio), sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)
        print(f"Audio loaded: {duration:.2f} seconds at {sr} Hz")

        # For very long videos (>10 min), warn and limit analysis
        if duration > 600:
            print(f"Warning: Long video ({duration:.0f}s). Analyzing first 10 minutes only.")
            max_samples = int(600 * sr)
            y = y[:max_samples]
            duration = 600.0

        # Analyze beats and tempo
        print("Detecting beats and tempo...")
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        # Get tempo as a single value (might be array)
        if isinstance(tempo, np.ndarray):
            tempo = float(tempo[0])
        else:
            tempo = float(tempo)

        print(f"Detected tempo: {tempo:.1f} BPM, {len(beat_times)} beats")

        # Compute chroma features for key estimation
        print("Computing chroma features...")
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        estimated_key = estimate_key_from_chroma(chroma)
        print(f"Estimated key: {estimated_key}")

        # Segment the song into sections using MFCC features
        print("Detecting musical sections...")
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # Use agglomerative clustering to find section boundaries
        # Limit to reasonable number of sections (4-8 typically)
        n_sections = min(6, max(4, int(duration / 30)))  # ~30 seconds per section as estimate

        try:
            from scipy.cluster.hierarchy import fcluster, linkage
            from scipy.spatial.distance import pdist

            # Compute self-similarity matrix
            mfcc_normalized = (mfcc - np.mean(mfcc, axis=1, keepdims=True)) / (np.std(mfcc, axis=1, keepdims=True) + 1e-8)

            # Use beat-synchronous features for better segmentation
            beat_mfcc = librosa.util.sync(mfcc_normalized, beat_frames)

            # Compute distances between beat frames
            distances = pdist(beat_mfcc.T, metric='euclidean')
            linkage_matrix = linkage(distances, method='average')

            # Cut the dendrogram to get segments
            segments = fcluster(linkage_matrix, n_sections, criterion='maxclust')

            # Convert segment labels to section boundaries
            section_boundaries = [0.0]  # Start
            for i in range(1, len(segments)):
                if segments[i] != segments[i-1]:
                    boundary_time = beat_times[i] if i < len(beat_times) else duration
                    section_boundaries.append(float(boundary_time))
            section_boundaries.append(float(duration))  # End

            # Remove duplicates and sort
            section_boundaries = sorted(list(set(section_boundaries)))

        except Exception as e:
            print(f"Section detection failed, using simple time-based sections: {e}")
            # Fallback: simple time-based sections
            section_length = duration / n_sections
            section_boundaries = [float(i * section_length) for i in range(n_sections + 1)]

        # Create section objects with types
        section_types = ["intro", "verse", "chorus", "verse", "bridge", "chorus", "outro"]
        sections = []

        for i in range(len(section_boundaries) - 1):
            section_type = section_types[i % len(section_types)]
            sections.append({
                "start": round(section_boundaries[i], 2),
                "end": round(section_boundaries[i + 1], 2),
                "type": section_type
            })

        print(f"Detected {len(sections)} sections")

        # Build result
        result = {
            "duration": round(duration, 2),
            "tempo": round(tempo, 1),
            "key": estimated_key,
            "beats": [round(float(t), 2) for t in beat_times.tolist()],
            "sections": sections
        }

        print("Analysis complete!")
        return result


@app.function(image=image)
@modal.web_endpoint(method="POST")
def analyze_endpoint(data: dict) -> dict:
    """
    Web endpoint for audio analysis.

    Expected JSON body:
    {
        "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
        "cookies": {"cookie_name": "cookie_value", ...}
    }

    Returns:
    {
        "success": true,
        "analysis": { ... }
    }
    """
    try:
        youtube_url = data.get("youtube_url")
        cookies = data.get("cookies")

        if not youtube_url:
            return {
                "success": False,
                "error": "Missing youtube_url parameter"
            }

        if not cookies:
            return {
                "success": False,
                "error": "Missing cookies parameter"
            }

        # Call the analysis function
        analysis = analyze_youtube_audio.remote(youtube_url, cookies)

        return {
            "success": True,
            "analysis": analysis
        }

    except Exception as e:
        print(f"Error in endpoint: {e}")
        import traceback
        traceback.print_exc()

        return {
            "success": False,
            "error": str(e)
        }


# For local testing
@app.local_entrypoint()
def main():
    """Test the analysis locally"""
    print("Testing Modal audio analysis...")

    # Test with a sample video (requires cookies)
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    test_cookies = {
        "VISITOR_INFO1_LIVE": "test_value",
        # Add real cookies for testing
    }

    result = analyze_youtube_audio.remote(test_url, test_cookies)
    print(json.dumps(result, indent=2))

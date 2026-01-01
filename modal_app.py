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
    Estimate musical key using Krumhansl-Schmuckler key-finding algorithm.
    Returns format like "C major" or "A minor"
    """
    import numpy as np

    # Krumhansl-Schmuckler key profiles
    # Major and minor key profiles based on empirical studies
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    # Average chroma across entire piece
    chroma_mean = np.mean(chroma, axis=1)

    # Normalize
    chroma_mean = chroma_mean / (np.sum(chroma_mean) + 1e-8)

    # Test all 24 keys (12 major + 12 minor)
    key_names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

    best_correlation = -1
    best_key = 'C major'

    # Try major keys
    for i in range(12):
        # Rotate profile to match key
        rotated_profile = np.roll(major_profile, i)
        # Normalize profile
        rotated_profile = rotated_profile / np.sum(rotated_profile)
        # Calculate correlation
        correlation = np.corrcoef(chroma_mean, rotated_profile)[0, 1]

        if correlation > best_correlation:
            best_correlation = correlation
            best_key = f"{key_names[i]} major"

    # Try minor keys
    for i in range(12):
        rotated_profile = np.roll(minor_profile, i)
        rotated_profile = rotated_profile / np.sum(rotated_profile)
        correlation = np.corrcoef(chroma_mean, rotated_profile)[0, 1]

        if correlation > best_correlation:
            best_correlation = correlation
            best_key = f"{key_names[i]} minor"

    return best_key


def detect_chord_progressions_by_section(y, sr, sections):
    """
    Detect chord progressions for each section using Roman numeral analysis.
    Returns chord progressions per section instead of individual chord timings.
    """
    import librosa
    import numpy as np

    # Chord templates using Roman numeral analysis (relative to key)
    chord_templates = {
        'I': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],     # Major tonic
        'ii': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],    # Minor 2nd
        'iii': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],   # Minor 3rd
        'IV': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],    # Major 4th
        'V': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],     # Major 5th
        'vi': [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],    # Minor 6th
        'viio': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],  # Diminished 7th
    }

    section_progressions = []

    for section in sections:
        # Get audio segment for this section
        start_sample = int(section['start'] * sr)
        end_sample = int(section['end'] * sr)

        if end_sample > len(y):
            end_sample = len(y)

        if start_sample >= end_sample:
            section_progressions.append({
                'section': section.get('type', 'Section'),
                'progression': 'N/A'
            })
            continue

        y_section = y[start_sample:end_sample]

        # Compute chroma for this section
        chroma = librosa.feature.chroma_cqt(y=y_section, sr=sr)

        if chroma.shape[1] < 4:
            section_progressions.append({
                'section': section.get('type', 'Section'),
                'progression': 'N/A'
            })
            continue

        # Divide section into 4-8 chord regions
        section_duration = section['end'] - section['start']
        num_chords = max(4, min(8, int(section_duration / 4)))
        frames_per_chord = max(1, chroma.shape[1] // num_chords)

        progression = []

        for i in range(num_chords):
            start_frame = i * frames_per_chord
            end_frame = min((i + 1) * frames_per_chord, chroma.shape[1])

            if start_frame >= end_frame:
                break

            # Average chroma for this chord region
            chord_chroma = np.mean(chroma[:, start_frame:end_frame], axis=1)

            # Normalize
            chord_chroma = chord_chroma / (np.sum(chord_chroma) + 1e-8)

            # Find best matching chord
            best_chord = 'I'
            best_score = -1

            for chord_name, template in chord_templates.items():
                template_normalized = np.array(template) / (np.sum(template) + 1e-8)
                score = np.dot(chord_chroma, template_normalized)
                if score > best_score:
                    best_score = score
                    best_chord = chord_name

            # Only add if different from previous chord
            if not progression or progression[-1] != best_chord:
                progression.append(best_chord)

        # Format as string (limit to reasonable length)
        if len(progression) > 0:
            progression_str = ' - '.join(progression[:8])  # Max 8 chords shown
        else:
            progression_str = 'N/A'

        section_progressions.append({
            'section': section.get('type', 'Section'),
            'progression': progression_str
        })

    return section_progressions


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
            # Anti-bot detection flags
            "--extractor-args", "youtube:player_client=android",
            "--user-agent", "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36",
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
        # CRITICAL FIX: Use larger hop length and enforce minimum section length
        print("Detecting musical sections...")

        # Use larger hop length for broader sections (fewer, more significant boundaries)
        hop_length = 4096  # Larger hop = fewer, bigger sections

        # Compute MFCC features at lower resolution
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)

        # For a 3-minute song, aim for 6-8 sections (~30 seconds per section)
        target_sections = max(6, min(8, int(duration / 30)))

        try:
            # Use librosa's agglomerative segmentation
            boundaries_frames = librosa.segment.agglomerative(mfcc, k=target_sections)

            # Convert frames to time
            boundary_times = librosa.frames_to_time(
                boundaries_frames,
                sr=sr,
                hop_length=hop_length
            )

            # CRITICAL: Merge sections that are too short (< 8 seconds minimum)
            merged_boundaries = [float(boundary_times[0])]
            for i in range(1, len(boundary_times)):
                if boundary_times[i] - merged_boundaries[-1] >= 8.0:
                    merged_boundaries.append(float(boundary_times[i]))

            # Ensure we have the end boundary
            if merged_boundaries[-1] < duration - 1.0:
                merged_boundaries.append(float(duration))

            section_boundaries = merged_boundaries

            print(f"Initial boundaries: {len(boundary_times)}, after merging: {len(section_boundaries)}")

        except Exception as e:
            print(f"Section detection failed, using simple time-based sections: {e}")
            import traceback
            traceback.print_exc()

            # Fallback: simple time-based sections with minimum length
            section_length = max(15.0, duration / target_sections)  # At least 15 seconds per section
            num_sections = int(duration / section_length)
            section_boundaries = [float(i * section_length) for i in range(num_sections + 1)]
            if section_boundaries[-1] < duration:
                section_boundaries.append(float(duration))

        # Create section objects with intelligent type assignment
        section_types = ["intro", "verse", "chorus", "verse", "bridge", "chorus", "outro"]
        sections = []

        for i in range(len(section_boundaries) - 1):
            section_type = section_types[min(i, len(section_types) - 1)]
            sections.append({
                "start": round(section_boundaries[i], 2),
                "end": round(section_boundaries[i + 1], 2),
                "type": section_type
            })

        print(f"Detected {len(sections)} sections (target was {target_sections})")

        # Chord progression detection by section (not individual chords)
        print("Detecting chord progressions by section...")
        chord_progressions = detect_chord_progressions_by_section(y, sr, sections)
        print(f"Detected chord progressions for {len(chord_progressions)} sections")

        # Build result
        result = {
            "duration": round(duration, 2),
            "tempo": round(tempo, 1),
            "key": estimated_key,
            "beats": [round(float(t), 2) for t in beat_times.tolist()],
            "sections": sections,
            "chord_progressions": chord_progressions  # Not individual chords
        }

        print("Analysis complete!")
        return result


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
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

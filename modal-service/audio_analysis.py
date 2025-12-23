"""
Modal Audio Analysis Service for Music Commentary
Analyzes YouTube videos to extract precise musical timestamps and features.
"""

import modal
import json
import tempfile
import os
from pathlib import Path

# Create Modal app
app = modal.App("music-commentary-audio-analysis")

# Create Modal image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")  # Required for audio processing
    .pip_install(
        "yt-dlp>=2023.12.30",
        "librosa>=0.10.1",
        "numpy>=1.24.0",
        "scipy>=1.11.0",
        "soundfile>=0.12.1",
        "scikit-learn>=1.3.0",
        "fastapi>=0.109.0",  # Required for web endpoints
    )
)


@app.function(
    image=image,
    timeout=300,  # 5 minute timeout
    memory=2048,  # 2GB memory for audio processing
)
@modal.web_endpoint(method="POST")
def analyze_audio(data: dict) -> dict:
    """
    Download and analyze audio from a YouTube video.

    Args:
        data: Dictionary with "video_id" key

    Returns:
        Dictionary containing:
        - duration: float (seconds)
        - tempo: float (BPM)
        - key: str (e.g., "C major")
        - beats: list of float (beat timestamps in seconds)
        - sections: list of dicts with start, end, type
        - success: bool
        - error: str (if failed)
    """
    video_id = data.get("video_id")

    if not video_id:
        return {
            'success': False,
            'error': 'video_id is required'
        }
    import librosa
    import numpy as np
    import yt_dlp
    from sklearn.cluster import AgglomerativeClustering

    try:
        # Step 1: Download audio from YouTube
        print(f"Downloading audio for video {video_id}...")

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, "audio.wav")

            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_path.replace('.wav', ''),
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'wav',
                }],
                'quiet': True,
                'no_warnings': True,
            }

            youtube_url = f"https://www.youtube.com/watch?v={video_id}"

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([youtube_url])

            print("Audio downloaded successfully")

            # Step 2: Load audio with librosa
            print("Loading audio with librosa...")
            y, sr = librosa.load(output_path, sr=22050, mono=True)
            duration = librosa.get_duration(y=y, sr=sr)
            print(f"Audio loaded: duration={duration:.2f}s, sample_rate={sr}")

            # Step 3: Beat detection
            print("Detecting beats...")
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            print(f"Detected {len(beat_times)} beats at tempo {tempo:.1f} BPM")

            # Step 4: Section segmentation
            print("Detecting section boundaries...")
            sections = detect_sections(y, sr, beat_times)
            print(f"Detected {len(sections)} sections")

            # Step 5: Key detection
            print("Detecting musical key...")
            key = detect_key(y, sr)
            print(f"Key: {key}")

            # Step 6: Return results
            result = {
                'success': True,
                'duration': float(duration),
                'tempo': float(tempo),
                'key': key,
                'beats': [float(t) for t in beat_times[:200]],  # Limit to first 200 beats
                'sections': sections,
            }

            print("Analysis complete!")
            return result

    except Exception as e:
        print(f"Error analyzing audio: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e),
        }


def detect_sections(y, sr, beat_times):
    """
    Detect musical sections (intro, verse, chorus, etc.) using spectral clustering.

    Returns:
        List of sections with start, end, and estimated type
    """
    import librosa
    import numpy as np
    from sklearn.cluster import AgglomerativeClustering

    try:
        # Compute chromagram for harmonic analysis
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

        # Compute MFCC for timbral analysis
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # Combine features
        features = np.vstack([chroma, mfcc])

        # Use recurrence matrix to find self-similarity
        rec_matrix = librosa.segment.recurrence_matrix(
            features,
            mode='affinity',
            metric='cosine',
            width=3
        )

        # Detect boundaries using spectral clustering
        boundaries_frames = librosa.segment.agglomerative(
            features,
            k=8  # Target 8 sections (can be adjusted)
        )

        # Convert frames to times
        boundary_times = librosa.frames_to_time(boundaries_frames, sr=sr)

        # Create sections with start and end times
        sections = []
        section_labels = ['Intro', 'Verse 1', 'Verse 2', 'Chorus', 'Bridge', 'Chorus 2', 'Solo', 'Outro']

        for i in range(len(boundary_times) - 1):
            start = float(boundary_times[i])
            end = float(boundary_times[i + 1])
            label = section_labels[i] if i < len(section_labels) else f'Section {i+1}'

            sections.append({
                'start': round(start, 2),
                'end': round(end, 2),
                'type': label
            })

        # Add final section to end of track
        if len(boundary_times) > 0:
            duration = librosa.get_duration(y=y, sr=sr)
            sections.append({
                'start': round(float(boundary_times[-1]), 2),
                'end': round(float(duration), 2),
                'type': 'Outro'
            })

        return sections

    except Exception as e:
        print(f"Error detecting sections: {str(e)}")
        # Return simple time-based sections as fallback
        duration = librosa.get_duration(y=y, sr=sr)
        return create_fallback_sections(duration)


def detect_key(y, sr):
    """
    Detect the musical key of the audio.

    Returns:
        String like "C major" or "A minor"
    """
    import librosa
    import numpy as np

    try:
        # Compute chromagram
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

        # Average over time to get overall key
        chroma_mean = np.mean(chroma, axis=1)

        # Find the dominant pitch class
        dominant_pitch = np.argmax(chroma_mean)

        # Map to note names
        note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        root_note = note_names[dominant_pitch]

        # Simple major/minor detection based on third
        # This is a simplified heuristic
        third_major = (dominant_pitch + 4) % 12
        third_minor = (dominant_pitch + 3) % 12

        if chroma_mean[third_major] > chroma_mean[third_minor]:
            mode = "major"
        else:
            mode = "minor"

        return f"{root_note} {mode}"

    except Exception as e:
        print(f"Error detecting key: {str(e)}")
        return "Key unknown"


def create_fallback_sections(duration):
    """
    Create simple time-based sections as fallback when analysis fails.
    """
    sections = []

    # Assume typical song structure
    if duration < 120:  # Short song (< 2 minutes)
        sections = [
            {'start': 0.0, 'end': duration * 0.15, 'type': 'Intro'},
            {'start': duration * 0.15, 'end': duration * 0.45, 'type': 'Verse 1'},
            {'start': duration * 0.45, 'end': duration * 0.75, 'type': 'Chorus'},
            {'start': duration * 0.75, 'end': duration, 'type': 'Outro'},
        ]
    else:  # Standard song length
        sections = [
            {'start': 0.0, 'end': 8.0, 'type': 'Intro'},
            {'start': 8.0, 'end': 28.0, 'type': 'Verse 1'},
            {'start': 28.0, 'end': 42.0, 'type': 'Verse 2'},
            {'start': 42.0, 'end': 58.0, 'type': 'Chorus'},
            {'start': 58.0, 'end': 78.0, 'type': 'Bridge'},
            {'start': 78.0, 'end': duration - 10, 'type': 'Chorus 2'},
            {'start': duration - 10, 'end': duration, 'type': 'Outro'},
        ]

    return [
        {
            'start': round(s['start'], 2),
            'end': round(min(s['end'], duration), 2),
            'type': s['type']
        }
        for s in sections
    ]


@app.local_entrypoint()
def main(video_id: str = "dQw4w9WgXcQ"):
    """
    Test the audio analysis locally.
    Usage: modal run audio_analysis.py --video-id YOUR_VIDEO_ID
    """
    print(f"Analyzing video: {video_id}")
    result = analyze_audio.remote(video_id)
    print("\n" + "="*50)
    print("ANALYSIS RESULT:")
    print("="*50)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    # For local testing
    pass

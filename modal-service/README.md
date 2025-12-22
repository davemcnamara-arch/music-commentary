# Modal Audio Analysis Service

This service provides audio analysis for YouTube videos using librosa and Modal.

## Features

- Downloads audio from YouTube videos using yt-dlp
- Analyzes musical structure with librosa
- Detects:
  - Beat positions (exact timestamps)
  - Section boundaries (verse, chorus, bridge, etc.)
  - Tempo (BPM)
  - Musical key signature
  - Song duration

## Setup

### 1. Install Modal

```bash
pip install modal
```

### 2. Authenticate with Modal

```bash
modal token new
```

This will open a browser window to authenticate.

### 3. Deploy the Service

```bash
cd modal-service
modal deploy audio_analysis.py
```

This will deploy the function to Modal's cloud infrastructure.

### 4. Get the Function URL

After deployment, Modal will provide a function URL that looks like:
```
https://YOUR_ORG--music-commentary-audio-analysis-analyze-audio.modal.run
```

Save this URL - you'll need it for the Supabase Edge Function.

## Testing Locally

You can test the analysis locally before deploying:

```bash
# Test with a specific YouTube video ID
modal run audio_analysis.py --video-id dQw4w9WgXcQ
```

## Usage from Supabase Edge Function

Once deployed, you can call the Modal function from your Supabase Edge Function:

```typescript
const MODAL_AUDIO_ANALYSIS_URL = 'YOUR_MODAL_FUNCTION_URL';

const response = await fetch(MODAL_AUDIO_ANALYSIS_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    video_id: videoId
  })
});

const audioAnalysis = await response.json();

// audioAnalysis contains:
// {
//   success: true,
//   duration: 178.5,
//   tempo: 108,
//   key: "B major",
//   beats: [0.0, 0.55, 1.11, ...],
//   sections: [
//     {start: 0.0, end: 8.0, type: "Intro"},
//     {start: 8.0, end: 28.0, type: "Verse 1"},
//     ...
//   ]
// }
```

## Response Format

### Success Response

```json
{
  "success": true,
  "duration": 178.5,
  "tempo": 108.0,
  "key": "B major",
  "beats": [0.0, 0.55, 1.11, 1.67, 2.23, ...],
  "sections": [
    {"start": 0.0, "end": 8.0, "type": "Intro"},
    {"start": 8.0, "end": 28.0, "type": "Verse 1"},
    {"start": 28.0, "end": 42.0, "type": "Verse 2"},
    {"start": 42.0, "end": 58.0, "type": "Chorus"},
    {"start": 58.0, "end": 78.0, "type": "Bridge"},
    {"start": 78.0, "end": 168.0, "type": "Chorus 2"},
    {"start": 168.0, "end": 178.5, "type": "Outro"}
  ]
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

## Cost Optimization

Modal charges based on compute time and memory usage. This service:
- Uses 2GB of memory
- Has a 5-minute timeout
- Typically processes a 3-4 minute song in 20-30 seconds

To reduce costs:
1. Implement caching in your Supabase database (see main README)
2. Use Modal's free tier (generous limits)
3. Adjust memory/timeout settings based on your needs

## Troubleshooting

### "yt-dlp failed to download"
- The video may be private or unavailable
- Try with a different video ID
- Check Modal logs for details

### "Out of memory"
- Increase the memory limit in the `@app.function` decorator
- Or reduce the audio sample rate in `librosa.load()`

### "Timeout"
- Increase the timeout in the `@app.function` decorator
- Very long videos (>10 minutes) may need more time

## Development

To modify the analysis:

1. Edit `audio_analysis.py`
2. Test locally: `modal run audio_analysis.py --video-id YOUR_VIDEO_ID`
3. Deploy: `modal deploy audio_analysis.py`
4. The function URL stays the same after redeployment

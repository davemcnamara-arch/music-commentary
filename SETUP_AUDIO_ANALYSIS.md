# Audio Analysis Setup Guide

This guide walks you through setting up the complete audio analysis pipeline with exact timestamps and smart video pause/resume.

## Architecture Overview

```
Chrome Extension
    ↓
    1. Pauses YouTube video
    2. Shows progress UI
    ↓
Supabase Edge Function
    ↓
    3. Checks cache first
    ↓
Modal Audio Analysis (if not cached)
    ↓
    4. Downloads audio with yt-dlp
    5. Analyzes with librosa
    6. Returns exact timestamps
    ↓
Supabase Edge Function
    ↓
    7. Caches results
    8. Generates commentary with OpenAI
    ↓
Chrome Extension
    ↓
    9. Auto-resumes video
   10. Displays commentary
```

## Setup Steps

### 1. Database Setup (Supabase)

First, create the caching table in your Supabase database:

```bash
# Run the migration
cd supabase
supabase db push

# Or apply manually in Supabase SQL editor
# Copy the contents of: supabase/migrations/20250101_audio_analysis_cache.sql
```

This creates the `audio_analysis_cache` table which stores analysis results to avoid re-analyzing the same videos.

### 2. Modal Setup

Modal handles the audio analysis in a serverless Python environment.

#### Install Modal CLI

```bash
pip install modal
```

#### Authenticate with Modal

```bash
modal token new
```

This opens a browser for authentication. Sign up for a free account if you don't have one.

#### Deploy the Audio Analysis Service

```bash
cd modal-service
modal deploy audio_analysis.py
```

After deployment, Modal provides a function URL like:
```
https://YOUR_ORG--music-commentary-audio-analysis-analyze-audio.modal.run
```

**Save this URL** - you'll need it for the next step.

#### Test the Service (Optional)

```bash
# Test with a YouTube video ID
modal run audio_analysis.py --video-id dQw4w9WgXcQ
```

This downloads and analyzes the video, showing the detected sections, tempo, and key.

### 3. Supabase Edge Function Configuration

Add the Modal URL to your Supabase Edge Function secrets:

#### Via Supabase Dashboard

1. Go to your project dashboard
2. Navigate to **Edge Functions** → **Settings**
3. Add a new secret:
   - Name: `MODAL_AUDIO_ANALYSIS_URL`
   - Value: Your Modal function URL from step 2

#### Via CLI

```bash
supabase secrets set MODAL_AUDIO_ANALYSIS_URL=https://YOUR_ORG--music-commentary-audio-analysis-analyze-audio.modal.run
```

#### Verify Environment Variables

Make sure you have all required secrets:

```bash
supabase secrets list
```

Should show:
- `OPENAI_API_KEY` ✓
- `MODAL_AUDIO_ANALYSIS_URL` ✓
- `SUPABASE_URL` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓

### 4. Deploy Updated Edge Function

```bash
cd supabase/functions
supabase functions deploy analyze-video
```

### 5. Extension Configuration

No changes needed! The extension automatically uses the new progress UI and video pause/resume features.

Just make sure `config.js` has your Supabase function URL:

```javascript
const CONFIG = {
  SUPABASE_FUNCTION_URL: 'https://YOUR_PROJECT.supabase.co/functions/v1/analyze-video',
  // ...
};
```

### 6. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. Navigate to a YouTube video
6. Click the extension icon and try it out!

## How It Works

### First Analysis (No Cache)

1. User clicks "Analyze Video"
2. **Extension pauses the video immediately**
3. Progress UI shows three stages:
   - ⏳ Downloading audio...
   - ⏳ Analyzing musical structure...
   - ⏳ Generating commentary...
4. Edge function checks cache (miss)
5. Edge function calls Modal service
6. Modal downloads audio with yt-dlp (~5s)
7. Modal analyzes with librosa (~10-15s)
8. Modal returns exact timestamps
9. Edge function caches the results
10. Edge function generates commentary with OpenAI (~5s)
11. **Extension auto-resumes video**
12. Commentary displays with exact section timestamps

**Total time: ~20-30 seconds**

### Subsequent Analysis (Cached)

1. User clicks "Analyze Video"
2. **Extension pauses the video**
3. Edge function checks cache (hit!)
4. Edge function uses cached timestamps
5. Edge function generates commentary with OpenAI
6. **Extension auto-resumes video**
7. Commentary displays

**Total time: ~5 seconds** (just OpenAI API call)

### Manual Resume

At any time during analysis, the user can click:

**"▶️ Resume Playing (analysis will continue)"**

This immediately resumes the video while analysis continues in the background.

## Response Format

The edge function now returns additional metadata:

```json
{
  "success": true,
  "videoId": "dQw4w9WgXcQ",
  "level": "intermediate",
  "commentary": "## [0:00] Intro\nThe song opens...",
  "audioAnalysis": {
    "tempo": 108.0,
    "key": "B major",
    "duration": 178.5
  },
  "generatedAt": "2025-01-01T12:00:00Z"
}
```

The commentary uses **exact timestamps** from the audio analysis:

```markdown
## [0:00] Intro
The song opens with...

## [8:32] Verse 1
The verse introduces...

## [28:14] Chorus
The chorus features...
```

These timestamps sync perfectly with the video's actual musical structure!

## Monitoring

### Check Modal Logs

```bash
modal app logs music-commentary-audio-analysis
```

Shows audio analysis execution logs.

### Check Supabase Logs

In Supabase dashboard:
- Navigate to **Logs** → **Edge Functions**
- Filter by function: `analyze-video`
- Look for cache hits/misses and Modal calls

### Check Cache Usage

```sql
-- See all cached analyses
SELECT video_id, video_title, tempo, key, analyzed_at
FROM audio_analysis_cache
ORDER BY analyzed_at DESC;

-- Count cached videos
SELECT COUNT(*) FROM audio_analysis_cache;

-- See cache size
SELECT pg_size_pretty(pg_total_relation_size('audio_analysis_cache'));
```

## Cost Optimization

### Modal Costs

Modal free tier includes:
- 30 free credits/month
- Each analysis uses ~0.1-0.2 credits
- **~150-300 free analyses per month**

After free tier: ~$0.001 per analysis

### Cache Benefits

With caching:
- **First analysis**: Modal + OpenAI costs
- **Repeated analyses**: Only OpenAI cost
- **Savings**: 50-70% for frequently analyzed videos

### Cleanup Old Cache

Run periodically to save database storage:

```sql
SELECT cleanup_old_cache_entries();
```

This removes entries older than 30 days.

## Troubleshooting

### "Modal audio analysis failed, using fallback"

The system gracefully falls back to estimated timestamps. Check:

1. Modal service is deployed: `modal app list`
2. Modal URL is correct in Supabase secrets
3. Modal logs for errors: `modal app logs music-commentary-audio-analysis`

### "Video keeps playing during analysis"

Check browser console for errors. The extension needs permission to execute scripts on YouTube pages.

Fix:
1. Reload the extension
2. Refresh the YouTube page
3. Try again

### "Analysis times out"

For very long videos (>10 min):

1. Increase Modal timeout in `audio_analysis.py`:
   ```python
   @app.function(
       timeout=600,  # 10 minutes instead of 5
       ...
   )
   ```

2. Increase Supabase timeout in `config.js`:
   ```javascript
   API_TIMEOUT: 120000, // 2 minutes instead of 1
   ```

### Cache Not Working

Check database connection:

```sql
-- Test cache table exists
SELECT * FROM audio_analysis_cache LIMIT 1;
```

Verify Supabase environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Advanced Configuration

### Adjust Analysis Sections

Edit `audio_analysis.py`, line ~170:

```python
boundaries_frames = librosa.segment.agglomerative(
    features,
    k=8  # Change this number to get more/fewer sections
)
```

- Smaller number (4-6): Fewer, broader sections
- Larger number (10-12): More granular sections

### Adjust Audio Quality

Edit `audio_analysis.py`, line ~90:

```python
y, sr = librosa.load(output_path, sr=22050, mono=True)
#                                  ^^^^^ Sample rate
```

- Lower (11025): Faster, less accurate
- Higher (44100): Slower, more accurate

## Next Steps

Once everything is working:

1. ✅ Test with various music genres
2. ✅ Monitor cache hit rate
3. ✅ Adjust section detection parameters
4. ✅ Share with users!

## Support

- Modal issues: https://modal.com/docs
- Supabase issues: https://supabase.com/docs
- Extension issues: Check browser console

# Cookie-Based Audio Analysis - Deployment Guide

This guide walks you through deploying the complete cookie-based audio analysis system for exact timestamp generation.

## Architecture Overview

```
Chrome Extension → YouTube Cookies → Supabase Edge Function → Modal (Python) → Librosa Analysis
                                            ↓                         ↓
                                       Cache Check              yt-dlp + cookies
                                            ↓                         ↓
                                       OpenAI GPT              No bot detection!
                                            ↓
                                   Timestamped Commentary
```

## Prerequisites

1. **Modal Account** (for audio analysis)
   - Sign up at https://modal.com
   - Free tier: 30 GPU hours/month (enough for testing)
   - Install Modal CLI: `pip install modal`

2. **Supabase Project** (already set up)
   - Project URL
   - Service role key
   - OpenAI API key

3. **Chrome Browser** (for extension)
   - Developer mode enabled
   - Logged into YouTube

## Step 1: Deploy Modal Audio Analysis Service

### 1.1 Install Modal CLI

```bash
pip install modal
```

### 1.2 Authenticate with Modal

```bash
modal token new
```

This will open a browser window to authenticate.

### 1.3 Deploy the Modal App

From the project root:

```bash
cd /home/user/music-commentary
modal deploy modal_app.py
```

**Expected output:**
```
✓ Created objects.
├── 🔨 Created function analyze_youtube_audio.
└── 🔨 Created web function analyze_endpoint => https://YOUR-MODAL-USERNAME--music-analysis-analyze-endpoint.modal.run
```

**IMPORTANT:** Copy the endpoint URL that ends with `.modal.run` - you'll need this for Supabase!

### 1.4 Test the Modal Endpoint (Optional)

You can test locally:

```bash
modal run modal_app.py
```

## Step 2: Run Database Migration

### 2.1 Apply the Migration

The migration file already exists at `supabase/migrations/20250101_audio_analysis_cache.sql`.

Apply it using the Supabase CLI:

```bash
cd /home/user/music-commentary
supabase db push
```

Or run it directly in the Supabase SQL Editor:
1. Go to https://app.supabase.com
2. Select your project
3. Go to SQL Editor
4. Paste the contents of `supabase/migrations/20250101_audio_analysis_cache.sql`
5. Run the query

### 2.2 Verify the Table

Check that the table was created:

```sql
SELECT * FROM audio_analysis_cache LIMIT 1;
```

You should see the table structure (it will be empty initially).

## Step 3: Update Supabase Environment Variables

### 3.1 Add Modal Endpoint to Supabase

1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings** → **Edge Functions**
4. Add environment variable:
   - Name: `MODAL_ENDPOINT`
   - Value: Your Modal endpoint URL from Step 1.3 (e.g., `https://YOUR-USERNAME--music-analysis-analyze-endpoint.modal.run`)

### 3.2 Verify Other Variables

Make sure these are also set:
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## Step 4: Deploy Supabase Edge Function

### 4.1 Deploy the Updated Function

```bash
cd /home/user/music-commentary
supabase functions deploy analyze-video
```

### 4.2 Verify Deployment

Test the function:

```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/analyze-video \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "test",
    "videoTitle": "Test Video",
    "channelName": "Test Channel",
    "level": "intermediate",
    "cookies": {"test": "value"}
  }'
```

You should get an error about Modal (expected without real cookies), but it confirms the endpoint is working.

## Step 5: Load the Chrome Extension

### 5.1 Open Chrome Extensions

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)

### 5.2 Load Unpacked Extension

1. Click **Load unpacked**
2. Navigate to `/home/user/music-commentary/chrome-extension`
3. Select the folder

The extension should now appear in your extensions list.

### 5.3 Verify Permissions

Check that the extension has:
- ✅ Can read and change data on youtube.com
- ✅ Can access cookies

## Step 6: Configure Extension

### 6.1 Update config.js

Edit `chrome-extension/config.js`:

```javascript
const CONFIG = {
  SUPABASE_FUNCTION_URL: 'https://YOUR-PROJECT.supabase.co/functions/v1/analyze-video',
  API_TIMEOUT: 120000, // 2 minutes (increased for audio analysis)
};
```

Replace `YOUR-PROJECT` with your actual Supabase project ID.

### 6.2 Reload Extension

1. Go back to `chrome://extensions/`
2. Click the **reload** icon on your extension
3. The changes are now live

## Step 7: Test End-to-End

### 7.1 Open a YouTube Video

1. Go to https://www.youtube.com/watch?v=dQw4w9WgXcQ (or any music video)
2. Make sure you're logged into YouTube
3. Click the extension icon to open the side panel

### 7.2 Analyze the Video

1. Select a level (Novice, Intermediate, or Advanced)
2. Click **Analyze Video**
3. Watch the progress stages:
   - ⏳ Downloading audio... (~5-10 seconds)
   - ⏳ Analyzing structure... (~10-15 seconds)
   - ⏳ Generating commentary... (~3-5 seconds)

### 7.3 Verify Results

You should see:
- Commentary with **exact timestamps** (e.g., `## [0:15] Verse`)
- Tempo and key information from librosa
- Clickable timestamps that jump to that point in the video
- Total time: ~20-30 seconds

### 7.4 Test Caching

1. Click **Analyze Video** again on the same video
2. It should be **instant** (< 1 second)
3. This confirms caching is working!

## Troubleshooting

### Modal Endpoint Not Working

**Error:** "Failed to analyze audio"

**Solutions:**
1. Check Modal deployment: `modal app list`
2. Verify endpoint URL in Supabase env vars
3. Check Modal logs: `modal logs music-analysis`

### Cookie Access Issues

**Error:** "Failed to get YouTube cookies"

**Solutions:**
1. Make sure you're logged into YouTube
2. Verify extension has cookies permission in manifest.json
3. Reload the extension
4. Check browser console for errors

### yt-dlp Download Fails

**Error:** "Audio download failed"

**Possible causes:**
1. Video is private or deleted
2. Cookies are invalid (try logging out and back into YouTube)
3. Age-restricted video (need to be logged in)
4. Geographic restrictions

**Solutions:**
1. Try a different video
2. Log out and back into YouTube to refresh cookies
3. Check Modal logs for detailed error

### Database Cache Not Working

**Error:** Analysis takes long time even on repeat

**Solutions:**
1. Check if table exists: `SELECT * FROM audio_analysis_cache;`
2. Verify migration was applied
3. Check Supabase logs for insert errors
4. Verify SUPABASE_SERVICE_ROLE_KEY is set

### Supabase Function Timeout

**Error:** "Request timed out"

**Solutions:**
1. Increase timeout in config.js to 180000 (3 minutes)
2. Try a shorter video (< 5 minutes)
3. Check Modal performance in logs

## Performance & Cost

### First Analysis (No Cache)
- Time: ~20-30 seconds
- Modal cost: ~$0.03-0.05 per video
- OpenAI cost: ~$0.001-0.002 per request
- Total: ~$0.03-0.05

### Cached Analysis
- Time: < 1 second (instant!)
- Modal cost: $0 (cache hit)
- OpenAI cost: ~$0.001-0.002 per request
- Total: ~$0.001-0.002

### Free Tier Limits
- Modal: 30 GPU hours/month = ~300-600 analyses
- OpenAI: Pay per use (very cheap with GPT-4o-mini)
- Supabase: 500MB database free tier (thousands of cached analyses)

## Privacy & Security

### Cookies
- ✅ Only sent to Modal for this one request
- ✅ Never stored in Supabase database
- ✅ Cleared from extension memory after use
- ✅ Only used to bypass bot detection
- ✅ Transmitted over HTTPS only

### Audio Files
- ✅ Downloaded to temporary Modal container
- ✅ Deleted immediately after analysis
- ✅ Never stored permanently
- ✅ Not accessible after function completes

### User Data
- ✅ Only video ID and metadata cached
- ✅ No personal information stored
- ✅ No tracking or analytics
- ✅ All data in your own Supabase project

## Next Steps

### Enhancements
1. Add more sophisticated section labeling (use ML to detect verse/chorus)
2. Support for longer videos (currently optimized for 3-6 minute songs)
3. Add harmonic analysis for deeper music theory insights
4. Support for non-music videos (speech, podcasts, etc.)

### Production Considerations
1. Set up proper error monitoring (Sentry, etc.)
2. Add rate limiting to prevent abuse
3. Implement user authentication if needed
4. Consider batch processing for multiple videos
5. Add retry logic for transient failures

## Support

If you encounter issues:

1. **Check Modal logs:** `modal logs music-analysis`
2. **Check Supabase logs:** In Supabase dashboard → Logs
3. **Check browser console:** F12 in Chrome
4. **Verify all environment variables are set**
5. **Test each component individually**

## Summary

You now have a complete cookie-based audio analysis system that:

✅ Captures YouTube cookies automatically
✅ Downloads audio using yt-dlp (bypasses bot detection)
✅ Analyzes audio with librosa for exact timestamps
✅ Caches results for instant re-analysis
✅ Generates educational commentary with exact timestamps
✅ Works seamlessly in Chrome extension

Enjoy your exact timestamp music commentary! 🎵

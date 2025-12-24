# Testing Guide - Cookie-Based Audio Analysis

Comprehensive testing plan for the cookie-based audio analysis system.

## Pre-Deployment Testing

### Test Modal Function Locally

```bash
# Install dependencies
pip install modal

# Authenticate
modal token new

# Test locally with a sample video
modal run modal_app.py
```

**Expected behavior:**
- Should attempt to download and analyze a test video
- Will show librosa analysis output
- Should complete without errors (if cookies are valid)

### Test Supabase Function Locally

```bash
# Start local Supabase
supabase start

# Deploy function locally
supabase functions serve analyze-video --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/analyze-video \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "test",
    "videoTitle": "Test",
    "channelName": "Test",
    "level": "intermediate",
    "cookies": {}
  }'
```

## Post-Deployment Testing

## Test Suite 1: Basic Functionality

### Test 1.1: Popular Song (Beatles - Penny Lane)

**Video:** https://www.youtube.com/watch?v=S-rB0pHI9fU

**Steps:**
1. Open video in YouTube
2. Open extension side panel
3. Select "Intermediate" level
4. Click "Analyze Video"

**Expected Results:**
- ✅ Progress shows all 3 stages (download, analysis, commentary)
- ✅ Analysis completes in 20-30 seconds
- ✅ Commentary has 4-6 timestamped sections
- ✅ Timestamps are in format `## [MM:SS] Section Name`
- ✅ Tempo detected (around 100-110 BPM)
- ✅ Key detected (B major)
- ✅ Video resumes playing automatically after analysis

**Verify:**
```
Commentary should include:
- Exact timestamps like [0:00], [0:15], [0:45]
- Musical key (B major)
- Tempo (~108 BPM)
- Section labels (intro, verse, chorus, etc.)
```

### Test 1.2: Cached Analysis (Same Video)

**Steps:**
1. Stay on the same video
2. Click "Analyze Video" again

**Expected Results:**
- ✅ Analysis completes in < 1 second (instant!)
- ✅ Same results as first analysis
- ✅ Progress bar may flash quickly
- ✅ Supabase logs show "Found cached analysis!"

### Test 1.3: Different Complexity Level

**Steps:**
1. Stay on the same video
2. Select "Advanced" level
3. Click "Analyze Video"

**Expected Results:**
- ✅ Still uses cached audio analysis (instant audio stage)
- ✅ Only commentary generation takes time (~3-5 seconds)
- ✅ Commentary is more technical (uses advanced terminology)
- ✅ Still has same exact timestamps from cache

## Test Suite 2: Different Music Genres

### Test 2.1: Classical (Beethoven - Symphony No. 3 "Eroica")

**Video:** https://www.youtube.com/watch?v=nbGV-MVfgec

**Expected Results:**
- ✅ Works with longer classical piece
- ✅ Detects orchestral sections
- ✅ May take longer due to video length (30-45 seconds)
- ✅ Should detect tempo changes if present

### Test 2.2: EDM/Electronic (Daft Punk - Around the World)

**Video:** https://www.youtube.com/watch?v=dwDns8x3Jb4

**Expected Results:**
- ✅ Detects consistent electronic beat
- ✅ Higher BPM (around 120-130)
- ✅ Clear section boundaries
- ✅ Repetitive structure detected

### Test 2.3: Jazz (Miles Davis - So What)

**Video:** https://www.youtube.com/watch?v=zqNTltOGh5c

**Expected Results:**
- ✅ May struggle with tempo (jazz has swing)
- ✅ Should still provide useful sections
- ✅ Key detection (D minor)

## Test Suite 3: Edge Cases

### Test 3.1: Very Short Video (< 1 minute)

**Expected Results:**
- ✅ Completes successfully
- ✅ May detect only 2-3 sections
- ✅ Still provides useful analysis

### Test 3.2: Very Long Video (> 10 minutes)

**Expected Results:**
- ✅ May timeout if > 15 minutes
- ✅ Consider increasing timeout for long videos
- ⚠️ Modal may charge more for longer processing

### Test 3.3: Private/Deleted Video

**Expected Results:**
- ❌ Should fail gracefully
- ✅ Error message: "Audio download failed"
- ✅ Video resumes playing
- ✅ No crash or hang

### Test 3.4: Age-Restricted Video

**Expected Results:**
- ✅ Should work if logged into YouTube
- ❌ May fail if not logged in
- ✅ Cookies should handle authentication

### Test 3.5: Copyright-Claimed Video

**Expected Results:**
- ⚠️ May work or may fail depending on region
- ✅ Should fail gracefully with clear error

## Test Suite 4: User Experience

### Test 4.1: Video Sync Feature

**Steps:**
1. Analyze a video
2. Enable "Sync with video" toggle
3. Click on a timestamp section
4. Let video play through sections

**Expected Results:**
- ✅ Video jumps to clicked timestamp
- ✅ Sections highlight as video plays
- ✅ Smooth scrolling to current section

### Test 4.2: Auto-Pause Mode

**Steps:**
1. Analyze a video
2. Enable "Auto-pause at each section"
3. Let video play

**Expected Results:**
- ✅ Video pauses at each section boundary
- ✅ Resume button appears
- ✅ Can manually resume video

### Test 4.3: Text-to-Speech

**Steps:**
1. Analyze a video
2. Click "Read Aloud"

**Expected Results:**
- ✅ TTS reads commentary
- ✅ Pause/Resume/Stop controls work
- ✅ Can stop TTS at any time

### Test 4.4: Pop-out Window

**Steps:**
1. Analyze a video
2. Click "Pop Out"

**Expected Results:**
- ✅ Commentary opens in new window
- ✅ Side panel closes
- ✅ Can continue browsing YouTube

## Test Suite 5: Error Handling

### Test 5.1: No Internet Connection

**Steps:**
1. Disconnect internet
2. Try to analyze video

**Expected Results:**
- ❌ Should fail gracefully
- ✅ Error: "Unable to connect to the server"
- ✅ Video resumes playing

### Test 5.2: Not Logged into YouTube

**Steps:**
1. Log out of YouTube
2. Try to analyze video

**Expected Results:**
- ⚠️ May work for public videos
- ❌ May fail for some videos
- ✅ Should get cookies but they may be limited

### Test 5.3: Invalid Supabase Config

**Steps:**
1. Set wrong Supabase URL in config.js
2. Try to analyze video

**Expected Results:**
- ❌ Should fail
- ✅ Error: "Unable to connect to the server"
- ✅ Video resumes playing

### Test 5.4: Modal Service Down

**Expected Results:**
- ❌ Analysis fails
- ✅ Clear error message
- ✅ Video resumes playing
- ✅ Can retry later

## Test Suite 6: Performance & Caching

### Test 6.1: Cache Performance

**Steps:**
1. Analyze Video A (first time)
2. Analyze Video B (first time)
3. Analyze Video A again (cached)
4. Analyze Video B again (cached)

**Expected Results:**
```
Video A (first):  ~25 seconds
Video B (first):  ~25 seconds
Video A (cached): < 1 second
Video B (cached): < 1 second
```

### Test 6.2: Database Cache Verification

**Steps:**
1. Analyze a new video
2. Check Supabase database

**SQL Query:**
```sql
SELECT
  video_id,
  video_title,
  tempo,
  key,
  analyzed_at
FROM audio_analysis_cache
ORDER BY analyzed_at DESC
LIMIT 10;
```

**Expected Results:**
- ✅ Entry exists for analyzed video
- ✅ Tempo and key are populated
- ✅ Sections and beats are stored as JSON

### Test 6.3: Concurrent Requests

**Steps:**
1. Open video in two Chrome windows
2. Analyze in both simultaneously

**Expected Results:**
- ✅ Both complete successfully
- ⚠️ Second one may use cache if first finishes first
- ✅ No race conditions or errors

## Test Suite 7: Cross-Browser (Future)

### Test 7.1: Firefox Support

**Status:** Not yet implemented
**Requires:** Manifest V3 conversion for Firefox

### Test 7.2: Edge Support

**Status:** Should work (Chromium-based)
**Steps:** Load extension in Edge

## Automated Testing

### Unit Tests for Modal Function

```python
# test_modal.py
import pytest
from modal_app import write_cookies_to_netscape_file, estimate_key_from_chroma
import numpy as np

def test_cookie_file_format():
    cookies = {"TEST_COOKIE": "test_value"}
    filepath = "/tmp/test_cookies.txt"
    write_cookies_to_netscape_file(cookies, filepath)

    with open(filepath, 'r') as f:
        content = f.read()
        assert "TEST_COOKIE" in content
        assert "test_value" in content
        assert ".youtube.com" in content

def test_key_estimation():
    # Create a mock chroma with C major characteristics
    chroma = np.zeros((12, 100))
    chroma[0, :] = 1.0  # Strong C
    chroma[4, :] = 0.8  # Strong E (major third)
    chroma[7, :] = 0.7  # Strong G (fifth)

    key = estimate_key_from_chroma(chroma)
    assert "C" in key
```

### Integration Tests for Supabase Function

```typescript
// test_supabase.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"

Deno.test("should return error for missing cookies", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId: 'test',
      level: 'intermediate'
      // Missing cookies
    })
  });

  const data = await response.json();
  assertEquals(data.error, 'Missing cookies for audio download');
});
```

## Monitoring & Logging

### Modal Logs

```bash
# View real-time logs
modal logs music-analysis --follow

# View recent errors
modal logs music-analysis --filter error
```

**Look for:**
- ✅ "Analysis complete!" messages
- ❌ yt-dlp errors
- ⚠️ Librosa warnings

### Supabase Logs

**Dashboard:** Supabase → Logs → Edge Functions

**Look for:**
- ✅ "Found cached analysis!"
- ✅ "Analysis cached successfully"
- ❌ "Modal API error"
- ❌ "OpenAI API error"

### Browser Console

**F12 → Console**

**Look for:**
- ✅ "Successfully captured YouTube cookies"
- ✅ "Analysis complete!"
- ❌ Any JavaScript errors
- ⚠️ CORS errors (indicates config issues)

## Performance Benchmarks

### Target Metrics

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| First analysis (uncached) | 20-30s | 30-45s | > 45s |
| Cached analysis | < 1s | < 3s | > 3s |
| Cookie capture | < 0.1s | < 0.5s | > 0.5s |
| Modal download | 5-10s | 10-15s | > 15s |
| Librosa analysis | 5-10s | 10-20s | > 20s |
| OpenAI generation | 3-5s | 5-10s | > 10s |

### Memory Usage

- **Extension:** < 50MB
- **Modal container:** ~500MB-1GB (includes librosa)
- **Database cache:** ~5KB per video

## Regression Testing Checklist

After any code changes, verify:

- [ ] Extension loads without errors
- [ ] Can capture YouTube cookies
- [ ] Can analyze a new video
- [ ] Cached videos return instantly
- [ ] Timestamps are clickable
- [ ] Video sync works
- [ ] TTS works
- [ ] Pop-out works
- [ ] Error handling works
- [ ] No console errors
- [ ] Modal logs show success
- [ ] Supabase logs show success

## Bug Report Template

When reporting issues:

```markdown
**Environment:**
- Browser: Chrome 120.0.6099.129
- Extension version: 1.0.0
- Video URL: https://youtube.com/watch?v=...

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
...

**Actual Behavior:**
...

**Logs:**
- Browser console: [paste errors]
- Modal logs: [paste from `modal logs music-analysis`]
- Supabase logs: [screenshot]

**Video Details:**
- Duration: 3:24
- Visibility: Public
- Age restriction: No
```

## Success Criteria

The system is working correctly when:

✅ **Functionality:**
- New videos analyze in 20-30 seconds
- Cached videos return in < 1 second
- Timestamps are accurate (within 1-2 seconds)
- All 3 progress stages complete
- Commentary includes exact timestamps

✅ **Reliability:**
- 90%+ success rate on public videos
- Graceful error handling for failures
- No crashes or hangs
- Consistent results on re-analysis

✅ **User Experience:**
- Clear progress indicators
- Video auto-pauses during analysis
- Video auto-resumes after completion
- Timestamps are clickable
- Sync features work smoothly

✅ **Performance:**
- First analysis: < 30 seconds
- Cached analysis: < 1 second
- No memory leaks
- Efficient database queries

Happy Testing! 🎵

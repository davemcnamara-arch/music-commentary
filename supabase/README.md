# Supabase Edge Functions Setup

This directory contains the Supabase Edge Functions for the Music Commentary Extension.

## 📋 Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Gemini API Key**: Get one at [Google AI Studio](https://aistudio.google.com/app/apikey)
3. **Supabase CLI**: Install the CLI tool

## 🚀 Quick Start

### Step 1: Install Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or via NPM (all platforms)
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate.

### Step 3: Link to Your Project

```bash
# Initialize Supabase in this directory
cd /path/to/music-commentary/supabase
supabase link --project-ref your-project-ref
```

**Finding your project ref:**
- Go to your Supabase dashboard
- Select your project
- Go to Settings > General
- Copy the "Reference ID"

### Step 4: Set Up Environment Variables

The Edge Function needs your Gemini API key. You have two options:

#### Option A: Using Supabase Dashboard (Recommended for Production)

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** > **Edge Functions**
3. Scroll to **Environment Variables**
4. Add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key

#### Option B: Using CLI (For Testing)

```bash
# Set the secret via CLI
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 5: Deploy the Edge Function

```bash
# Deploy the analyze-video function
supabase functions deploy analyze-video

# Or deploy all functions
supabase functions deploy
```

After deployment, you'll see output like:
```
Deployed Function analyze-video
  URL: https://your-project.supabase.co/functions/v1/analyze-video
```

**Copy this URL!** You'll need it for the Chrome extension.

## 🧪 Testing the Function

### Test Locally (Optional)

Before deploying, you can test locally:

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve analyze-video --env-file .env

# In another terminal, test it
curl -i --location --request POST 'http://localhost:54321/functions/v1/analyze-video' \
  --header 'Content-Type: application/json' \
  --data '{
    "videoId": "dQw4w9WgXcQ",
    "videoTitle": "Test Video",
    "channelName": "Test Channel",
    "level": "intermediate"
  }'
```

### Test Deployed Function

```bash
# Replace YOUR_PROJECT_REF with your actual project reference
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/analyze-video' \
  --header 'Content-Type: application/json' \
  --data '{
    "videoId": "dQw4w9WgXcQ",
    "videoTitle": "Rick Astley - Never Gonna Give You Up",
    "channelName": "Rick Astley",
    "level": "novice"
  }'
```

You should get a response like:
```json
{
  "success": true,
  "videoId": "dQw4w9WgXcQ",
  "level": "novice",
  "commentary": "## Musical Analysis...",
  "generatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 Configuration for Chrome Extension

After deploying, update your Chrome extension with the Edge Function URL:

1. Open `chrome-extension/sidepanel.js`
2. Find the `SUPABASE_FUNCTION_URL` constant (we'll add this in the next step)
3. Set it to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/analyze-video`

## 📊 Monitoring & Logs

### View Function Logs

```bash
# Stream logs from deployed function
supabase functions logs analyze-video --tail
```

### Dashboard Monitoring

Go to your Supabase dashboard:
- **Edge Functions** tab
- Select `analyze-video`
- View invocations, errors, and performance metrics

## 🔐 Security Notes

- The function uses CORS to allow requests from any origin (needed for Chrome extension)
- JWT verification is disabled for this function (it's a public endpoint)
- Rate limiting is handled by Supabase automatically
- Your Gemini API key is stored securely in Supabase secrets

## 🐛 Troubleshooting

### "Gemini API key not configured"
- Make sure you've set the `GEMINI_API_KEY` secret in Supabase
- Redeploy the function after setting secrets

### CORS Errors
- The function includes CORS headers for all origins
- Make sure you're using the correct function URL

### Function Timeout
- Gemini API calls may take 5-15 seconds
- This is normal for video analysis
- Supabase Edge Functions have a 60-second timeout

### "Failed to analyze video"
- Check the Gemini API key is valid
- Verify the video ID is correct
- Check function logs: `supabase functions logs analyze-video`

## 💡 Tips

- **Cost**: Gemini 1.5 Flash is very cost-effective (usually <$0.01 per analysis)
- **Performance**: First request may be slower due to cold start
- **Caching**: Consider implementing caching for popular videos
- **Rate Limits**: Gemini has generous rate limits, but monitor usage

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Deno Deploy Docs](https://deno.com/deploy/docs)

## 🔄 Updating the Function

When you make changes to the function:

```bash
# Pull latest code from git
git pull

# Deploy updated function
supabase functions deploy analyze-video

# Check logs to verify deployment
supabase functions logs analyze-video --tail
```

## Next Steps

Once deployed, proceed to update the Chrome extension to call this function!

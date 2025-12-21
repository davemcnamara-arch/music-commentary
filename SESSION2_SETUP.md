# Session 2 Setup Guide - Backend Integration

Complete guide to connecting your Music Commentary Extension to Supabase and Gemini API.

## 🎯 What You'll Accomplish

By the end of this guide, your Chrome extension will:
- Call a Supabase Edge Function when "Analyze Video" is clicked
- Use Google's Gemini API to generate AI commentary
- Display real, educational music analysis
- Handle errors gracefully

## 📋 Prerequisites

- [ ] Supabase account (free tier is fine)
- [ ] Google Gemini API key (also free to start)
- [ ] Supabase CLI installed
- [ ] Chrome extension from Session 1 working

## Step 1: Get Your Gemini API Key (5 minutes)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Click **"Create API key in new project"** (or select existing project)
5. **Copy the API key** - you'll need it in Step 3

**Keep this key safe!** Don't commit it to Git or share it publicly.

## Step 2: Set Up Supabase Project (10 minutes)

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click **"New Project"**
3. Fill in:
   - Name: `music-commentary` (or your choice)
   - Database Password: Generate a strong password
   - Region: Choose closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for project to initialize

### 2.2 Get Project Details

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** section
3. Copy these values (you'll need them):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project Ref**: The `xxxxx` part of the URL
   - **anon/public key**: Long string starting with `eyJ...`

## Step 3: Install and Configure Supabase CLI

### 3.1 Install CLI

Choose your platform:

**macOS/Linux:**
```bash
brew install supabase/tap/supabase
```

**Windows (Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**NPM (all platforms):**
```bash
npm install -g supabase
```

### 3.2 Login to Supabase

```bash
supabase login
```

This opens your browser - authorize the CLI.

### 3.3 Link Your Project

```bash
cd /path/to/music-commentary
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the ref from Step 2.2 (e.g., `abcdefghijklm`).

## Step 4: Deploy the Edge Function (5 minutes)

### 4.1 Set Gemini API Key

Set your Gemini API key as a secret:

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_from_step_1
```

### 4.2 Deploy Function

```bash
cd supabase
supabase functions deploy analyze-video
```

You should see:
```
Deployed Function analyze-video
  URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/analyze-video
```

**✅ Copy this URL!** You need it for the next step.

## Step 5: Configure Chrome Extension (2 minutes)

### 5.1 Update config.js

1. Open `chrome-extension/config.js` in your editor
2. Replace the placeholder URL:

```javascript
const CONFIG = {
  // Replace with your actual URL from Step 4.2
  SUPABASE_FUNCTION_URL: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/analyze-video',

  API_TIMEOUT: 60000,
  DEBUG: true,
};
```

### 5.2 Reload Extension in Chrome

1. Go to `chrome://extensions/`
2. Find "Music Commentary Extension"
3. Click the **reload icon** (circular arrow)

## Step 6: Test the Integration! 🎉

### 6.1 Open a Music Video

1. Go to YouTube
2. Open any music video (try something well-known)
3. Click the Music Commentary extension icon

### 6.2 Generate Commentary

1. Select a level (Novice, Intermediate, or Advanced)
2. Click **"Analyze Video"**
3. Wait 5-15 seconds
4. You should see AI-generated commentary! 🎵

### 6.3 What to Expect

The commentary will include:
- Musical analysis (melody, harmony, rhythm)
- Production techniques
- Genre characteristics
- Context and insights
- All formatted nicely with headers and bullet points

## 🐛 Troubleshooting

### "Please configure your Supabase Edge Function URL"
- Make sure you updated `config.js` with your actual Supabase URL
- Reload the extension in Chrome

### "Unable to connect to the server"
- Check your internet connection
- Verify the Supabase URL is correct
- Check if the function is deployed: `supabase functions list`

### "Gemini API key not configured"
- Make sure you set the secret: `supabase secrets list`
- Redeploy if needed: `supabase functions deploy analyze-video`

### Function times out
- Gemini API can take 10-20 seconds for video analysis
- This is normal - wait a bit longer
- Check function logs: `supabase functions logs analyze-video`

### Commentary looks weird or broken
- Check browser console (F12) for errors
- Make sure the extension reloaded properly
- Try a different video

## 📊 Viewing Logs and Monitoring

### View Function Logs

```bash
# Stream live logs
supabase functions logs analyze-video --tail

# View recent logs
supabase functions logs analyze-video
```

### Dashboard Monitoring

1. Go to Supabase dashboard
2. Click **Edge Functions** in sidebar
3. Select `analyze-video`
4. View invocations, errors, and performance

## 💰 Cost Information

### Gemini API
- **Free tier**: 15 requests per minute, 1,500 per day
- **Pricing**: $0.075 per 1M input tokens, $0.30 per 1M output tokens
- **Typical cost**: < $0.01 per video analysis

### Supabase
- **Free tier**: 500,000 Edge Function invocations/month
- **Bandwidth**: 2GB/month included
- **This project fits easily in free tier**

## ✨ Success!

If everything worked:
- ✅ Extension loads on YouTube
- ✅ Clicking "Analyze Video" calls your Supabase function
- ✅ Gemini API generates commentary
- ✅ Commentary displays formatted in the side panel

## 🚀 Next Steps

Now that Session 2 is complete, you could add:

1. **Caching**: Store analyses to avoid re-analyzing same video
2. **Export**: Button to copy commentary to clipboard
3. **History**: Save analyzed videos
4. **Improvements**: Better timestamp extraction from Gemini
5. **Styling**: Customize the commentary display

## 🆘 Still Having Issues?

1. Check all steps above carefully
2. View function logs for errors
3. Check browser console (F12) for frontend errors
4. Verify API keys are correct
5. Try the test curl command from `supabase/README.md`

## 📝 Quick Reference

**Useful Commands:**
```bash
# Deploy function
supabase functions deploy analyze-video

# View logs
supabase functions logs analyze-video --tail

# List secrets
supabase secrets list

# Set secret
supabase secrets set KEY=value

# Link project
supabase link --project-ref YOUR_REF
```

**Key Files:**
- `supabase/functions/analyze-video/index.ts` - Edge Function code
- `chrome-extension/config.js` - Extension configuration
- `chrome-extension/sidepanel.js` - Frontend logic

---

Congratulations on completing Session 2! 🎉 Your Music Commentary Extension is now powered by AI!

# Session 2 Setup - Dashboard Only (No CLI)

Complete guide to set up your Music Commentary Extension using only the Supabase Dashboard - no command line needed!

## 📋 What You'll Need

- [ ] Supabase account (free)
- [ ] Google Gemini API key (free)
- [ ] The code from GitHub
- [ ] Chrome browser

## Part 1: Get Your Gemini API Key (5 minutes)

### Step 1: Go to Google AI Studio

1. Open your browser and go to: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click the **"Create API Key"** button
4. Click **"Create API key in new project"** (or select an existing project)
5. A popup will show your API key - it looks like: `AIzaSyC...`
6. **IMPORTANT**: Copy this key and paste it somewhere safe (Notepad, Notes app, etc.)
   - You'll need it in a few steps
   - Keep it secret - don't share it publicly

✅ **You now have your Gemini API key!**

## Part 2: Set Up Supabase Project (10 minutes)

### Step 2: Create Supabase Account

1. Go to: https://supabase.com
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up with GitHub, Google, or email
4. Verify your email if needed

### Step 3: Create a New Project

1. Once logged in, click **"New Project"**
2. Fill in the form:
   - **Organization**: Choose or create one (use default)
   - **Name**: `music-commentary` (or whatever you like)
   - **Database Password**: Click "Generate a password" (you won't need this)
   - **Region**: Choose closest to you (e.g., "US West" if you're in California)
   - **Pricing Plan**: Free (default)
3. Click **"Create new project"**
4. Wait 2-3 minutes while Supabase sets up your project ☕

### Step 4: Get Your Project Details

Once your project is ready:

1. You'll see your project dashboard
2. Look at the URL in your browser - it looks like:
   ```
   https://supabase.com/dashboard/project/abcdefghijklmnop
   ```
3. Copy the part after `/project/` - that's your **Project Reference ID**
   - Example: `abcdefghijklmnop`
   - Save this somewhere safe

4. Click **"Settings"** in the left sidebar (gear icon at bottom)
5. Click **"API"** in the settings menu
6. You'll see **Project URL** - it looks like:
   ```
   https://abcdefghijklmnop.supabase.co
   ```
7. **Copy this URL** - you'll need it later for the Chrome extension

✅ **You now have your Supabase project set up!**

## Part 3: Deploy the Edge Function (10 minutes)

Unfortunately, **Supabase Edge Functions can only be deployed via the CLI** - there's no dashboard option yet.

But don't worry! I'll make this as simple as possible:

### Step 5: Install Supabase CLI (One-time setup)

Pick your operating system:

#### **Windows:**

1. Download and install Scoop (a package manager):
   - Open PowerShell (search for it in Start menu)
   - Copy and paste this command, then press Enter:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
     ```
   - Wait for it to finish

2. Install Supabase CLI:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

#### **Mac:**

1. Open Terminal (search for "Terminal" in Spotlight)
2. If you have Homebrew installed:
   ```bash
   brew install supabase/tap/supabase
   ```

3. If you don't have Homebrew, install it first:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Then run the brew install command above.

#### **Alternative for Any OS (using NPM):**

If you have Node.js installed:

1. Open Terminal (Mac) or PowerShell (Windows)
2. Run:
   ```bash
   npm install -g supabase
   ```

### Step 6: Verify Installation

In your terminal/PowerShell, type:
```bash
supabase --version
```

You should see a version number like `1.x.x`

✅ **CLI is installed!**

### Step 7: Login to Supabase

1. In terminal/PowerShell, run:
   ```bash
   supabase login
   ```

2. A browser window will open asking you to authorize
3. Click **"Authorize"**
4. You'll see "Logged in successfully" in your terminal

### Step 8: Navigate to Your Project

You need to go to where you downloaded the code from GitHub:

**Windows PowerShell:**
```powershell
cd C:\Users\YourUsername\Downloads\music-commentary
```

**Mac Terminal:**
```bash
cd ~/Downloads/music-commentary
```

💡 **Tip**: If you're not sure where the folder is:
- **Windows**: Type `cd ` (with a space), then drag the folder from File Explorer into PowerShell
- **Mac**: Type `cd ` (with a space), then drag the folder from Finder into Terminal

Verify you're in the right place:
```bash
ls
```

You should see folders like `chrome-extension`, `supabase`, etc.

### Step 9: Link Your Project

Run this command (replace `YOUR_PROJECT_REF` with the ID from Step 4):

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**Example:**
```bash
supabase link --project-ref abcdefghijklmnop
```

You'll be asked to enter your database password - **just press Enter** (we don't need it).

### Step 10: Set Your Gemini API Key

Run this command (replace with YOUR actual Gemini API key from Step 1):

```bash
supabase secrets set GEMINI_API_KEY=AIzaSyC_YOUR_ACTUAL_KEY_HERE
```

**Example:**
```bash
supabase secrets set GEMINI_API_KEY=AIzaSyDPxCz8h4j...
```

You should see: "Finished supabase secrets set"

### Step 11: Deploy the Function!

1. Navigate to the supabase folder:
   ```bash
   cd supabase
   ```

2. Deploy the function:
   ```bash
   supabase functions deploy analyze-video
   ```

3. Wait 10-30 seconds while it deploys...

4. You should see output like:
   ```
   Deployed Function analyze-video
     URL: https://abcdefghijklmnop.supabase.co/functions/v1/analyze-video
   ```

5. **COPY THIS URL!** You'll need it for the Chrome extension.

✅ **Your backend is now deployed!**

## Part 4: Configure the Chrome Extension (5 minutes)

### Step 12: Download/Update the Code

If you haven't already:

1. Go to your GitHub repository
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Extract the ZIP file
5. Navigate to the `chrome-extension` folder

### Step 13: Update config.js

1. Open the `chrome-extension` folder
2. Find and open `config.js` in a text editor (Notepad, TextEdit, VS Code, etc.)
3. Find this line:
   ```javascript
   SUPABASE_FUNCTION_URL: 'YOUR_SUPABASE_FUNCTION_URL_HERE',
   ```

4. Replace it with your actual URL from Step 11:
   ```javascript
   SUPABASE_FUNCTION_URL: 'https://abcdefghijklmnop.supabase.co/functions/v1/analyze-video',
   ```

5. **Save the file** (Ctrl+S or Cmd+S)

✅ **Extension is now configured!**

### Step 14: Add Your Icons (If You Haven't Already)

1. Make sure you have 4 icon files in the `chrome-extension/icons/` folder:
   - `icon16.png`
   - `icon32.png`
   - `icon192.png`
   - `icon512.png`

2. If you don't have icons yet, see the `ICON_GUIDE.md` file for how to create them

### Step 15: Load/Reload Extension in Chrome

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Turn on **"Developer mode"** (toggle in top-right)

**If this is your first time loading:**
4. Click **"Load unpacked"**
5. Select the entire `chrome-extension` folder
6. The extension should appear in your list!

**If you already have it loaded:**
4. Find "Music Commentary Extension" in your list
5. Click the **reload icon** (circular arrow)

✅ **Extension is loaded!**

## Part 5: Test It Out! 🎉

### Step 16: Try It on YouTube

1. Go to YouTube: https://youtube.com
2. Search for and open any music video (try something well-known)
3. Wait for the video page to fully load
4. Click the **Music Commentary** extension icon in your toolbar

### Step 17: Generate AI Commentary

1. The side panel should open showing the video title and channel
2. Click one of the level buttons:
   - **Novice** - For beginners
   - **Intermediate** - For music students
   - **Advanced** - For musicians/producers
3. Click **"Analyze Video"**
4. Wait 10-20 seconds (Gemini is analyzing the video!)
5. You should see AI-generated music commentary appear! 🎵

### What to Expect

The commentary will include:
- **Musical Elements**: Melody, harmony, rhythm analysis
- **Production Techniques**: How the song was made
- **Genre & Style**: Musical influences and characteristics
- **Context**: Historical or cultural background
- All formatted with headers, bold text, and bullet points!

## 🐛 Troubleshooting

### "Please configure your Supabase Edge Function URL"
- ✅ Make sure you saved `config.js` after editing
- ✅ Reload the extension in `chrome://extensions/`
- ✅ Make sure the URL starts with `https://` and ends with `/analyze-video`

### "Unable to connect to the server"
- ✅ Check your internet connection
- ✅ Verify the URL in `config.js` is exactly what you got from Step 11
- ✅ Make sure you deployed the function successfully

### "Could not establish connection"
- ✅ Refresh the YouTube page
- ✅ Make sure you're on a video page (`youtube.com/watch?v=...`)
- ✅ Reload the extension

### Commentary takes a long time (20+ seconds)
- ✅ This is normal for the first request (cold start)
- ✅ Subsequent requests will be faster
- ✅ Gemini API needs time to analyze the video

### Still not working?
1. Open the side panel
2. Right-click in the panel and select **"Inspect"**
3. Look at the **Console** tab for error messages
4. Check if the error mentions:
   - "404" → Function not deployed correctly
   - "CORS" → Function needs redeployment
   - "timeout" → Increase API_TIMEOUT in config.js

## 💰 Costs & Limits

### Gemini API (Free Tier)
- **Free requests**: 15 per minute, 1,500 per day
- **Cost beyond free tier**: ~$0.01 per video analysis
- For personal use, you'll stay in the free tier!

### Supabase (Free Tier)
- **Function invocations**: 500,000 per month (way more than you need)
- **Bandwidth**: 2GB per month
- This project easily fits in the free tier!

## ✅ Success Checklist

- [ ] Created Supabase account and project
- [ ] Got Gemini API key
- [ ] Installed Supabase CLI
- [ ] Deployed Edge Function
- [ ] Copied function URL
- [ ] Updated config.js with URL
- [ ] Loaded extension in Chrome
- [ ] Tested on a YouTube video
- [ ] Got AI commentary!

## 🎉 You're Done!

Your Music Commentary Extension is now fully powered by AI!

Try different videos and different education levels to see how the commentary changes. The AI will provide different insights based on:
- The type of music
- Your selected education level
- Musical elements in the video

Enjoy your new AI music education tool! 🎵

## 📚 What You Built

You now have:
- ✅ Chrome extension that works on YouTube
- ✅ Supabase backend with Edge Function
- ✅ Gemini AI integration for video analysis
- ✅ Real-time music commentary generation
- ✅ Three levels of educational content

---

Need help? Stuck on a step? Let me know which step number you're on and what error you're seeing!

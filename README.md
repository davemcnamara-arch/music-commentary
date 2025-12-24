# 🎵 Music Commentary - Cookie-Based Audio Analysis

An intelligent Chrome extension that provides educational music commentary with **exact timestamps** using real audio analysis via cookie-authenticated YouTube downloads.

## 🎯 Project Overview

This project combines a Chrome extension frontend with Supabase backend, Modal Python service, and OpenAI GPT to deliver intelligent, level-appropriate music education content with **exact timestamps** derived from real audio analysis using librosa.

## ✨ Key Features

- **🎼 Exact Timestamps** - Real audio analysis using librosa (not estimated!)
- **🍪 Cookie-Based Download** - Bypasses YouTube bot detection using your browser cookies
- **⚡ Smart Caching** - First analysis takes 20-30s, cached analysis is instant (< 1s)
- **🎓 Multi-Level Education** - Novice, Intermediate, and Advanced commentary
- **🔄 Real-Time Sync** - Commentary highlights as video plays
- **🔊 Text-to-Speech** - Listen to commentary with pause/resume/stop controls
- **↗️ Pop-out Window** - View commentary in separate window
- **⏸️ Smart Video Control** - Auto-pause during analysis, auto-resume when complete

## 🏗️ Architecture

```
┌─────────────────────┐
│  Chrome Extension   │
│   - Captures        │
│     YouTube cookies │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐      ┌──────────────────┐
│ Supabase Edge       │─────→│ PostgreSQL Cache │
│ Function            │←─────│ (instant hits!)  │
└──────────┬──────────┘      └──────────────────┘
           │
           ↓
┌─────────────────────┐
│  Modal (Python)     │
│   - yt-dlp          │
│   - librosa         │
│   - Audio Analysis  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Audio Features:    │
│   - Tempo (BPM)     │
│   - Key             │
│   - Sections        │
│   - Beats           │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  OpenAI GPT-4o-mini │
│   - Timestamped     │
│     Commentary      │
└─────────────────────┘
```

## 📦 Project Structure

```
music-commentary/
├── chrome-extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json             # With cookies permission
│   ├── sidepanel.html            # Progress UI
│   ├── sidepanel.js              # Cookie capture + analysis
│   ├── scripts/
│   │   ├── background.js         # Service worker
│   │   └── content.js            # YouTube integration
│   └── icons/                    # Extension icons
├── supabase/                      # Backend Infrastructure
│   ├── functions/
│   │   └── analyze-video/        # Edge Function with caching
│   │       └── index.ts          # Modal + OpenAI integration
│   └── migrations/
│       └── 20250101_audio_analysis_cache.sql
├── modal_app.py                   # Modal audio analysis service
├── DEPLOYMENT.md                  # Complete deployment guide
├── TESTING.md                     # Comprehensive test suite
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+ (for Modal)
- Chrome Browser (logged into YouTube)
- Modal account (free tier: 30 GPU hours/month)
- Supabase project
- OpenAI API key

### 1. Deploy Modal Service

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new

# Deploy audio analysis service
modal deploy modal_app.py
```

**Copy the endpoint URL** (ends with `.modal.run`)

### 2. Set Up Database

```bash
# Apply migration
supabase db push
```

Or run `supabase/migrations/20250101_audio_analysis_cache.sql` in Supabase SQL Editor.

### 3. Configure Supabase

Add environment variables in Supabase Dashboard → Settings → Edge Functions:

- `MODAL_ENDPOINT` - Your Modal endpoint URL
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

### 4. Deploy Edge Function

```bash
supabase functions deploy analyze-video
```

### 5. Load Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `chrome-extension/` folder
5. Update `chrome-extension/config.js` with your Supabase URL

### 6. Test!

1. Go to any YouTube music video
2. Click extension icon → Open side panel
3. Select a level (Novice/Intermediate/Advanced)
4. Click **Analyze Video**
5. Watch the progress:
   - ⏳ Downloading audio... (5-10s)
   - ⏳ Analyzing structure... (10-15s)
   - ⏳ Generating commentary... (3-5s)
6. Enjoy exact timestamped commentary! 🎵

## 📖 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide with troubleshooting
- **[TESTING.md](TESTING.md)** - Comprehensive testing guide with test cases

## 🎓 Education Levels

### Novice
- Simple, everyday language
- Basic concepts (rhythm, melody, harmony)
- No technical jargon
- Focus on what you can hear and feel

### Intermediate
- Standard music theory terminology
- Chord progressions and key signatures
- Basic production techniques
- Musical patterns and genres

### Advanced
- Advanced music theory and analysis
- Harmonic analysis and modulations
- Production techniques and sound design
- Complex compositional analysis

## ⏱️ Performance

| Stage | First Time | Cached |
|-------|------------|--------|
| Cookie Capture | < 0.1s | < 0.1s |
| Audio Download | 5-10s | - |
| Audio Analysis | 10-15s | - |
| Commentary | 3-5s | 3-5s |
| **Total** | **20-30s** | **< 1s** |

## 💰 Cost Breakdown

### First Analysis (Uncached)
- Modal: $0.03-0.05
- OpenAI: $0.001-0.002
- **Total: ~$0.03-0.05**

### Cached Analysis
- Modal: $0.00 (cache hit!)
- OpenAI: $0.001-0.002
- **Total: ~$0.001-0.002**

### Free Tier Limits
- **Modal:** 30 GPU hours/month ≈ 300-600 videos
- **OpenAI:** Pay per use (~$0.001 per request)
- **Supabase:** 500MB database ≈ thousands of cached videos

## 🔒 Privacy & Security

### Cookies
- ✅ Only used for this one request
- ✅ Never stored on servers
- ✅ Transmitted over HTTPS only
- ✅ Cleared from memory immediately after use

### Audio Files
- ✅ Downloaded to temporary Modal container
- ✅ Deleted immediately after analysis
- ✅ Never stored permanently

### Your Data
- ✅ Only video ID and analysis cached
- ✅ No personal information stored
- ✅ All data in YOUR Supabase project
- ✅ No third-party tracking

## 🛠️ Tech Stack

### Frontend
- **Chrome Extension** - Manifest V3 with cookies permission
- **JavaScript** - Vanilla JS (no frameworks)
- **Web Speech API** - Text-to-speech functionality

### Backend
- **Supabase Edge Functions** - Deno/TypeScript
- **Modal** - Python serverless compute
- **PostgreSQL** - Analysis caching

### Audio Analysis
- **yt-dlp** - YouTube download with cookie support
- **librosa** - Audio analysis and feature extraction
- **NumPy/SciPy** - Numerical processing

### AI
- **OpenAI GPT-4o-mini** - Commentary generation

## 📊 Example Output

```markdown
## [0:00] Introduction
The song opens in **B major** with a moderate tempo of **108 BPM**.
Notice the iconic **bass line** that establishes the harmonic foundation...

## [0:15] First Verse
The **melody** enters with a distinctive ascending pattern. Pay attention
to how the **vocal harmonies** add depth to the texture...

## [0:45] Chorus
A shift in **dynamics** marks the chorus. The **instrumentation**
becomes fuller with the addition of brass...

## [1:15] Bridge
Here we see a brief **modulation** to the relative minor, creating
contrast before returning to the main theme...
```

## 🐛 Troubleshooting

### "Failed to get YouTube cookies"
- Make sure you're logged into YouTube
- Reload the extension
- Check cookies permission in manifest.json

### "Audio download failed"
- Video may be private, deleted, or age-restricted
- Try logging out and back into YouTube to refresh cookies
- Check Modal logs: `modal logs music-analysis`

### "Request timed out"
- Normal for very long videos (> 10 minutes)
- Increase timeout in `config.js` to 180000 (3 minutes)
- Try a shorter video

See [TESTING.md](TESTING.md) for comprehensive troubleshooting guide.

## 📋 Development Sessions

### ✅ Session 1: Extension Skeleton
- Chrome extension structure
- Side panel UI with level selection
- YouTube page integration
- Video data extraction

### ✅ Session 2: Backend Integration
- Supabase Edge Functions setup
- OpenAI GPT integration
- TypeScript implementation
- Markdown formatting

### ✅ Session 3: Audio Analysis & Smart Controls
- Modal Python service
- yt-dlp audio extraction
- librosa musical analysis
- Database caching
- Smart video pause/resume

### ✅ Session 4: Cookie-Based Architecture (Current)
- Cookie capture in extension
- Cookie-authenticated downloads
- Bypass YouTube bot detection
- Privacy-first cookie handling
- Complete deployment documentation

### 🔮 Future Sessions
- Server-Sent Events for real-time progress
- Export functionality
- Analysis history
- Multi-language support
- Advanced visualizations

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Test Modal locally
modal run modal_app.py

# Test specific videos
# See TESTING.md for test cases
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **librosa** - Audio analysis library
- **yt-dlp** - YouTube download tool
- **Modal** - Serverless compute platform
- **Supabase** - Backend-as-a-Service
- **OpenAI** - GPT language models

---

**Built with ❤️ for music education**

🎵 Helping people understand and appreciate music, one exact timestamp at a time! 🎵

# 🎵 Music Commentary Project

An educational Chrome extension that analyzes YouTube music videos and provides timestamped commentary using AI.

## 🎯 Project Overview

This project combines a Chrome extension frontend with a Supabase backend and Google's Gemini API to deliver intelligent, level-appropriate music education content while users watch YouTube videos.

## 📦 Project Structure

```
music-commentary/
├── chrome-extension/        # Chrome Extension (Manifest V3)
│   ├── manifest.json       # Extension configuration
│   ├── sidepanel.html      # UI
│   ├── sidepanel.css       # Styling
│   ├── sidepanel.js        # Frontend logic
│   ├── scripts/
│   │   ├── background.js   # Service worker
│   │   └── content.js      # YouTube integration
│   └── icons/              # Extension icons
├── supabase/               # (Coming in Session 2)
│   └── functions/          # Edge Functions for Gemini API
└── README.md               # This file
```

## 🚀 Quick Start

### Session 1: Chrome Extension (Current)

1. Navigate to the `chrome-extension/` directory
2. Follow the instructions in `chrome-extension/README.md`
3. Load the extension in Chrome and test on YouTube

### Session 2: Backend Integration (Next)

- Set up Supabase Edge Functions
- Integrate Gemini API for video analysis
- Connect frontend to backend
- Implement timestamped commentary generation

## 🛠️ Tech Stack

### Frontend
- Chrome Extension (Manifest V3)
- Vanilla JavaScript
- Side Panel API
- Content Scripts for YouTube integration

### Backend (Session 2)
- Supabase Edge Functions
- Google Gemini API
- TypeScript

## ✨ Features

### Completed (Sessions 1 & 2)
- ✅ Chrome extension with side panel UI
- ✅ YouTube video detection and data extraction
- ✅ Three education levels (Novice/Intermediate/Advanced)
- ✅ Modern, responsive UI design
- ✅ Loading states and error handling
- ✅ Supabase Edge Functions backend
- ✅ AI-powered video analysis via Gemini API
- ✅ Educational music commentary generation
- ✅ Markdown formatting with HTML rendering
- ✅ Level-appropriate analysis (beginner to advanced)

### Future Enhancements (Session 3+)
- 🔄 Timestamp extraction from commentary
- 🔄 Interactive timeline integration
- 🔄 Commentary caching for popular videos
- 🔄 Export/copy functionality
- 🔄 Analysis history

## 📋 Development Sessions

### Session 1: Extension Skeleton ✅
Build the Chrome extension structure with:
- Manifest V3 configuration
- Side panel UI with level selection
- YouTube page integration
- Video title/channel extraction
- Placeholder commentary display

### Session 2: Backend Integration ✅
Build the AI-powered backend with:
- Supabase Edge Functions setup
- Gemini API integration for video analysis
- TypeScript Edge Function implementation
- Chrome extension API integration
- Markdown formatting and rendering
- Error handling and timeout management

**📖 Setup Guide**: See [SESSION2_SETUP.md](SESSION2_SETUP.md) for complete deployment instructions

### Session 3: Enhanced Features (Future)
- Timestamp extraction
- Interactive commentary timeline
- User preferences/settings
- Commentary export functionality

## 🔑 Prerequisites

- Chrome browser with Developer Mode enabled
- Supabase account (for Session 2)
- Google Gemini API key (for Session 2)

## 📖 Documentation

- [Chrome Extension README](chrome-extension/README.md) - Detailed extension setup
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/) - Official documentation
- [Supabase Docs](https://supabase.com/docs) - Backend setup
- [Gemini API Docs](https://ai.google.dev/docs) - AI integration

## 🎓 Education Levels

### Novice
- Basic music concepts
- Simple terminology
- Beginner-friendly explanations

### Intermediate
- Music theory fundamentals
- Basic production techniques
- Moderate technical depth

### Advanced
- Complex music theory
- Advanced production analysis
- Professional-level insights
- Genre-specific techniques

## 🤝 Contributing

This is a personal project currently in development. Sessions are structured to build incrementally:

1. **Session 1**: Extension skeleton (Complete)
2. **Session 2**: Backend integration
3. **Session 3**: Enhanced features

## 📝 Notes

- The extension uses vanilla JavaScript (no frameworks) for simplicity
- Manifest V3 ensures long-term Chrome compatibility
- Side Panel API provides a non-intrusive user experience
- Content scripts respect YouTube's DOM structure

## 🐛 Known Issues

- Icons need to be added manually (see chrome-extension/README.md)
- Commentary is currently placeholder text (Session 2 will add real AI)

## 🔮 Future Enhancements

- Support for other video platforms (Vimeo, etc.)
- Offline commentary caching
- User-submitted commentary
- Social sharing features
- Multi-language support

## 📄 License

Personal project - All rights reserved

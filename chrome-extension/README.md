# Music Commentary Extension

Educational music commentary for YouTube videos powered by AI.

## 📁 Project Structure

```
chrome-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── sidepanel.html         # Side panel UI
├── sidepanel.css          # Styling
├── sidepanel.js           # Side panel logic
├── scripts/
│   ├── background.js      # Service worker
│   └── content.js         # YouTube page integration
├── icons/                 # Extension icons
└── README.md             # This file
```

## 🚀 Installation Instructions

### Step 1: Add Extension Icons

Create or download icon files in the following sizes and place them in the `icons/` directory:
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

**Quick way to create placeholder icons:**
1. Use any image editor (Photoshop, GIMP, Canva, etc.)
2. Create simple icons with a music note or similar symbol
3. Save in PNG format with the correct dimensions
4. Alternative: Use online icon generators like favicon.io

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `chrome-extension` directory
5. The extension should now appear in your extensions list

### Step 3: Test the Extension

1. Navigate to any YouTube video (e.g., `https://www.youtube.com/watch?v=...`)
2. Click the Music Commentary extension icon in the toolbar
3. The side panel should open showing:
   - Current video title and channel
   - Level selection buttons (Novice/Intermediate/Advanced)
   - Analyze Video button

### Step 4: Verify Functionality

1. Select a level (Novice, Intermediate, or Advanced)
2. Click "Analyze Video"
3. You should see a placeholder commentary message
4. This confirms the extension skeleton is working!

## 🎯 Features (Session 1)

- ✅ Side panel UI that opens on YouTube videos
- ✅ Extracts video title and channel from YouTube page
- ✅ Three education levels: Novice, Intermediate, Advanced
- ✅ Modern, clean UI design
- ✅ Loading states and error handling
- ✅ Placeholder commentary display

## 🔄 Next Steps (Session 2)

The current version is a working skeleton. In Session 2, we'll add:

1. **Supabase Integration**
   - Set up Edge Functions
   - Connect to Supabase backend

2. **Gemini API Integration**
   - Video analysis using Google's Gemini API
   - Generate educational commentary based on selected level

3. **Enhanced Features**
   - Timestamped commentary sections
   - Music theory insights
   - Production technique explanations
   - Interactive timeline integration

## 🐛 Troubleshooting

### Extension won't load
- Check that all files are in the correct locations
- Ensure manifest.json is valid JSON
- Check Chrome DevTools console for errors

### Side panel doesn't open
- Make sure you're on a YouTube video page (`youtube.com/watch`)
- Reload the extension from `chrome://extensions/`
- Check background service worker logs

### Video info not showing
- Refresh the YouTube page
- Check if content script has permission to run
- Open DevTools on the side panel to see console errors

### Icons not displaying
- Ensure icon files are in the `icons/` directory
- Verify file names match manifest.json exactly
- Icons must be PNG format

## 📝 Development Notes

- Built with vanilla JavaScript (no frameworks)
- Manifest V3 (latest Chrome extension standard)
- Uses Chrome Side Panel API
- Content script extracts data from YouTube DOM
- All styling uses CSS custom properties for easy theming

## 🔧 Customization

### Changing Colors
Edit the CSS custom properties in `sidepanel.css`:
```css
:root {
  --primary-color: #6366f1;
  --primary-hover: #4f46e5;
  /* ... more variables */
}
```

### Modifying UI
- Edit `sidepanel.html` for structure
- Edit `sidepanel.css` for styling
- Edit `sidepanel.js` for functionality

## 📄 License

This extension is part of the Music Commentary project.

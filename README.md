# Screenshot & Annotation Chrome Extension

A Chrome extension that allows you to take screenshots and add annotations including arrows, text, shapes, and more.

## Features

- 📸 **Area Selection**: Click and drag to select the area you want to capture (like macOS screenshot tool)
- ➡️ **Arrow Annotations Only**: Add hand-drawn arrow images from the `Hand-drawn arrows` folder
- 👆 **Select Tool**: Click to select annotations for editing
- 🔄 **Rotate**: Rotate annotations using the rotate handle (top center)
- 📏 **Resize**: Resize annotations using corner and edge handles (maintains aspect ratio)
- 🖱️ **Move**: Drag selected annotations to reposition them
- 💾 **Save Functionality**: Download annotated screenshots as PNG files

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the folder containing this extension
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to any webpage you want to screenshot
2. Click the extension icon in your toolbar
3. Click "📸 Capture Screenshot"
4. **Select Area**: Click and drag to select the area you want to capture (like macOS screenshot tool)
   - Release mouse to capture the selected area
   - Press Escape to cancel
5. **Add Arrow Annotations**: 
   - Click the "➡️ Arrow" tool
   - Click anywhere on the screenshot to place an arrow
   - Arrows are randomly selected from the `Hand-drawn arrows` folder
6. **Edit Annotations**: 
   - Click "👆 Select" tool, then click on an arrow to select it
   - Selected arrows show blue handles:
     - **Drag the arrow** to move it
     - **Drag corner/edge handles** to resize (maintains aspect ratio)
     - **Drag the rotate handle** (top center) to rotate
   - Click "🗑️ Delete" to remove selected arrow
7. Click "💾 Save" to download your annotated screenshot
8. Click "✕ Close" to exit annotation mode

## Files Structure

```
screenshot chrome extension/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content.js            # Content script for annotation overlay
├── content.css           # Styles for annotation overlay
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup script
├── Hand-drawn arrows/    # Arrow image assets
│   ├── arrow1.png
│   ├── arrow2.png
│   ├── arrow3.png
│   └── arrow4.png
└── README.md             # This file
```

## Icons

You'll need to add icon files (`icon16.png`, `icon48.png`, `icon128.png`) for the extension. 

**Quick Setup**: Open `create-icons.html` in your browser, right-click each canvas, and save as `icon16.png`, `icon48.png`, and `icon128.png` respectively.

Alternatively, you can:
- Create simple icons using any image editor
- Use online icon generators
- Use placeholder images temporarily

## Permissions

- `activeTab`: To capture screenshots of the current tab
- `storage`: To store extension settings (future use)
- `tabs`: To interact with browser tabs
- `scripting`: To inject content scripts

## Development

To modify the extension:
1. Make your changes to the files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Notes

- The extension uses Manifest V3
- Arrow images are loaded from the `Hand-drawn arrows` folder
- Annotations are drawn on a canvas overlay
- Screenshots are saved as PNG files with timestamp

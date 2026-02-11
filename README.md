# Screenshot & Annotation Chrome Extension

A Chrome extension that allows you to take screenshots and add annotations including arrows, text, shapes, highlights, and more.

## Features

- 📸 **Area Selection**: Click and drag to select the area you want to capture (like macOS screenshot tool)
- ✏️ **Pen Tool**: Draw freehand annotations on your screenshots
- 🖍️ **Highlight Tool**: Add semi-transparent highlight strokes with customizable colors
- 📝 **Text Annotations**: Add text with customizable fonts and colors
- 🔲 **Shape Tools**: Draw rectangles and circles
- 🔒 **Blur Tool**: Blur sensitive information
- ➡️ **Arrow Annotations**: Add hand-drawn arrow images with customizable colors
- 👆 **Select Tool**: Click to select annotations for editing
- 🔄 **Rotate**: Rotate annotations using the rotate handle (top center)
- 📏 **Resize**: Resize annotations using corner and edge handles
- 🖱️ **Move**: Drag selected annotations to reposition them
- ⌨️ **Keyboard Shortcuts**: Customizable keyboard shortcuts for all tools
- ⬆️⬇️⬅️➡️ **Arrow Key Navigation**: Move selected annotations precisely with arrow keys
- ↶↷ **Undo/Redo**: Full history support for all actions
- 💾 **Save & Copy**: Download as PNG or copy to clipboard

## Recent Updates

### Version 2.0 - Keyboard Shortcuts & Movement
- ✨ Added customizable keyboard shortcuts with settings modal
- ✨ Added arrow key navigation for precise positioning (1px/10px modes)
- ✨ Added settings icon (⚙️) to toolbar
- 🎨 Professional settings interface with conflict detection
- 💾 Shortcuts persist via chrome.storage.sync

### Version 1.1 - Highlight Tool & Arrow Colors
- ✨ Added highlight/marker tool with semi-transparent rendering
- ✨ Arrows now support color customization
- ⌨️ Keyboard shortcut 'H' for highlight tool
- 🎨 All 4 arrow styles now respect color picker

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the folder containing this extension
5. The extension icon should appear in your toolbar

## Usage

### Basic Workflow

1. Navigate to any webpage you want to screenshot
2. Click the extension icon in your toolbar
3. Click "📸 Capture Screenshot"
4. **Select Area**: Click and drag to select the area you want to capture
   - Release mouse to capture the selected area
   - Press Escape to cancel
5. **Annotate**: Use the toolbar to add annotations
6. **Save**: Click "💾 Save" to download or "📋 Copy" to clipboard

### Keyboard Shortcuts

| Shortcut | Tool/Action |
|----------|-------------|
| **V** | Select Tool |
| **P** | Pen Tool |
| **H** | Highlight Tool |
| **T** | Text Tool |
| **B** | Blur Tool |
| **R** | Rectangle Tool |
| **C** | Circle Tool |
| **Ctrl+Z** | Undo |
| **Ctrl+Y** | Redo |
| **Ctrl+C** | Copy to Clipboard |
| **Ctrl+S** | Save Screenshot |
| **Delete** | Delete Selected |
| **Arrow Keys** | Move selected annotation (1px) |
| **Shift + Arrows** | Move selected annotation (10px) |

**Customize Shortcuts**: Click the ⚙️ Settings icon in the toolbar!

### Tools Guide

**Pen Tool (P)**
- Draw freehand lines and sketches
- Customizable color and stroke width
- Perfect for quick annotations

**Highlight Tool (H)**
- Semi-transparent highlighting (40% opacity)
- Thicker strokes for emphasis
- Great for marking text

**Text Tool (T)**
- Click to add text annotations
- Double-click to edit existing text
- Customizable font and color

**Blur Tool (B)**
- Draw regions to blur
- Perfect for hiding sensitive information
- Adjustable blur intensity

**Shape Tools (R/C)**
- Rectangle: Draw rectangular outlines
- Circle: Draw circular/elliptical shapes
- Resizable and movable

**Arrow Tool**
- 4 hand-drawn arrow styles
- Customizable colors
- Perfect for pointing to UI elements

**Select Tool (V)**
- Click to select annotations
- Move by dragging
- Resize with corner/edge handles
- Rotate with top handle
- Use arrow keys for precise positioning

## Files Structure

```
screenshot-annotation/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Background service worker
├── content.js                # Content script for annotation overlay
├── content.css               # Styles for annotation overlay
├── popup.html                # Extension popup UI
├── popup.css                 # Popup styles
├── popup.js                  # Popup script
├── hand-drawn-arrows/        # Arrow image assets
│   ├── arrow1.png
│   ├── arrow2.png
│   ├── arrow3.png
│   └── arrow4.png
├── icons/                    # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md                 # This file
├── KEYBOARD_SHORTCUTS_GUIDE.md  # Detailed shortcuts guide
├── USER_GUIDE_HIGHLIGHT.md      # Highlight tool guide
└── TESTING.md                # Testing instructions
```

## Documentation

- **KEYBOARD_SHORTCUTS_GUIDE.md** - Complete guide to keyboard shortcuts customization
- **USER_GUIDE_HIGHLIGHT.md** - Detailed guide for the highlight/marker tool
- **TESTING.md** - Testing procedures and troubleshooting
- **TROUBLESHOOTING.md** - Common issues and solutions

## Permissions

- `activeTab`: To capture screenshots of the current tab
- `storage`: To store keyboard shortcuts and settings
- `tabs`: To interact with browser tabs
- `scripting`: To inject content scripts

## Development

To modify the extension:
1. Make your changes to the files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Browser Compatibility

- ✅ Chrome (Manifest V3)
- ✅ Edge (Chromium-based)
- ✅ Brave
- ⚠️ Opera (with minor adjustments)
- ❌ Firefox (uses different extension API)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - feel free to use and modify for your needs.

## Credits

Extension icon and third-party resources are credited in [CREDITS.md](CREDITS.md).

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Version:** 2.0
**Last Updated:** February 4, 2026
**Developed with:** Claude Code

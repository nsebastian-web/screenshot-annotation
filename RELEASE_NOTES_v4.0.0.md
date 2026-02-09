# Release Notes - Version 4.0.0

**Release Date:** February 9, 2026
**Extension:** Screenshot & Annotate Chrome Extension

---

## 🎉 Major Release: Version 4.0.0

This is a major feature release packed with professional-grade enhancements including adjustable opacity, advanced text formatting, numbered callouts, multi-format export, annotation templates, and much more!

---

## ✨ What's New in v4.0.0

### 🎨 **Line Tool with Arrow Endpoints**
- ✏️ Draw straight lines with customizable arrow endpoints
- ➡️ Toggle arrows at start and/or end of lines
- 🎯 Perfect for creating flowcharts, diagrams, and directional indicators
- ⚙️ Configure arrow endpoints in the Shapes dropdown menu

**How to use:**
1. Select Line tool from Shapes dropdown
2. Check "Start" or "End" boxes to add arrows
3. Draw your line - arrows appear automatically!

### 🌈 **Adjustable Opacity/Transparency**
- 🎚️ Global opacity slider (0-100%) for all annotations
- 💧 Real-time opacity preview
- 🎨 Works with all tools: text, shapes, lines, highlights, arrows, etc.
- 🔄 Individual opacity per annotation

**Features:**
- Slider control in main toolbar
- Default: 100% (fully opaque)
- Works with all annotation types
- Saved with each annotation

### 📏 **Multiple Stroke Width Presets**
- 📊 Quick-select buttons: S, M, L, XL
- 🎯 Widths: 1px, 3px, 5px, 8px
- ⚡ Instant preview and application
- 💾 Remembers last used width per tool

**Usage:**
- Click preset buttons in toolbar
- Applies to: Pen, Lines, Rectangles, Circles
- Visual feedback with active state

### 🎨 **Color Presets & Palette**
- 🌈 8 quick-access color presets
- 🕒 Recently used colors tracking (last 5)
- 🎯 One-click color selection
- 🔄 Integrates with existing color picker

**Default Palette:**
- Red, Green, Blue, Yellow, Magenta, Cyan, Black, White

### 📝 **Text Formatting Enhancements**
- **Bold (B)** - Make text bold and prominent
- **Italic (I)** - Stylize text with italics
- **Underline (U)** - Add underlines to text
- 🎨 All formatting preserved when editing
- 🔄 Toggle buttons in Text dropdown

**How to use:**
1. Select Text tool
2. Open Text dropdown
3. Click B/I/U buttons to toggle formatting
4. Add or edit text with styles applied

### 🔢 **Numbered Callouts**
- 🎯 Auto-numbered circular callouts
- 📍 Perfect for step-by-step tutorials
- 🔄 Counter auto-increments
- 🎨 Customizable color and size
- 💡 Great for guides and instructions

**Features:**
- Click Numbered Callout button (①)
- Numbers increment automatically (1, 2, 3...)
- Moveable and resizable
- Support for rotation

### 💾 **Multi-Format Export**
- **PNG** - Lossless quality (default)
- **JPG** - Compressed format (95% quality)
- **PDF** - Document format with embedded image
- 🎯 Format selector in Save dropdown

**Export Options:**
1. Click Save button dropdown
2. Choose format: PNG, JPG, or PDF
3. File downloads automatically with timestamp

### 📋 **Annotation Templates**
- 💾 Save current annotations as reusable templates
- 📂 Load templates instantly
- 🗑️ Delete unwanted templates
- 💿 Templates persist via Chrome storage
- 🔄 Perfect for recurring annotation patterns

**Workflow:**
1. Create annotations
2. Click Templates button (📋)
3. Save Template - name and save
4. Load anytime from template list
5. Templates sync across browser sessions

---

## 🔧 Technical Improvements

### **Enhanced Rendering Engine**
- Opacity support for all annotation types
- Arrow endpoint rendering with proper angles
- Text formatting (bold, italic, underline) rendering
- Improved performance for complex annotations

### **Storage & Persistence**
- Template storage via chrome.storage.local
- Recent colors tracking
- User preferences preserved

### **Code Quality**
- Modular v3.0 enhancement functions
- Backward compatibility with v2.0 annotations
- Clear code organization with v3.0 markers

---

## 📚 Complete Feature List (All Versions)

### **Annotation Tools** (10 Tools)
1. ✏️ **Pen Tool** - Freehand drawing
2. 🖍️ **Highlight Tool** - Semi-transparent highlighting
3. 📝 **Text Tool** - Text with fonts & formatting
4. ➖ **Line Tool** - Lines with arrow endpoints (NEW!)
5. 🔲 **Rectangle Tool** - Rectangular shapes
6. ⭕ **Circle Tool** - Circular shapes
7. 🔒 **Blur Tool** - Privacy censoring
8. ➡️ **Arrow Tool** - 4 hand-drawn arrow styles
9. 😀 **Emoji Tool** - 10 emoji annotations
10. 🔢 **Callout Tool** - Numbered circles (NEW!)

### **Editing Features**
- 👆 Select, move, resize, rotate
- ⬆️⬇️⬅️➡️ Arrow key navigation (1px/10px)
- 🎨 Opacity control (NEW!)
- 📏 Stroke width presets (NEW!)
- 📝 Text formatting: Bold, Italic, Underline (NEW!)
- 🌈 Color presets & palette (NEW!)

### **Actions & Export**
- ↶↷ Undo/Redo (50 states)
- 💾 Save as PNG/JPG/PDF (NEW!)
- 📋 Copy to clipboard
- 🗑️ Delete & Clear all
- ✂️ Crop screenshot
- 🔍 Zoom (50%-300%)

### **Workflow Features**
- ⌨️ Customizable keyboard shortcuts
- 📋 Annotation templates (NEW!)
- 💿 Chrome storage sync
- ⚙️ Settings modal

---

## 🆕 New UI Elements

### **Toolbar Additions**
- 🎚️ Opacity slider with % display
- 📏 Stroke width preset buttons (S/M/L/XL)
- 🎨 Color palette with 8 presets
- 🔢 Numbered callout button
- 💾 Save format dropdown (PNG/JPG/PDF)
- 📋 Templates button & menu

### **Tool Dropdowns Enhanced**
- **Shapes Dropdown:** Line arrow endpoint toggles
- **Text Dropdown:** Bold, Italic, Underline buttons
- **Save Dropdown:** Format selection (PNG/JPG/PDF)
- **Templates Dropdown:** Save, load, delete templates

---

## 📦 Installation & Upgrade

### **New Installation**
1. Download v3.0.0 release
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select extension folder
6. Extension ready to use!

### **Upgrading from v2.0**
1. Download v3.0.0 release
2. Replace existing extension files
3. Go to `chrome://extensions/`
4. Click reload icon on extension
5. All existing annotations remain compatible
6. New features available immediately!

---

## 🐛 Known Issues & Limitations

### **Current Limitations**
- Freehand and highlight strokes cannot be moved with arrow keys (path-based)
- PDF export is basic (image embedded in PDF structure)
- Templates stored locally per browser profile
- Maximum 50 undo states

### **Browser Compatibility**
- ✅ Chrome (Manifest V3)
- ✅ Edge (Chromium-based)
- ✅ Brave
- ⚠️ Opera (minor adjustments needed)
- ❌ Firefox (different extension API)

---

## 📊 Statistics

**Code Changes:**
- Lines Added: ~800+ lines
- New Functions: 8
- New Event Listeners: 15+
- New CSS Styles: 100+ lines
- Files Modified: 3 (content.js, content.css, manifest.json)

**Feature Count:**
- Total Tools: 10 (was 8)
- Total Features: 35+ (was 25)
- Export Formats: 3 (was 1)

---

## 🚀 Getting Started with v3.0

### **Quick Start Guide**

1. **Try Opacity Control:**
   - Select any annotation
   - Adjust opacity slider
   - See real-time transparency

2. **Use Line Arrows:**
   - Click Shapes → Line
   - Check "End" for arrow
   - Draw directional lines

3. **Format Text:**
   - Select Text tool
   - Click B/I/U buttons
   - Add styled text

4. **Add Numbered Steps:**
   - Click Callout button (①)
   - Click to place numbers
   - Create step-by-step guides

5. **Save as JPG/PDF:**
   - Click Save dropdown
   - Choose format
   - Export instantly

6. **Use Templates:**
   - Create annotations
   - Save as template
   - Reuse anytime

---

## 🔮 Roadmap (Future Versions)

**Planned Features:**
- 🎨 Gradient fill support
- 📐 Polygon & star shapes
- 🔤 Text effects (shadow, outline)
- 📊 Chart annotations
- 🌐 Cloud sync for templates
- 👥 Collaboration features
- 📱 Mobile companion app
- 🎥 Video annotation support

---

## 🙏 Credits & Acknowledgments

**Developed with:**
- Claude Code (AI-assisted development)
- Pure Vanilla JavaScript
- HTML5 Canvas API
- Chrome Extension APIs

**Special Thanks:**
- Users providing feedback
- Open source community
- Chrome extension documentation contributors

---

## 📝 Changelog Summary

**v4.0.0** (2026-02-09)
- ✨ Added line tool with arrow endpoints (start/end toggles)
- ✨ Added global opacity slider (0-100%) for all annotations
- ✨ Added stroke width presets (S/M/L/XL quick-select)
- ✨ Added color presets palette with 8 default colors
- ✨ Added text formatting: Bold, Italic, Underline
- ✨ Added numbered callout tool with auto-increment
- ✨ Added multi-format export: PNG, JPG, PDF
- ✨ Added annotation templates (save/load/delete)
- 🎨 Enhanced rendering with opacity support for all types
- 🎨 Improved line rendering with arrowheads
- 🎨 Enhanced text rendering with formatting styles
- 📚 Added 100+ lines of CSS for new UI elements
- 🔧 Improved code organization with v3.0 markers
- 🔧 Maintained backward compatibility with v2.0
- 📄 Updated manifest to version 4.0.0
- 📝 Comprehensive release documentation

**v2.0.0** (2026-02-05)
- Added customizable keyboard shortcuts
- Added arrow key navigation
- Added highlight/marker tool
- Added arrow color customization

**v1.0.0** (Initial Release)
- Core annotation tools
- Basic screenshot capture
- PNG export

---

## 📞 Support & Feedback

**Issues & Bug Reports:**
- GitHub Issues: https://github.com/nsebastian-web/screenshot-annotation/issues

**Feature Requests:**
- Submit via GitHub Issues with [Feature Request] tag

**Documentation:**
- README.md - Main documentation
- KEYBOARD_SHORTCUTS_GUIDE.md - Keyboard shortcuts
- USER_GUIDE_HIGHLIGHT.md - Highlight tool guide
- TESTING.md - Testing procedures
- TROUBLESHOOTING.md - Common issues

---

## 📄 License

MIT License - Free to use and modify for personal and commercial projects.

---

## 🎊 Thank You!

Thank you for using Screenshot & Annotate v4.0! We hope these powerful new features enhance your productivity and make annotation work more efficient and enjoyable.

**Enjoy the new features!** 📸✨🎨

---

**Version:** 4.0.0
**Build Date:** February 9, 2026
**Release Type:** Stable (Major Feature Release)
**Download:** [GitHub Releases](https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v4.0.0)

---

## 🔄 Migration Notes

**From v2.0 to v4.0:**
- ✅ No breaking changes
- ✅ All v2.0 annotations render correctly
- ✅ Keyboard shortcuts preserved
- ✅ Settings migrated automatically
- 🆕 New features available immediately
- 💡 Opacity defaults to 100% (fully opaque) for existing annotations
- 💡 Line tool now defaults to arrow at end (backward compatible)
- 💡 Text annotations without formatting render normally

**Recommended Actions After Upgrade:**
1. Explore new tools (Callouts, Line Arrows)
2. Experiment with opacity slider
3. Try stroke width presets
4. Create and save your first template
5. Test multi-format export (JPG, PDF)
6. Customize colors with palette

---

**🎉 Enjoy Screenshot & Annotate v4.0.0! 🎉**

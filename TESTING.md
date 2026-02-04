# Testing Guide

## Installation Steps

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/` in Chrome
   - Or go to Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select the folder: `/Users/nikhilsebastian/Desktop/screenshot chrome extension`
   - The extension should appear in your extensions list

4. **Verify Installation**
   - You should see "Screenshot & Annotation Tool" in your extensions
   - The extension icon should appear in your Chrome toolbar

## Testing the Extension

### Basic Functionality Test

1. **Navigate to any webpage** (e.g., https://www.example.com)

2. **Click the extension icon** in your toolbar

3. **Click "📸 Capture Screenshot"**
   - The page should be captured and an annotation overlay should appear

### Annotation Tools Test

1. **Select Tool** (👆 Select)
   - Click on any annotation to select it
   - Selected annotations show blue handles
   - Drag to move
   - Use corner/edge handles to resize
   - Use top-center rotate handle to rotate

2. **Arrow Tool** (➡️ Arrow)
   - Click anywhere on the screenshot
   - An arrow should appear at that location
   - Select it to move, resize, or rotate

3. **Text Tool** (📝 Text)
   - Click to add text
   - Type your text and click "Add"
   - Double-click selected text to edit

4. **Rectangle Tool** (▭ Rectangle)
   - Click and drag to draw a rectangle
   - Select it to modify

5. **Circle Tool** (⭕ Circle)
   - Click and drag to draw a circle
   - Select it to modify

6. **Line Tool** (─ Line)
   - Click and drag to draw a line
   - Select it to modify

### Advanced Features Test

1. **Rotation**
   - Select any annotation
   - Click and drag the rotate handle (top center, above the annotation)
   - The annotation should rotate around its center

2. **Resizing**
   - Select an annotation
   - Drag corner handles to resize proportionally
   - Drag edge handles to resize in one direction
   - For arrows, aspect ratio is maintained

3. **Moving**
   - Select an annotation
   - Click and drag anywhere on the annotation (not on handles)
   - The annotation should move smoothly

4. **Deleting**
   - Select an annotation
   - Click "🗑️ Delete" button
   - The annotation should be removed

5. **Saving**
   - Add some annotations
   - Click "💾 Save"
   - A PNG file should download with all annotations

## Troubleshooting

### Extension doesn't appear
- Make sure Developer mode is enabled
- Check that all files are in the correct folder
- Look for errors in the extensions page (red error messages)

### Screenshot doesn't capture
- Make sure you're on a regular webpage (not chrome:// pages)
- Check browser console for errors (F12)

### Annotations don't appear
- Check that arrow images exist in `Hand-drawn arrows/` folder
- Verify content.js is loaded (check console)

### Icons missing
- Make sure `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` exist
- If missing, use `create-icons.html` to generate them

## Expected Behavior

✅ Screenshot captures the current tab
✅ Overlay appears with toolbar
✅ All tools work correctly
✅ Annotations can be selected, moved, resized, and rotated
✅ Save downloads a PNG file
✅ Close button exits annotation mode

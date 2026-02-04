# Troubleshooting Guide

## Issue: Nothing happens when clicking "📸 Capture Screenshot"

### Step 1: Check Browser Console

1. **Open the extension popup** (click the extension icon)
2. **Right-click in the popup** → "Inspect" or press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. **Click the "📸 Capture Screenshot" button**
4. **Check the Console tab** for any error messages

### Step 2: Check Content Script Console

1. **Navigate to a regular webpage** (e.g., https://www.example.com)
2. **Open Developer Tools** (`F12` or `Cmd+Option+I`)
3. **Go to Console tab**
4. **Click the extension icon and try to capture**
5. **Look for messages** starting with "Content script received message" or "Starting capture..."

### Step 3: Check Background Script

1. Go to `chrome://extensions/`
2. Find "Screenshot & Annotation Tool"
3. Click "service worker" or "background page" link
4. Check the console for errors

### Step 4: Verify Permissions

1. Go to `chrome://extensions/`
2. Find your extension
3. Make sure these permissions are granted:
   - ✅ activeTab
   - ✅ storage
   - ✅ tabs
   - ✅ scripting
   - ✅ windows

### Step 5: Common Issues

#### Issue: "Cannot access chrome:// pages"
**Solution**: Navigate to a regular webpage (not chrome://, chrome-extension://, or edge:// pages)

#### Issue: "Error injecting script"
**Solution**: 
- Make sure you're on a regular webpage
- Try refreshing the page
- Check if the page has Content Security Policy restrictions

#### Issue: "Screenshot capture failed"
**Solution**:
- Make sure the extension has all required permissions
- Try reloading the extension (click the refresh icon in chrome://extensions/)
- Check if you're on a page that blocks screenshots

#### Issue: Content script not receiving messages
**Solution**:
- The content script might not be injected yet
- Try refreshing the webpage
- Check if content.js file exists and is valid

### Step 6: Manual Testing

1. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension

2. **Test on a simple page**:
   - Navigate to https://www.example.com
   - Try capturing again

3. **Check file structure**:
   Make sure all these files exist:
   - ✅ manifest.json
   - ✅ background.js
   - ✅ content.js
   - ✅ content.css
   - ✅ popup.html
   - ✅ popup.js
   - ✅ popup.css
   - ✅ icons/icon16.png
   - ✅ icons/icon48.png
   - ✅ icons/icon128.png
   - ✅ Hand-drawn arrows/arrow1.png (and others)

### Step 7: Debug Mode

Enable verbose logging by checking the browser console. You should see:
- "Capture button clicked" (popup)
- "Content script received message" (content script)
- "Starting capture..." (content script)
- "Requesting screenshot from background..." (content script)
- "Received response from background" (content script)

If any of these messages are missing, that's where the issue is.

### Still Not Working?

1. **Check manifest.json** for syntax errors
2. **Verify all file paths** are correct
3. **Try removing and re-adding** the extension
4. **Check Chrome version** (needs Chrome 88+ for Manifest V3)

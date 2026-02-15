# ⌨️ Keyboard Shortcuts Guide

## Overview

The Screenshot & Annotate extension now includes a powerful keyboard shortcuts customization system. You can use default shortcuts or customize them to match your workflow. Plus, move your annotations precisely with arrow keys!

---

## Quick Start

### Opening Settings

1. Capture a screenshot using the extension
2. Look for the **⚙️ Settings** icon in the toolbar (leftmost icon in action group)
3. Click it to open the Keyboard Shortcuts Settings modal

---

## Default Keyboard Shortcuts

### Tools

| Shortcut | Action | Description |
|----------|--------|-------------|
| **V** | Select Tool | Activate selection mode to move, resize, and rotate annotations |
| **P** | Pen Tool | Draw freehand lines and sketches |
| **H** | Highlight Tool | Draw semi-transparent highlight strokes |
| **T** | Text Tool | Add text annotations |
| **B** | Blur Tool | Create blur regions for censoring |
| **R** | Rectangle Tool | Draw rectangle shapes |
| **C** | Circle Tool | Draw circle/ellipse shapes |

### Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Ctrl+Z** (Cmd+Z on Mac) | Undo | Undo the last action |
| **Ctrl+Y** (Cmd+Shift+Z on Mac) | Redo | Redo the previously undone action |
| **Ctrl+C** (Cmd+C on Mac) | Copy to Clipboard | Copy the annotated screenshot to clipboard |
| **Ctrl+S** (Cmd+S on Mac) | Save Screenshot | Open save dialog to download screenshot |
| **Delete** or **Backspace** | Delete Selected | Delete the currently selected annotation |
| **Escape** | Deselect | Deselect the current annotation |

### Movement (New! 🎉)

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Arrow Keys** | Move 1px | Move selected annotation by 1 pixel in any direction |
| **Shift + Arrow Keys** | Move 10px | Move selected annotation by 10 pixels for faster positioning |

**Note:** Movement works for: Text, Shapes (Rectangle/Circle), Blur, and Arrows. Freehand/Pen and Highlight strokes cannot be moved.

---

## Customizing Shortcuts

### How to Change a Shortcut

1. **Open Settings** - Click the ⚙️ Settings icon
2. **Click Input Field** - Click on the shortcut you want to change
3. **Press New Keys** - The input will show "Press a key..." - now press your desired key combination
4. **Save Changes** - Click "Save Changes" button at the bottom

### Tips for Custom Shortcuts

**Simple Keys**
- Single letter keys (a-z)
- Number keys (0-9)
- Function keys (F1-F12)

**Modifier Combinations**
- Ctrl + Key (Windows/Linux)
- Cmd + Key (Mac)
- Shift + Key
- Alt + Key
- Multiple modifiers (Ctrl+Shift+Key)

**Examples:**
```
Ctrl+P  →  Pen tool
Shift+H →  Highlight tool
Alt+B   →  Blur tool
F1      →  Save
Ctrl+Alt+C → Copy
```

### Conflict Detection

- The system automatically detects conflicting shortcuts
- If you try to assign a shortcut already in use, you'll see: "This shortcut is already used by [action]"
- Choose a different combination to avoid conflicts

### Reset to Defaults

1. Open Settings (⚙️ icon)
2. Click **"Reset to Defaults"** button
3. Confirm the action
4. All shortcuts will return to original values

---

## Arrow Key Navigation

### Basic Movement

**Step 1: Select an Annotation**
- Press **V** or click the Select tool
- Click on any annotation (text, shape, blur, or arrow)
- The annotation will show selection handles

**Step 2: Use Arrow Keys**
- **↑** moves up 1 pixel
- **↓** moves down 1 pixel
- **←** moves left 1 pixel
- **→** moves right 1 pixel

### Fast Movement

Hold **Shift** while pressing arrow keys:
- **Shift + ↑** moves up 10 pixels
- **Shift + ↓** moves down 10 pixels
- **Shift + ←** moves left 10 pixels
- **Shift + →** moves right 10 pixels

### What Can Be Moved?

✅ **Movable Annotations:**
- Text annotations
- Rectangles
- Circles
- Blur regions
- Arrow images

❌ **Non-Movable (Path-Based):**
- Pen/Freehand drawings
- Highlight strokes

*These are drawn as paths and don't have a fixed position*

---

## Practical Use Cases

### 1. Precision Alignment

```
Scenario: You need to perfectly align text with an element
Solution:
1. Add text annotation (T key)
2. Select it (V key)
3. Use arrow keys for pixel-perfect positioning
4. Hold Shift for faster rough positioning
```

### 2. Consistent Spacing

```
Scenario: Create evenly spaced annotations
Solution:
1. Place first annotation
2. Shift+Arrow to move 10px
3. Copy visual spacing for consistency
```

### 3. Custom Workflow

```
Scenario: You're left-handed and want different shortcuts
Solution:
1. Open Settings (⚙️)
2. Remap tools to right side of keyboard (I, O, P, etc.)
3. Save changes
4. Enjoy your custom layout!
```

### 4. Tutorial Creation

```
Scenario: Creating step-by-step tutorials
Solution:
1. Use arrows (default placement)
2. Press V to select
3. Arrow keys to fine-tune position
4. Shift+Arrow for major adjustments
5. Perfect alignment every time!
```

---

## Settings Modal Reference

### Interface Overview

```
┌─────────────────────────────────────┐
│  ⌨️ Keyboard Shortcuts          ✕  │
├─────────────────────────────────────┤
│                                     │
│  Tools                              │
│  ┌─────────────────┬──────────────┐│
│  │ Select Tool     │      V       ││
│  │ Pen Tool        │      P       ││
│  │ Highlight Tool  │      H       ││
│  └─────────────────┴──────────────┘│
│                                     │
│  Actions                            │
│  ┌─────────────────┬──────────────┐│
│  │ Undo            │   Ctrl+Z     ││
│  │ Redo            │   Ctrl+Y     ││
│  └─────────────────┴──────────────┘│
│                                     │
│  Movement                           │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓│
│  ┃ Arrow Keys: Move by 1px       ┃│
│  ┃ Shift + Arrows: Move by 10px  ┃│
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛│
│                                     │
├─────────────────────────────────────┤
│        [Reset to Defaults]  [Save]  │
└─────────────────────────────────────┘
```

### Visual Feedback

**Normal State**
- Input field: Gray background
- Border: Default gray

**Recording State**
- Input field: Darker background
- Border: Red highlight
- Text: "Press a key..."

**Saved State**
- Input field: Shows your custom shortcut
- Text: Formatted (e.g., "Ctrl+P", "Shift+H")

---

## Advanced Tips

### 1. Modifier Key Priority

When recording shortcuts with modifiers:
- Ctrl/Cmd takes precedence
- Then Shift
- Then Alt
- Then the actual key

Example: Pressing Ctrl+Shift+P → Stored as "ctrl+shift+p"

### 2. Special Keys

**Supported:**
- Letters (a-z)
- Numbers (0-9)
- Function keys (F1-F12)
- Arrow keys (for movement only)
- Delete, Backspace, Escape
- Space

**Not Supported as Custom Shortcuts:**
- Tab (browser navigation)
- Enter (used for text input)
- Modifier-only (must include a non-modifier key)

### 3. Persistence

- Shortcuts are saved to Chrome's sync storage
- They persist across browser sessions
- They sync across Chrome instances (if signed in)
- Clearing browser data removes custom shortcuts

### 4. Keyboard Layout Compatibility

- Works with QWERTY, AZERTY, QWERTZ keyboards
- Shortcuts are based on key codes, not character output
- Physical key position matters (not the character)

---

## Troubleshooting

### Shortcut Not Working?

**Check:**
1. ✓ Is text editing active? (Shortcuts disabled during text input)
2. ✓ Did you save changes in settings?
3. ✓ Is there a conflict with browser shortcuts?
4. ✓ Try resetting to defaults

**Solution:**
- Reload the extension at `chrome://extensions/`
- Reopen the settings and verify your shortcuts
- Check browser console (F12) for errors

### Arrow Keys Not Moving Annotation?

**Common Issues:**
1. **No annotation selected**
   - Press V for Select tool
   - Click on an annotation first

2. **Wrong annotation type**
   - Freehand/Highlight cannot be moved
   - Try selecting a text, shape, blur, or arrow

3. **Text editing is active**
   - Press Escape to exit text editing
   - Then select annotation and use arrow keys

### Settings Modal Won't Open?

**Solutions:**
1. Check if another modal is open (filename dialog)
2. Close any open dialogs first
3. Click the ⚙️ icon again
4. Reload the page and try again

### Shortcut Recording Stuck?

**If input shows "Press a key..." but won't accept keys:**
1. Click elsewhere in the settings modal
2. Click the input field again
3. Try pressing Escape to cancel
4. Close and reopen settings

### Changes Not Saving?

**Check:**
1. Did you click "Save Changes"?
2. Is Chrome sync enabled?
3. Check storage permissions in `chrome://extensions/`

**Fix:**
- Ensure extension has storage permission
- Try "Reset to Defaults" then recustomize
- Check if chrome.storage is available

---

## Keyboard Layout Examples

### Default Layout (QWERTY)

```
Tools (Left hand):
Q W E R  ← Rectangle
A S D F
Z X C V  ← Select
     ↑
  T  B  ← Text, Blur
  P     ← Pen
  H     ← Highlight

Actions (Right hand):
    Ctrl+Z  → Undo
    Ctrl+Y  → Redo
    Ctrl+C  → Copy
    Ctrl+S  → Save
```

### Custom Layout Example (Gaming-Style)

```
Tools:
Q - Select
E - Pen
R - Rectangle
F - Highlight
C - Circle
T - Text
B - Blur

Actions:
Z - Undo (no modifier!)
X - Redo
V - Copy
S - Save (no modifier!)
```

### Efficiency Layout (Touch Typist)

```
Home Row Focus:
A - Select
S - Pen
D - Highlight
F - Text

Nearby:
W - Rectangle
E - Circle
R - Blur

Actions:
Keep standard Ctrl combinations
```

---

## Best Practices

### 1. **Start with Defaults**
- Learn the default shortcuts first
- Identify which ones slow you down
- Customize only what you need

### 2. **Group Related Actions**
- Keep tool shortcuts near each other
- Put frequently used tools on easy keys
- Reserve Ctrl combinations for actions

### 3. **Mnemonic Shortcuts**
- P for Pen ✓
- H for Highlight ✓
- T for Text ✓
- B for Blur ✓
- R for Rectangle ✓
- C for Circle ✓

### 4. **Test Before Committing**
- Try new shortcuts for a few minutes
- Make sure they feel natural
- Adjust if reaching feels uncomfortable

### 5. **Document Your Layout**
- Write down custom shortcuts
- Keep them consistent across tools
- Share with team if working collaboratively

---

## FAQ

**Q: Can I use the same shortcut for multiple actions?**
A: No, the system prevents conflicts and will warn you.

**Q: Do shortcuts work when editing text?**
A: No, shortcuts are disabled during text editing to allow normal typing.

**Q: Can I disable a shortcut?**
A: Not currently, but you can assign it to an unlikely key combination (e.g., Ctrl+Alt+Shift+F12).

**Q: Are shortcuts case-sensitive?**
A: No, 'P' and 'p' are treated the same.

**Q: Can I export/import my shortcuts?**
A: Not yet, but they sync via Chrome if you're signed in.

**Q: Do arrow keys work for all annotations?**
A: No, only for movable annotations (text, shapes, blur, arrows). Freehand and highlight are path-based.

**Q: Can I use arrow keys while drawing?**
A: No, arrow keys only work when an annotation is selected (Select tool active).

**Q: What happens if I clear browser data?**
A: Custom shortcuts are stored in chrome.storage.sync. If you clear site data, you'll lose customizations.

**Q: Can I use international keyboard layouts?**
A: Yes! Shortcuts are based on physical key positions, not characters.

---

## Changelog

### Version 2.0 - Keyboard Shortcuts & Movement
- ✨ Added customizable keyboard shortcuts
- ✨ Added settings modal interface
- ✨ Added arrow key navigation (1px/10px modes)
- ✨ Added chrome.storage.sync persistence
- ✨ Added conflict detection
- ✨ Added reset to defaults
- 🎨 Added settings icon to toolbar
- 🐛 Fixed: Shortcuts now respect text editing mode

---

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Reset shortcuts to defaults and test
3. Reload the extension at `chrome://extensions/`
4. Check browser console for errors (F12)
5. Report issues on GitHub

---

**Version:** 2.0
**Last Updated:** 2026-02-04
**Feature:** Keyboard Shortcuts Customization
**Extension:** Screenshot & Annotate Chrome Extension

---

Happy Annotating! ⌨️✨

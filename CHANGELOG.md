# Changelog

All notable changes to the Screenshot & Annotation Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.0] - 2026-02-14

### Added
- Settings page with dedicated UI for configuration management
- Advanced settings panel for customizing extension behavior
- Google Drive folder organization preferences
- Enhanced keyboard shortcuts customization interface
- Professional welcome overlay for first-time users
- Recent uploads section in popup interface
- Quick tips and contextual help

### Changed
- Improved UI/UX with modern design patterns
- Enhanced popup interface with better visual hierarchy
- Optimized settings modal with tabbed navigation
- Better error messaging and user feedback

### Fixed
- Various UI consistency improvements
- Performance optimizations for large screenshots
- Memory management improvements

## [6.0.0] - 2026-02-11

### Added
- Stable Google Drive integration with OAuth 2.0
- Per-user OAuth configuration for multi-user support
- Detailed OAuth debugging and error messages
- Improved redirect handling for authentication flow

### Fixed
- OAuth authentication flow reliability
- Google Drive upload error handling
- Authentication token refresh issues

## [5.0.0] - 2026-02-10

### Added
- Google Drive cloud sharing integration (initial release)
- Auto-upload screenshots to Google Drive
- Folder organization for uploaded screenshots
- Upload history tracking
- QR code generation for shareable links
- Batch operations support
- Multi-format export (PNG, JPG, PDF)

### Changed
- Enhanced sharing capabilities with cloud storage
- Improved file management workflow

## [4.0.0] - 2026-02-09

### Added
- Line tool with customizable arrow endpoints
- Adjustable opacity/transparency slider (0-100%) for all annotations
- Multiple stroke width presets (S, M, L, XL: 1px, 3px, 5px, 8px)
- Color presets palette with 8 quick-access colors
- Recently used colors tracking (last 5 colors)
- Text formatting enhancements: **Bold**, *Italic*, <u>Underline</u>
- Numbered callouts for sequential annotations
- Magnify tool for zooming into specific areas

### Changed
- Enhanced toolbar with quick-access preset buttons
- Improved color picker with preset integration
- Better text editing experience with formatting options

### Fixed
- Arrow dropdown sizing issues
- CSS syntax errors
- UI consistency improvements

## [2.0.0] - 2026-02-05

### Added
- Customizable keyboard shortcuts with settings modal
- Arrow key navigation for precise positioning (1px/10px modes)
- Professional settings interface with conflict detection
- Reset to defaults functionality for shortcuts
- Highlight/marker tool with semi-transparent rendering (40% opacity)
- Arrow color customization for all 4 arrow styles
- Persistent settings via chrome.storage.sync

### Changed
- Enhanced keyboard shortcut system with full customization
- Improved annotation movement with arrow keys
- Better color picker integration for arrows

### Fixed
- Keyboard shortcut conflicts
- Settings persistence across browser sessions

## [1.0.0] - 2026-01-15

### Added
- Initial release with core screenshot functionality
- Area selection capture (macOS-style)
- Full page capture
- Selection mode capture
- Pen tool for freehand drawing
- Text annotations with custom fonts and colors
- Shape tools (rectangles and circles)
- Blur tool for sensitive information
- 4 hand-drawn arrow styles
- Select tool for moving, resizing, and rotating annotations
- Undo/Redo support (50 states)
- Save as PNG
- Copy to clipboard
- Delete and clear all functionality
- Basic keyboard shortcuts (V, P, H, T, B, R, C)

---

## Legend

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

[7.0.0]: https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v7.0.0
[6.0.0]: https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v6.0.0
[5.0.0]: https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v5.0.0
[4.0.0]: https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v4.0.0
[2.0.0]: https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v2.0.0
[1.0.0]: https://github.com/nsebastian-web/screenshot-annotation/releases/tag/v1.0.0

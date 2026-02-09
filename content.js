// Content script for screenshot and annotation overlay

// Prevent multiple script injections - wrap everything in guard
if (!window.screenshotAnnotationScriptLoaded) {
  window.screenshotAnnotationScriptLoaded = true;

let screenshotDataUrl = null;
let annotations = [];
let currentTool = 'select';
let selectedArrowType = null; // Track which arrow is selected
let selectedShapeType = null; // Track which shape is selected (rectangle, circle)
let selectedEmoji = null; // Track which emoji is selected
let selectedAnnotationIndex = -1;
let isDragging = false;
let isResizing = false;
let isRotating = false;
let isDrawingShape = false; // Track if drawing a new shape
let isDrawingFreehand = false; // Track if drawing freehand
let currentFreehandPoints = []; // Points for current freehand drawing
let isDrawingHighlight = false; // Track if drawing highlight
let currentHighlightPoints = []; // Points for current highlight stroke
let shapeStartX = 0;
let shapeStartY = 0;
let resizeHandle = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let hoveredHandle = null; // Track which handle is being hovered
let selectedColor = '#FF0000'; // Default color (red)
let selectedStrokeWidth = 3; // Default stroke width
let highlightBrushSize = 25; // Default highlight brush size (independent from pen)
let blurIntensity = 10; // Default blur intensity/radius
let blurEffectType = 'blur'; // Default blur effect type ('blur' or 'pixelate')
let isTextEditing = false; // Track if text is being edited

// Default keyboard shortcuts configuration
const DEFAULT_SHORTCUTS = {
  selectTool: 'v',
  penTool: 'p',
  highlightTool: 'h',
  textTool: 't',
  blurTool: 'b',
  rectangleTool: 'r',
  circleTool: 'c',
  undo: 'ctrl+z',
  redo: 'ctrl+y',
  copy: 'ctrl+c',
  delete: 'delete',
  escape: 'escape',
  save: 'ctrl+s'
};

// User's custom shortcuts (loaded from storage)
let userShortcuts = { ...DEFAULT_SHORTCUTS };

// Undo/Redo history
let undoHistory = [];
let redoHistory = [];
const MAX_HISTORY = 50; // Limit history size

// Event listener references for cleanup
let documentClickHandler = null;
let documentKeydownHandler = null;

// Redraw optimization
let redrawScheduled = false;
let lastRedrawTime = 0;
const MIN_REDRAW_INTERVAL = 16; // ~60fps cap

// Area selection variables
let isSelectingArea = false;
let isDraggingSelection = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionEndX = 0;
let selectionEndY = 0;
let selectionOverlay = null;

// Crop overlay variables
let isCropping = false;
let cropOverlay = null;
let cropRect = { x: 0, y: 0, width: 0, height: 0 };
let cropDragType = null; // 'move', 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
let cropDragStartX = 0;
let cropDragStartY = 0;
let cropInitialRect = null;
let uncropppedDataUrl = null; // Store original image for cropping

// Arrow images from the hand-drawn-arrows folder
const arrowImages = [
  'arrow1.png',
  'arrow2.png',
  'arrow3.png',
  'arrow4.png'
];

// Cache for loaded arrow images
const arrowImageCache = {};
const arrowImagePromises = {};

// Helper function to get arrow image URL
function getArrowImageURL(arrowName) {
  return chrome.runtime.getURL(`hand-drawn-arrows/${arrowName}`);
}

// Preload arrow images with proper error handling
function preloadArrowImages() {
  arrowImages.forEach(arrowName => {
    const img = new Image();
    const promise = new Promise((resolve, reject) => {
      img.onload = () => {
        arrowImageCache[arrowName] = img;
        console.log(`Preloaded arrow image: ${arrowName}`, img.width, img.height);
        resolve(img);
      };
      img.onerror = (e) => {
        console.error(`Failed to preload arrow image: ${arrowName}`, e);
        console.error(`Failed URL: ${getArrowImageURL(arrowName)}`);
        // Don't reject, just log - images can be loaded later
        resolve(null);
      };
    });
    const url = getArrowImageURL(arrowName);
    console.log(`Preloading arrow image: ${arrowName} from ${url}`);
    img.src = url;
    arrowImagePromises[arrowName] = promise;
    // Store the image object immediately (will be updated on load)
    arrowImageCache[arrowName] = img;
  });
}

// Preload images when content script loads
preloadArrowImages();

// Modern SVG Icons System
const ICONS = {
  select: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M5 12l7-7 7 7"/></svg>`,
  shapes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17" cy="7" r="4"/><path d="M3 17h10l-5 4z"/></svg>`,
  emoji: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  pen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  blur: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  crop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>`,
  zoomIn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  zoomOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  redo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
};

// Helper function to get icon HTML
function getIcon(name, size = 18) {
  const svg = ICONS[name] || ICONS.shapes; // Fallback to shapes if icon not found
  return `<span class="icon-svg" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;">${svg}</span>`;
}

// Helper function to switch to Select tool (global scope for access from all functions)
function switchToSelectTool() {
  selectTool('select');
}

// General tool selection function
function selectTool(toolName) {
  currentTool = toolName;
  selectedArrowType = null;
  selectedShapeType = null;
  hoveredHandle = null;

  // Update UI buttons
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.arrow-btn').forEach(b => b.classList.remove('active'));

  // Also update the Objects dropdown toggle
  const objectsDropdownToggle = document.getElementById('objects-dropdown-toggle');
  if (objectsDropdownToggle) {
    objectsDropdownToggle.classList.remove('active');
  }

  // Activate the correct button
  const toolBtn = document.querySelector(`[data-tool="${toolName}"]`);
  if (toolBtn) toolBtn.classList.add('active');

  // Update canvas cursor and mode
  const canvas = document.getElementById('annotation-canvas');
  if (canvas) {
    // Remove all tool mode classes
    canvas.classList.remove('select-mode', 'pen-mode', 'highlight-mode', 'blur-mode');

    if (toolName === 'select') {
      canvas.classList.add('select-mode');
      canvas.style.cursor = 'default';
    } else if (toolName === 'pen') {
      canvas.classList.add('pen-mode');
      canvas.style.cursor = ''; // Let CSS class handle it
    } else if (toolName === 'highlight') {
      canvas.classList.add('highlight-mode');
      canvas.style.cursor = ''; // Let CSS class handle it
    } else if (toolName === 'blur') {
      canvas.classList.add('blur-mode');
      canvas.style.cursor = ''; // Let CSS class handle it
    } else if (toolName === 'text') {
      canvas.style.cursor = 'text';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }

  // Show/hide color picker based on tool
  const colorGroup = document.querySelector('.color-group');
  if (colorGroup) {
    colorGroup.style.display = (toolName === 'blur') ? 'none' : 'flex';
  }

  redrawAnnotations();
}

// Prevent multiple listeners if script is injected multiple times
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'startCapture') {
      console.log('Starting area selection...');
      try {
        // Cancel any existing area selection
        if (isSelectingArea) {
          cancelAreaSelection();
        }
        startAreaSelection();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error starting area selection:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep channel open for async response
    }
    return false;
  });
  
  // Signal that content script is ready
  console.log('Screenshot annotation content script loaded and ready');

function startAreaSelection() {
  if (isSelectingArea) return;
  
  isSelectingArea = true;
  
  // Create selection overlay (iOS-style)
  const overlay = document.createElement('div');
  overlay.id = 'area-selection-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999998;
    cursor: crosshair;
  `;
  
  const selectionBox = document.createElement('div');
  selectionBox.id = 'selection-box';
  selectionBox.style.cssText = `
    position: absolute;
    border: 2px solid #007AFF;
    background: rgba(0, 122, 255, 0.1);
    pointer-events: none;
    display: none;
    border-radius: 4px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
  `;
  
  const instructions = document.createElement('div');
  instructions.style.cssText = `
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    font-size: 15px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;
  instructions.textContent = 'Drag to select area • Release to capture';
  
  overlay.appendChild(selectionBox);
  overlay.appendChild(instructions);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  selectionOverlay = overlay;
  
  // Mouse events for area selection
  overlay.addEventListener('mousedown', handleSelectionStart);
  overlay.addEventListener('mousemove', handleSelectionMove);
  overlay.addEventListener('mouseup', handleSelectionEnd);
  
  // Cancel on Escape
  document.addEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
  if (e.key === 'Escape' && isSelectingArea) {
    cancelAreaSelection();
  }
}

function handleSelectionStart(e) {
  e.preventDefault();
  e.stopPropagation();
  
  isDraggingSelection = true;
  const rect = selectionOverlay.getBoundingClientRect();
  selectionStartX = e.clientX - rect.left;
  selectionStartY = e.clientY - rect.top;
  selectionEndX = selectionStartX;
  selectionEndY = selectionStartY;
  
  const selectionBox = document.getElementById('selection-box');
  selectionBox.style.display = 'block';
  selectionBox.style.left = selectionStartX + 'px';
  selectionBox.style.top = selectionStartY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
}

function handleSelectionMove(e) {
  if (!isSelectingArea || !isDraggingSelection) return;
  
  const rect = selectionOverlay.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  const selectionBox = document.getElementById('selection-box');
  const left = Math.min(selectionStartX, currentX);
  const top = Math.min(selectionStartY, currentY);
  const width = Math.abs(currentX - selectionStartX);
  const height = Math.abs(currentY - selectionStartY);
  
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
  
  // Show dimension display during selection
  const display = document.getElementById('dimension-display');
  if (display && width > 0 && height > 0) {
    const boxRect = selectionBox.getBoundingClientRect();
    display.style.display = 'block';
    display.style.left = (boxRect.left + boxRect.width / 2) + 'px';
    display.style.top = (boxRect.top - 35) + 'px';
    display.style.transform = 'translateX(-50%)';
    display.textContent = `${Math.round(width)} × ${Math.round(height)}px`;
  }
  
  selectionEndX = currentX;
  selectionEndY = currentY;
}

function handleSelectionEnd(e) {
  if (!isSelectingArea || !isDraggingSelection) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  isDraggingSelection = false;
  hideDimensionDisplay();
  
  const width = Math.abs(selectionEndX - selectionStartX);
  const height = Math.abs(selectionEndY - selectionStartY);
  
  if (width > 10 && height > 10) {
    // Valid selection, capture screenshot
    captureSelectedArea();
  } else {
    // Selection too small, cancel
    cancelAreaSelection();
  }
}

function cancelAreaSelection() {
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
  hideDimensionDisplay();
  document.body.style.overflow = '';
  isSelectingArea = false;
  isDraggingSelection = false;
  document.removeEventListener('keydown', handleEscapeKey);
}

// ==================== CROP OVERLAY FUNCTIONS ====================

function showCropOverlay() {
  console.log('showCropOverlay() called, screenshotDataUrl:', screenshotDataUrl ? 'exists' : 'null');
  isCropping = true;
  uncropppedDataUrl = screenshotDataUrl;

  // Create crop overlay
  cropOverlay = document.createElement('div');
  cropOverlay.id = 'crop-overlay';
  cropOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 1000000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;

  // Create toolbar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    padding: 12px 24px;
    border-radius: 12px;
    display: flex;
    gap: 16px;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 999999;
  `;

  const instructions = document.createElement('span');
  instructions.style.cssText = `
    color: #333;
    font-size: 14px;
    font-weight: 500;
  `;
  instructions.textContent = 'Drag handles to crop • Drag image to reposition';

  const skipBtn = document.createElement('button');
  skipBtn.textContent = 'Skip';
  skipBtn.style.cssText = `
    background: #e0e0e0;
    color: #333;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  `;
  skipBtn.onmouseover = () => skipBtn.style.background = '#d0d0d0';
  skipBtn.onmouseout = () => skipBtn.style.background = '#e0e0e0';
  skipBtn.onclick = skipCrop;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Apply Crop';
  confirmBtn.style.cssText = `
    background: #007AFF;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  `;
  confirmBtn.onmouseover = () => confirmBtn.style.background = '#0056b3';
  confirmBtn.onmouseout = () => confirmBtn.style.background = '#007AFF';
  confirmBtn.onclick = applyCrop;

  toolbar.appendChild(instructions);
  toolbar.appendChild(skipBtn);
  toolbar.appendChild(confirmBtn);

  // Create image container
  const imageContainer = document.createElement('div');
  imageContainer.id = 'crop-image-container';
  imageContainer.style.cssText = `
    position: relative;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create the image
  const img = document.createElement('img');
  img.id = 'crop-source-image';
  img.src = screenshotDataUrl;
  img.style.cssText = `
    max-width: 90vw;
    max-height: 80vh;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  `;

  // Create crop area (will be positioned after image loads)
  const cropArea = document.createElement('div');
  cropArea.id = 'crop-area';
  cropArea.style.cssText = `
    position: absolute;
    border: 2px dashed #007AFF;
    background: transparent;
    cursor: move;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  `;

  // Create resize handles
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  handles.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = 'crop-handle';
    handle.dataset.handle = pos;

    let cursor = 'move';
    if (pos === 'nw' || pos === 'se') cursor = 'nwse-resize';
    else if (pos === 'ne' || pos === 'sw') cursor = 'nesw-resize';
    else if (pos === 'n' || pos === 's') cursor = 'ns-resize';
    else if (pos === 'e' || pos === 'w') cursor = 'ew-resize';

    handle.style.cssText = `
      position: absolute;
      width: 12px;
      height: 12px;
      background: #007AFF;
      border: 2px solid white;
      border-radius: 50%;
      cursor: ${cursor};
      z-index: 10;
    `;

    // Position handles
    if (pos.includes('n')) handle.style.top = '-6px';
    if (pos.includes('s')) handle.style.bottom = '-6px';
    if (pos.includes('w')) handle.style.left = '-6px';
    if (pos.includes('e')) handle.style.right = '-6px';
    if (pos === 'n' || pos === 's') {
      handle.style.left = '50%';
      handle.style.transform = 'translateX(-50%)';
    }
    if (pos === 'e' || pos === 'w') {
      handle.style.top = '50%';
      handle.style.transform = 'translateY(-50%)';
    }
    if (pos === 'nw') { handle.style.top = '-6px'; handle.style.left = '-6px'; }
    if (pos === 'ne') { handle.style.top = '-6px'; handle.style.right = '-6px'; }
    if (pos === 'sw') { handle.style.bottom = '-6px'; handle.style.left = '-6px'; }
    if (pos === 'se') { handle.style.bottom = '-6px'; handle.style.right = '-6px'; }

    cropArea.appendChild(handle);
  });

  // Create dimension display for crop
  const cropDimDisplay = document.createElement('div');
  cropDimDisplay.id = 'crop-dimension-display';
  cropDimDisplay.style.cssText = `
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, monospace;
    white-space: nowrap;
  `;
  cropArea.appendChild(cropDimDisplay);

  imageContainer.appendChild(img);
  imageContainer.appendChild(cropArea);

  cropOverlay.appendChild(toolbar);
  cropOverlay.appendChild(imageContainer);
  document.body.appendChild(cropOverlay);
  document.body.style.overflow = 'hidden';

  // Initialize crop area after image loads
  img.onload = () => {
    const imgRect = img.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();

    // Calculate image position within container
    const imgLeft = (containerRect.width - imgRect.width) / 2;
    const imgTop = (containerRect.height - imgRect.height) / 2;

    // Initialize crop rect to full image
    cropRect = {
      x: 0,
      y: 0,
      width: imgRect.width,
      height: imgRect.height
    };

    updateCropAreaDisplay();
  };

  // Add event listeners
  cropArea.addEventListener('mousedown', handleCropMouseDown);
  document.addEventListener('mousemove', handleCropMouseMove);
  document.addEventListener('mouseup', handleCropMouseUp);
  document.addEventListener('keydown', handleCropKeyDown);
}

function updateCropAreaDisplay() {
  const cropArea = document.getElementById('crop-area');
  const img = document.getElementById('crop-source-image');
  const dimDisplay = document.getElementById('crop-dimension-display');

  if (!cropArea || !img) return;

  const imgRect = img.getBoundingClientRect();
  const container = document.getElementById('crop-image-container');
  const containerRect = container.getBoundingClientRect();

  // Calculate image offset within container
  const imgOffsetX = (containerRect.width - imgRect.width) / 2;
  const imgOffsetY = (containerRect.height - imgRect.height) / 2;

  // Clamp crop rect to image bounds
  cropRect.x = Math.max(0, Math.min(cropRect.x, imgRect.width - 20));
  cropRect.y = Math.max(0, Math.min(cropRect.y, imgRect.height - 20));
  cropRect.width = Math.max(20, Math.min(cropRect.width, imgRect.width - cropRect.x));
  cropRect.height = Math.max(20, Math.min(cropRect.height, imgRect.height - cropRect.y));

  cropArea.style.left = (imgOffsetX + cropRect.x) + 'px';
  cropArea.style.top = (imgOffsetY + cropRect.y) + 'px';
  cropArea.style.width = cropRect.width + 'px';
  cropArea.style.height = cropRect.height + 'px';

  // Update dimension display with actual pixel dimensions
  const scaleX = img.naturalWidth / imgRect.width;
  const scaleY = img.naturalHeight / imgRect.height;
  const actualWidth = Math.round(cropRect.width * scaleX);
  const actualHeight = Math.round(cropRect.height * scaleY);
  dimDisplay.textContent = `${actualWidth} × ${actualHeight}px`;
}

function handleCropMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();

  const handle = e.target.closest('.crop-handle');
  if (handle) {
    cropDragType = handle.dataset.handle;
  } else {
    cropDragType = 'move';
  }

  cropDragStartX = e.clientX;
  cropDragStartY = e.clientY;
  cropInitialRect = { ...cropRect };
}

function handleCropMouseMove(e) {
  if (!cropDragType || !cropInitialRect) return;

  const img = document.getElementById('crop-source-image');
  if (!img) return;

  const imgRect = img.getBoundingClientRect();
  const dx = e.clientX - cropDragStartX;
  const dy = e.clientY - cropDragStartY;

  if (cropDragType === 'move') {
    cropRect.x = Math.max(0, Math.min(cropInitialRect.x + dx, imgRect.width - cropRect.width));
    cropRect.y = Math.max(0, Math.min(cropInitialRect.y + dy, imgRect.height - cropRect.height));
  } else {
    // Handle resize
    let newX = cropInitialRect.x;
    let newY = cropInitialRect.y;
    let newWidth = cropInitialRect.width;
    let newHeight = cropInitialRect.height;

    if (cropDragType.includes('w')) {
      newX = Math.max(0, Math.min(cropInitialRect.x + dx, cropInitialRect.x + cropInitialRect.width - 20));
      newWidth = cropInitialRect.width - (newX - cropInitialRect.x);
    }
    if (cropDragType.includes('e')) {
      newWidth = Math.max(20, Math.min(cropInitialRect.width + dx, imgRect.width - cropInitialRect.x));
    }
    if (cropDragType.includes('n')) {
      newY = Math.max(0, Math.min(cropInitialRect.y + dy, cropInitialRect.y + cropInitialRect.height - 20));
      newHeight = cropInitialRect.height - (newY - cropInitialRect.y);
    }
    if (cropDragType.includes('s')) {
      newHeight = Math.max(20, Math.min(cropInitialRect.height + dy, imgRect.height - cropInitialRect.y));
    }

    cropRect.x = newX;
    cropRect.y = newY;
    cropRect.width = newWidth;
    cropRect.height = newHeight;
  }

  updateCropAreaDisplay();
}

function handleCropMouseUp(e) {
  cropDragType = null;
  cropInitialRect = null;
}

function handleCropKeyDown(e) {
  if (e.key === 'Escape') {
    cancelCrop();
  } else if (e.key === 'Enter') {
    applyCrop();
  }
}

function skipCrop() {
  closeCropOverlay();
  showAnnotationOverlay();
}

function cancelCrop() {
  closeCropOverlay();
  // Reset to uncropped state
  screenshotDataUrl = uncropppedDataUrl;
  uncropppedDataUrl = null;
}

function applyCrop() {
  const img = document.getElementById('crop-source-image');
  if (!img) {
    skipCrop();
    return;
  }

  const imgRect = img.getBoundingClientRect();
  const scaleX = img.naturalWidth / imgRect.width;
  const scaleY = img.naturalHeight / imgRect.height;

  // Create canvas for cropped image
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropRect.width * scaleX);
  canvas.height = Math.round(cropRect.height * scaleY);
  const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  ctx.imageSmoothingEnabled = false;

  // Draw cropped portion
  ctx.drawImage(
    img,
    Math.round(cropRect.x * scaleX),
    Math.round(cropRect.y * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Update screenshot data URL
  screenshotDataUrl = canvas.toDataURL('image/png');
  uncropppedDataUrl = null;

  closeCropOverlay();
  showAnnotationOverlay();
}

function closeCropOverlay() {
  if (cropOverlay) {
    cropOverlay.remove();
    cropOverlay = null;
  }
  document.body.style.overflow = '';
  isCropping = false;
  document.removeEventListener('mousemove', handleCropMouseMove);
  document.removeEventListener('mouseup', handleCropMouseUp);
  document.removeEventListener('keydown', handleCropKeyDown);
}

// ==================== END CROP OVERLAY FUNCTIONS ====================

async function captureSelectedArea() {
  // Get selection coordinates relative to viewport
  const selectionBox = document.getElementById('selection-box');
  const boxRect = selectionBox.getBoundingClientRect();

  // Remove selection overlay BEFORE capturing
  cancelAreaSelection();

  // Wait for the overlay to be fully removed from the DOM and screen repainted
  // Using multiple rAF frames + small timeout to ensure browser has fully rendered
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Additional small delay to ensure the repaint is complete
        setTimeout(resolve, 50);
      });
    });
  });

  // Capture full screenshot (overlay should now be completely gone)
  chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
    
    if (chrome.runtime.lastError) {
      console.error('Error capturing screenshot:', chrome.runtime.lastError);
      alert('Error capturing screenshot: ' + chrome.runtime.lastError.message);
      isSelectingArea = false;
      return;
    }
    
    if (response && response.success) {
      // Crop to selected area
      const img = new Image();
      img.onload = () => {
        // Calculate scale factor (screenshot might be different size than viewport due to DPI)
        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        // Use native resolution for best quality
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(boxRect.width * scaleX);
        canvas.height = Math.round(boxRect.height * scaleY);
        // Use alpha:false for opaque screenshots (better color accuracy)
        const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });

        // Disable image smoothing for pixel-perfect capture
        ctx.imageSmoothingEnabled = false;

        // Draw cropped area at native resolution
        ctx.drawImage(
          img,
          Math.round(boxRect.left * scaleX),
          Math.round(boxRect.top * scaleY),
          Math.round(boxRect.width * scaleX),
          Math.round(boxRect.height * scaleY),
          0,
          0,
          canvas.width,
          canvas.height
        );

        // Convert to data URL - PNG doesn't use quality parameter but keeping for clarity
        screenshotDataUrl = canvas.toDataURL('image/png');
        showCropOverlay();
      };
      img.src = response.dataUrl;
    } else {
      console.error('Screenshot capture failed:', response);
      alert('Failed to capture screenshot. ' + (response?.error || 'Unknown error'));
      isSelectingArea = false;
    }
  });
}

function showAnnotationOverlay() {
  // Cancel any active area selection
  if (isSelectingArea) {
    cancelAreaSelection();
  }
  
  // Remove existing overlay if any
  const existingOverlay = document.getElementById('screenshot-annotation-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create dimension display element
  const dimensionDisplay = document.createElement('div');
  dimensionDisplay.id = 'dimension-display';
  document.body.appendChild(dimensionDisplay);
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'screenshot-annotation-overlay';
  overlay.innerHTML = `
    <div class="annotation-container">
      <div class="annotation-toolbar">
        <div class="tool-group">
          <!-- Select Tool (First) -->
          <button class="tool-btn active" data-tool="select" title="Select (V)">
            ${getIcon('select', 16)}
          </button>

          <!-- Arrow Dropdown -->
          <div class="dropdown-container">
            <button class="tool-btn dropdown-toggle" id="arrow-dropdown-toggle" title="Arrows">
              ${getIcon('arrow', 16)}
            </button>
            <div class="dropdown-menu dropdown-horizontal" id="arrow-dropdown-menu">
              <button class="dropdown-item arrow-item" data-arrow="arrow1.png" title="Arrow 1">
                <img src="${getArrowImageURL('arrow1.png')}" alt="Arrow 1" />
              </button>
              <button class="dropdown-item arrow-item" data-arrow="arrow2.png" title="Arrow 2">
                <img src="${getArrowImageURL('arrow2.png')}" alt="Arrow 2" />
              </button>
              <button class="dropdown-item arrow-item" data-arrow="arrow3.png" title="Arrow 3">
                <img src="${getArrowImageURL('arrow3.png')}" alt="Arrow 3" />
              </button>
              <button class="dropdown-item arrow-item" data-arrow="arrow4.png" title="Arrow 4">
                <img src="${getArrowImageURL('arrow4.png')}" alt="Arrow 4" />
              </button>
            </div>
          </div>

          <!-- Shapes Dropdown -->
          <div class="dropdown-container">
            <button class="tool-btn dropdown-toggle" id="shapes-dropdown-toggle" title="Shapes">
              ${getIcon('shapes', 16)}
            </button>
            <div class="dropdown-menu dropdown-horizontal" id="shapes-dropdown-menu">
              <button class="dropdown-item" data-tool="line" title="Line">—</button>
              <button class="dropdown-item" data-tool="rectangle" title="Rectangle">▭</button>
              <button class="dropdown-item" data-tool="filled-rectangle" title="Filled Rectangle">◼</button>
              <button class="dropdown-item" data-tool="circle" title="Circle">○</button>
              <button class="dropdown-item" data-tool="filled-circle" title="Filled Circle">●</button>
            </div>
          </div>

          <!-- Emoji Dropdown -->
          <div class="dropdown-container">
            <button class="tool-btn dropdown-toggle" id="emoji-dropdown-toggle" title="Emoji">
              ${getIcon('emoji', 16)}
            </button>
            <div class="dropdown-menu dropdown-horizontal" id="emoji-dropdown-menu">
              <button class="dropdown-item emoji-item" data-emoji="😀" title="Smile">😀</button>
              <button class="dropdown-item emoji-item" data-emoji="😂" title="Laugh">😂</button>
              <button class="dropdown-item emoji-item" data-emoji="❤️" title="Heart">❤️</button>
              <button class="dropdown-item emoji-item" data-emoji="👍" title="Thumbs Up">👍</button>
              <button class="dropdown-item emoji-item" data-emoji="⭐" title="Star">⭐</button>
              <button class="dropdown-item emoji-item" data-emoji="✅" title="Check">✅</button>
              <button class="dropdown-item emoji-item" data-emoji="❌" title="X">❌</button>
              <button class="dropdown-item emoji-item" data-emoji="⚠️" title="Warning">⚠️</button>
              <button class="dropdown-item emoji-item" data-emoji="💡" title="Idea">💡</button>
              <button class="dropdown-item emoji-item" data-emoji="📌" title="Pin">📌</button>
            </div>
          </div>

          <!-- Pen Tool -->
          <button class="tool-btn" data-tool="pen" title="Pen (P)">
            ${getIcon('pen', 16)}
          </button>

          <!-- Highlight Tool Dropdown -->
          <div class="dropdown-container">
            <button class="tool-btn dropdown-toggle" id="highlight-dropdown-toggle" title="Highlight (H)">
              🖍️
            </button>
            <div class="dropdown-menu dropdown-horizontal" id="highlight-dropdown-menu" style="min-width: 180px;">
              <div class="dropdown-section">
                <label>Brush Size</label>
                <input type="range" id="highlight-brush-size" min="10" max="50" value="25" step="1"
                       style="width: 120px; cursor: pointer;" />
                <span id="brush-size-display" style="font-size: 11px; color: #fff; margin-left: 4px;">25px</span>
              </div>
            </div>
          </div>

          <!-- Text Tool Dropdown -->
          <div class="dropdown-container">
            <button class="tool-btn dropdown-toggle" id="text-dropdown-toggle" title="Text (T)">
              ${getIcon('text', 16)}
            </button>
            <div class="dropdown-menu dropdown-horizontal" id="text-dropdown-menu" style="min-width: 200px;">
              <div class="dropdown-section">
                <label>Font Family</label>
                <select id="font-family-select">
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>
              <div class="dropdown-section">
                <label>Font Size</label>
                <select id="font-size-select">
                  <option value="8">8px</option>
                  <option value="10">10px</option>
                  <option value="12">12px</option>
                  <option value="14">14px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                  <option value="20">20px</option>
                  <option value="24" selected>24px</option>
                  <option value="28">28px</option>
                  <option value="32">32px</option>
                  <option value="36">36px</option>
                  <option value="48">48px</option>
                  <option value="60">60px</option>
                  <option value="72">72px</option>
                  <option value="96">96px</option>
                  <option value="144">144px</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Blur Tool Dropdown -->
          <div class="dropdown-container">
            <button class="tool-btn dropdown-toggle" id="blur-dropdown-toggle" title="Blur (B)">
              ${getIcon('blur', 16)}
            </button>
            <div class="dropdown-menu dropdown-horizontal" id="blur-dropdown-menu" style="min-width: 280px;">
              <div class="dropdown-section">
                <label>Effect Type</label>
                <select id="blur-effect-type" style="width: 100px; padding: 4px 6px; background: #2d2d2d; color: #fff; border: 1px solid #4a4a4a; border-radius: 4px; font-size: 11px; cursor: pointer;">
                  <option value="blur">Smooth Blur</option>
                  <option value="pixelate">Pixelate</option>
                </select>
              </div>
              <div class="dropdown-section">
                <label>Intensity</label>
                <input type="range" id="blur-intensity" min="5" max="30" value="10" step="1"
                       style="width: 100px; cursor: pointer;" />
                <span id="blur-intensity-display" style="font-size: 11px; color: #fff; margin-left: 4px;">10px</span>
              </div>
            </div>
          </div>

          <!-- Crop Tool -->
          <button class="tool-btn" id="cropBtn" title="Crop">
            ${getIcon('crop', 16)}
          </button>
        </div>

        <!-- Zoom Group -->
        <div class="zoom-group">
          <button class="action-btn icon-btn" id="zoomOutBtn" title="Zoom Out">
            ${getIcon('zoomOut', 16)}
          </button>
          <span id="zoom-display">100%</span>
          <button class="action-btn icon-btn" id="zoomInBtn" title="Zoom In">
            ${getIcon('zoomIn', 16)}
          </button>
        </div>

        <!-- Color Picker -->
        <div class="color-group">
          <label for="color-picker" class="color-label">Color:</label>
          <input type="color" id="color-picker" value="${selectedColor}" />
        </div>

        <!-- Action Buttons -->
        <div class="action-group">
          <button class="action-btn icon-btn" id="undoBtn" title="Undo (Ctrl+Z)" disabled>
            ${getIcon('undo', 16)}
          </button>
          <button class="action-btn icon-btn" id="redoBtn" title="Redo (Ctrl+Y)" disabled>
            ${getIcon('redo', 16)}
          </button>
          <button class="action-btn icon-btn" id="copyBtn" title="Copy (Ctrl+C)">
            ${getIcon('copy', 16)}
          </button>
          <button class="action-btn" id="clearBtn" title="Clear All">
            ${getIcon('clear', 14)} Clear
          </button>
          <button class="action-btn" id="saveAsBtn" title="Save">
            ${getIcon('save', 14)} Save
          </button>
          <button class="action-btn" id="closeBtn" title="Close">
            ${getIcon('close', 14)}
          </button>
        </div>

        <!-- Settings Button -->
        <button class="action-btn icon-btn" id="settingsBtn" title="Settings">
          ${getIcon('settings', 16)}
        </button>
      </div>
      <div class="screenshot-canvas-container">
        <img id="screenshot-img" src="${screenshotDataUrl}" alt="Screenshot" />
        <canvas id="annotation-canvas"></canvas>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  // Create filename input container (outside overlay for proper z-index)
  const filenameContainer = document.createElement('div');
  filenameContainer.id = 'filename-input-container';
  filenameContainer.innerHTML = `
    <label for="filename-input">Filename:</label>
    <input type="text" id="filename-input" placeholder="Enter filename..." />
    <div style="display: flex; gap: 8px; margin-top: 8px;">
      <button id="filename-confirm" style="flex: 1;">Save</button>
      <button id="filename-cancel" style="flex: 1;">Cancel</button>
    </div>
  `;
  document.body.appendChild(filenameContainer);

  // Create settings modal
  const settingsModal = document.createElement('div');
  settingsModal.id = 'keyboard-settings-modal';
  settingsModal.innerHTML = `
    <div class="settings-modal-content">
      <div class="settings-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button class="settings-close" id="settings-close-btn">✕</button>
      </div>
      <div class="settings-body">
        <div class="settings-section">
          <h3>Tools</h3>
          <div class="shortcut-row">
            <label>Select Tool</label>
            <input type="text" id="shortcut-selectTool" class="shortcut-input" placeholder="v" readonly />
          </div>
          <div class="shortcut-row">
            <label>Pen Tool</label>
            <input type="text" id="shortcut-penTool" class="shortcut-input" placeholder="p" readonly />
          </div>
          <div class="shortcut-row">
            <label>Highlight Tool</label>
            <input type="text" id="shortcut-highlightTool" class="shortcut-input" placeholder="h" readonly />
          </div>
          <div class="shortcut-row">
            <label>Text Tool</label>
            <input type="text" id="shortcut-textTool" class="shortcut-input" placeholder="t" readonly />
          </div>
          <div class="shortcut-row">
            <label>Blur Tool</label>
            <input type="text" id="shortcut-blurTool" class="shortcut-input" placeholder="b" readonly />
          </div>
          <div class="shortcut-row">
            <label>Rectangle Tool</label>
            <input type="text" id="shortcut-rectangleTool" class="shortcut-input" placeholder="r" readonly />
          </div>
          <div class="shortcut-row">
            <label>Circle Tool</label>
            <input type="text" id="shortcut-circleTool" class="shortcut-input" placeholder="c" readonly />
          </div>
        </div>
        <div class="settings-section">
          <h3>Actions</h3>
          <div class="shortcut-row">
            <label>Undo</label>
            <input type="text" id="shortcut-undo" class="shortcut-input" placeholder="Ctrl+Z" readonly />
          </div>
          <div class="shortcut-row">
            <label>Redo</label>
            <input type="text" id="shortcut-redo" class="shortcut-input" placeholder="Ctrl+Y" readonly />
          </div>
          <div class="shortcut-row">
            <label>Copy to Clipboard</label>
            <input type="text" id="shortcut-copy" class="shortcut-input" placeholder="Ctrl+C" readonly />
          </div>
          <div class="shortcut-row">
            <label>Delete Selected</label>
            <input type="text" id="shortcut-delete" class="shortcut-input" placeholder="Delete" readonly />
          </div>
          <div class="shortcut-row">
            <label>Save Screenshot</label>
            <input type="text" id="shortcut-save" class="shortcut-input" placeholder="Ctrl+S" readonly />
          </div>
          <div class="shortcut-row">
            <label>Deselect (Escape)</label>
            <input type="text" id="shortcut-escape" class="shortcut-input" placeholder="Escape" readonly />
          </div>
        </div>
        <div class="settings-section">
          <h3>Movement</h3>
          <div class="shortcut-info">
            <p><strong>Arrow Keys:</strong> Move selected annotation by 1px</p>
            <p><strong>Shift + Arrow Keys:</strong> Move selected annotation by 10px</p>
          </div>
        </div>
      </div>
      <div class="settings-footer">
        <button class="settings-btn" id="settings-reset-btn">Reset to Defaults</button>
        <button class="settings-btn primary" id="settings-save-btn">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(settingsModal);

  // Setup canvas
  const img = document.getElementById('screenshot-img');
  const canvas = document.getElementById('annotation-canvas');
  const ctx = canvas.getContext('2d');
  
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    // Preload all arrow images when screenshot loads
    arrowImages.forEach(arrowName => {
      const arrowImg = new Image();
      arrowImg.onload = () => {
        arrowImageCache[arrowName] = arrowImg;
        console.log(`Arrow preloaded in overlay: ${arrowName}`, arrowImg.width, arrowImg.height);
        // Redraw if this arrow is being used
        const hasThisArrow = annotations.some(a => a.arrowImage === arrowName);
        if (hasThisArrow) {
          setTimeout(() => redrawAnnotations(), 50);
        }
      };
      arrowImg.onerror = () => {
        console.error(`Failed to preload arrow in overlay: ${arrowName}`);
      };
      arrowImg.src = getArrowImageURL(arrowName);
      // Store immediately
      if (!arrowImageCache[arrowName] || !arrowImageCache[arrowName].complete) {
        arrowImageCache[arrowName] = arrowImg;
      }
    });
    redrawAnnotations();
  };
  
  // Color picker
  const colorPicker = document.getElementById('color-picker');
  let colorChangeTimeout = null;
  colorPicker.addEventListener('input', (e) => {
    selectedColor = e.target.value;
    // Update selected annotation color if one is selected
    if (selectedAnnotationIndex >= 0 && annotations[selectedAnnotationIndex]) {
      const annotation = annotations[selectedAnnotationIndex];
      // Update color for all colorable annotation types
      const colorableTypes = ['text', 'line', 'rectangle', 'circle', 'filled-rectangle', 'filled-circle', 'arrow', 'freehand', 'highlight'];
      if (colorableTypes.includes(annotation.type)) {
        annotation.color = selectedColor;
        redrawAnnotations();

        // Debounce saveState for color changes (save after user stops dragging)
        clearTimeout(colorChangeTimeout);
        colorChangeTimeout = setTimeout(() => {
          saveState();
        }, 300);
      }
    }
  });
  
  // Arrow dropdown toggle
  const arrowDropdownToggle = document.getElementById('arrow-dropdown-toggle');
  const arrowDropdownMenu = document.getElementById('arrow-dropdown-menu');

  if (arrowDropdownToggle && arrowDropdownMenu) {
    arrowDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      arrowDropdownMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== arrowDropdownMenu) menu.classList.remove('show');
      });
    });
  }

  // Shapes dropdown toggle
  const shapesDropdownToggle = document.getElementById('shapes-dropdown-toggle');
  const shapesDropdownMenu = document.getElementById('shapes-dropdown-menu');

  if (shapesDropdownToggle && shapesDropdownMenu) {
    shapesDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      shapesDropdownMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== shapesDropdownMenu) menu.classList.remove('show');
      });
    });
  }

  // Emoji dropdown toggle
  const emojiDropdownToggle = document.getElementById('emoji-dropdown-toggle');
  const emojiDropdownMenu = document.getElementById('emoji-dropdown-menu');

  if (emojiDropdownToggle && emojiDropdownMenu) {
    emojiDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiDropdownMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== emojiDropdownMenu) menu.classList.remove('show');
      });
    });
  }

  // Text dropdown toggle
  const textDropdownToggle = document.getElementById('text-dropdown-toggle');
  const textDropdownMenu = document.getElementById('text-dropdown-menu');

  if (textDropdownToggle && textDropdownMenu) {
    textDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle text tool first
      currentTool = 'text';
      selectedAnnotationIndex = -1;
      canvas.style.cursor = 'text';
      canvas.classList.remove('select-mode');

      // Update button states
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-toggle').forEach(b => b.classList.remove('active'));
      textDropdownToggle.classList.add('active');

      // Toggle dropdown
      textDropdownMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== textDropdownMenu) menu.classList.remove('show');
      });
    });
  }

  // Highlight dropdown toggle
  const highlightDropdownToggle = document.getElementById('highlight-dropdown-toggle');
  const highlightDropdownMenu = document.getElementById('highlight-dropdown-menu');
  const highlightBrushSizeSlider = document.getElementById('highlight-brush-size');
  const brushSizeDisplay = document.getElementById('brush-size-display');

  if (highlightDropdownToggle && highlightDropdownMenu) {
    highlightDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle highlight tool first
      currentTool = 'highlight';
      selectedAnnotationIndex = -1;
      canvas.classList.remove('select-mode', 'pen-mode');
      canvas.classList.add('highlight-mode');
      canvas.style.cursor = ''; // Let CSS class handle it

      // Update button states
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-toggle').forEach(b => b.classList.remove('active'));
      highlightDropdownToggle.classList.add('active');

      // Toggle dropdown
      highlightDropdownMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== highlightDropdownMenu) menu.classList.remove('show');
      });
    });
  }

  // Highlight brush size slider
  if (highlightBrushSizeSlider && brushSizeDisplay) {
    highlightBrushSizeSlider.addEventListener('input', (e) => {
      highlightBrushSize = parseInt(e.target.value);
      brushSizeDisplay.textContent = `${highlightBrushSize}px`;
    });
  }

  // Blur dropdown toggle
  const blurDropdownToggle = document.getElementById('blur-dropdown-toggle');
  const blurDropdownMenu = document.getElementById('blur-dropdown-menu');
  const blurIntensitySlider = document.getElementById('blur-intensity');
  const blurIntensityDisplay = document.getElementById('blur-intensity-display');

  if (blurDropdownToggle && blurDropdownMenu) {
    blurDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle blur tool first
      currentTool = 'blur';
      selectedAnnotationIndex = -1;
      canvas.classList.remove('select-mode', 'pen-mode', 'highlight-mode');
      canvas.classList.add('blur-mode');
      canvas.style.cursor = ''; // Let CSS class handle it

      // Update button states
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-toggle').forEach(b => b.classList.remove('active'));
      blurDropdownToggle.classList.add('active');

      // Toggle dropdown
      blurDropdownMenu.classList.toggle('show');
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== blurDropdownMenu) menu.classList.remove('show');
      });

      // Hide color picker for blur tool
      const colorGroup = document.querySelector('.color-group');
      if (colorGroup) {
        colorGroup.style.display = 'none';
      }
    });
  }

  // Blur intensity slider
  if (blurIntensitySlider && blurIntensityDisplay) {
    blurIntensitySlider.addEventListener('input', (e) => {
      blurIntensity = parseInt(e.target.value);
      blurIntensityDisplay.textContent = `${blurIntensity}px`;
    });
  }

  // Blur effect type selector
  const blurEffectTypeSelect = document.getElementById('blur-effect-type');
  if (blurEffectTypeSelect) {
    blurEffectTypeSelect.addEventListener('change', (e) => {
      blurEffectType = e.target.value;
    });
  }

  // Close all dropdowns when clicking outside
  documentClickHandler = (e) => {
    const clickedInsideDropdown = e.target.closest('.dropdown-container');
    if (!clickedInsideDropdown) {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  };
  document.addEventListener('click', documentClickHandler);
  
  // Tool selection (simple tool buttons and shape dropdown items)
  document.querySelectorAll('.tool-btn:not(.dropdown-toggle), .dropdown-item[data-tool]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tool = btn.dataset.tool;
      if (!tool) return;

      // Update active states
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-toggle').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));

      // Set active state
      if (btn.classList.contains('dropdown-item')) {
        btn.classList.add('active');
        // Activate the parent dropdown toggle
        if (shapesDropdownToggle && btn.closest('#shapes-dropdown-menu')) {
          shapesDropdownToggle.classList.add('active');
        }
        // Close dropdown
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
      } else {
        btn.classList.add('active');
      }

      currentTool = tool;
      selectedAnnotationIndex = -1;
      selectedArrowType = null;
      selectedEmoji = null;
      hoveredHandle = null;
      isTextEditing = false;

      // Update canvas cursor
      // Remove all tool mode classes
      canvas.classList.remove('select-mode', 'pen-mode', 'highlight-mode', 'blur-mode');

      if (currentTool === 'select') {
        canvas.classList.add('select-mode');
        canvas.style.cursor = 'default';
      } else if (currentTool === 'text') {
        canvas.style.cursor = 'text';
      } else if (currentTool === 'pen') {
        canvas.classList.add('pen-mode');
        canvas.style.cursor = ''; // Let CSS class handle it
      } else if (currentTool === 'highlight') {
        canvas.classList.add('highlight-mode');
        canvas.style.cursor = ''; // Let CSS class handle it
      } else if (currentTool === 'blur') {
        canvas.classList.add('blur-mode');
        canvas.style.cursor = ''; // Let CSS class handle it
      } else {
        canvas.style.cursor = 'crosshair';
      }

      // Update color picker visibility (hide for blur tool)
      const colorGroup = document.querySelector('.color-group');
      if (colorGroup) {
        colorGroup.style.display = (currentTool === 'blur') ? 'none' : 'flex';
      }

      redrawAnnotations();
    });
  });

  // Arrow selection from dropdown
  document.querySelectorAll('.arrow-item[data-arrow]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const arrowType = e.currentTarget.dataset.arrow;

      // Set arrow tool active
      selectedArrowType = arrowType;
      currentTool = 'arrow';
      selectedAnnotationIndex = -1;

      // Update active states
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-toggle').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      if (arrowDropdownToggle) {
        arrowDropdownToggle.classList.add('active');
      }

      // Close dropdown
      if (arrowDropdownMenu) {
        arrowDropdownMenu.classList.remove('show');
      }

      canvas.classList.remove('select-mode');
      canvas.style.cursor = 'crosshair';
      redrawAnnotations();
    });
  });

  // Emoji selection from dropdown
  document.querySelectorAll('.emoji-item[data-emoji]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const emoji = e.currentTarget.dataset.emoji;

      // Set emoji tool active
      selectedEmoji = emoji;
      currentTool = 'emoji';
      selectedAnnotationIndex = -1;

      // Update active states
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-toggle').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      if (emojiDropdownToggle) {
        emojiDropdownToggle.classList.add('active');
      }

      // Close dropdown
      if (emojiDropdownMenu) {
        emojiDropdownMenu.classList.remove('show');
      }

      canvas.classList.remove('select-mode');
      canvas.style.cursor = 'crosshair';
      redrawAnnotations();
    });
  });

  // Font family and size controls
  const fontFamilySelect = document.getElementById('font-family-select');
  const fontSizeSelect = document.getElementById('font-size-select');

  if (fontFamilySelect) {
    fontFamilySelect.addEventListener('change', (e) => {
      // Update selected text annotation if any
      if (selectedAnnotationIndex >= 0 && annotations[selectedAnnotationIndex]) {
        const annotation = annotations[selectedAnnotationIndex];
        if (annotation.type === 'text') {
          annotation.fontFamily = e.target.value;
          redrawAnnotations();
          saveState();
        }
      }
    });
  }

  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
      // Update selected text annotation if any
      if (selectedAnnotationIndex >= 0 && annotations[selectedAnnotationIndex]) {
        const annotation = annotations[selectedAnnotationIndex];
        if (annotation.type === 'text') {
          annotation.fontSize = parseInt(e.target.value);
          redrawAnnotations();
          saveState();
        }
      }
    });
  }

  // Crop button
  const cropBtn = document.getElementById('cropBtn');
  if (cropBtn) {
    console.log('✓ Crop button found, attaching event listener');
    cropBtn.addEventListener('click', (e) => {
      console.log('Crop button clicked!');
      e.preventDefault();
      e.stopPropagation();
      // Show crop overlay (reusing existing crop functionality)
      try {
        showCropOverlay();
        console.log('✓ showCropOverlay() called successfully');
      } catch (error) {
        console.error('✗ Error calling showCropOverlay():', error);
      }
    });
  } else {
    console.error('✗ Crop button not found!');
  }

  // Zoom controls - will implement zoom functionality
  let zoomLevel = 1.0;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3.0;
  const ZOOM_STEP = 0.25;

  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomDisplay = document.getElementById('zoom-display');

  function updateZoomDisplay() {
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
  }

  function applyZoom() {
    const container = document.querySelector('.screenshot-canvas-container');
    if (container) {
      container.style.transform = `scale(${zoomLevel})`;
      container.style.transformOrigin = 'center center';
    }
    updateZoomDisplay();
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      zoomLevel = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
      applyZoom();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      zoomLevel = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
      applyZoom();
    });
  }

  // Continue with old arrow button code for backwards compatibility
  document.querySelectorAll('.arrow-btn').forEach(btn => {
    const img = btn.querySelector('.arrow-preview');
    if (img) {
      img.onerror = () => {
        // If image fails to load, show arrow number instead
        const arrowNum = btn.dataset.arrow.replace('arrow', '').replace('.png', '');
        btn.textContent = arrowNum;
        btn.style.fontSize = '16px';
        btn.style.fontWeight = 'bold';
      };
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const arrowType = e.currentTarget.dataset.arrow;

      // Toggle arrow selection
      if (selectedArrowType === arrowType) {
        // Deselect if clicking same arrow
        selectedArrowType = null;
        currentTool = 'select';
        document.querySelectorAll('.arrow-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const selectBtn = document.querySelector('[data-tool="select"]');
        if (selectBtn) selectBtn.classList.add('active');
        canvas.classList.add('select-mode');
        canvas.style.cursor = 'default';
        hoveredHandle = null;
      } else {
        // Select new arrow
        selectedArrowType = arrowType;
        currentTool = 'arrow';
        document.querySelectorAll('.arrow-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        canvas.classList.remove('select-mode');
        canvas.style.cursor = 'crosshair';
        hoveredHandle = null;
      }
      
      selectedAnnotationIndex = -1;
      redrawAnnotations();
    });
  });
  
  // Canvas drawing events
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('click', handleCanvasClick);
  
  // Undo/Redo buttons
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  
  // Keyboard shortcuts - store reference for cleanup
  documentKeydownHandler = (e) => {
    // Handle shortcut recording first
    if (isRecording) {
      handleShortcutRecording(e);
      return;
    }

    // Don't handle shortcuts if text editing is active
    if (isTextEditing) return;

    // Build current key combination
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    if (e.metaKey) parts.push('meta');
    parts.push(e.key.toLowerCase());
    const currentShortcut = parts.join('+');

    // Check for arrow key movement (when annotation is selected)
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase()) && selectedAnnotationIndex >= 0) {
      e.preventDefault();
      const annotation = annotations[selectedAnnotationIndex];

      // Skip freehand and highlight - they don't support movement
      if (annotation.type === 'freehand' || annotation.type === 'highlight') {
        return;
      }

      const moveDistance = e.shiftKey ? 10 : 1;

      switch (e.key.toLowerCase()) {
        case 'arrowup':
          annotation.y -= moveDistance;
          break;
        case 'arrowdown':
          annotation.y += moveDistance;
          break;
        case 'arrowleft':
          annotation.x -= moveDistance;
          break;
        case 'arrowright':
          annotation.x += moveDistance;
          break;
      }

      saveState();
      redrawAnnotations();
      return;
    }

    // Check custom shortcuts
    if (currentShortcut === userShortcuts.undo) {
      e.preventDefault();
      undo();
    } else if (currentShortcut === userShortcuts.redo) {
      e.preventDefault();
      redo();
    } else if (currentShortcut === userShortcuts.copy) {
      e.preventDefault();
      copyToClipboard();
    } else if (currentShortcut === userShortcuts.save) {
      e.preventDefault();
      showSaveAsDialog();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationIndex >= 0) {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === 'Escape') {
      // Escape deselects current annotation
      if (selectedAnnotationIndex >= 0) {
        selectedAnnotationIndex = -1;
        redrawAnnotations();
      }
    } else if (e.key.toLowerCase() === userShortcuts.selectTool) {
      // Select tool
      switchToSelectTool();
    } else if (e.key.toLowerCase() === userShortcuts.penTool) {
      // Pen tool
      selectTool('pen');
    } else if (e.key.toLowerCase() === userShortcuts.highlightTool) {
      // Highlight tool
      selectTool('highlight');
    } else if (e.key.toLowerCase() === userShortcuts.textTool) {
      // Text tool
      selectTool('text');
    } else if (e.key.toLowerCase() === userShortcuts.blurTool) {
      // Blur tool
      selectTool('blur');
    } else if (e.key.toLowerCase() === userShortcuts.rectangleTool) {
      // Rectangle tool
      currentTool = 'rectangle';
      selectedShapeType = 'rectangle';
      selectTool('rectangle');
    } else if (e.key.toLowerCase() === userShortcuts.circleTool) {
      // Circle tool
      currentTool = 'circle';
      selectedShapeType = 'circle';
      selectTool('circle');
    }
  };
  document.addEventListener('keydown', documentKeydownHandler);
  
  // Action buttons with null checks
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveAsBtn = document.getElementById('saveAsBtn');
  const closeBtn = document.getElementById('closeBtn');

  console.log('Button elements found:', { copyBtn: !!copyBtn, clearBtn: !!clearBtn, saveAsBtn: !!saveAsBtn, closeBtn: !!closeBtn });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      console.log('Copy button clicked');
      copyToClipboard();
    });
  } else {
    console.error('Copy button not found!');
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      console.log('Clear button clicked');
      clearAnnotations();
    });
  } else {
    console.error('Clear button not found!');
  }

  if (saveAsBtn) {
    saveAsBtn.addEventListener('click', () => {
      console.log('Save button clicked');
      showSaveAsDialog();
    });
  } else {
    console.error('Save button not found!');
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('Close button clicked');
      closeOverlay();
    });
  } else {
    console.error('Close button not found!');
  }

  // Initialize history with initial state
  saveState();

  // Filename input handlers with null checks
  const filenameConfirm = document.getElementById('filename-confirm');
  const filenameCancel = document.getElementById('filename-cancel');
  const filenameInput = document.getElementById('filename-input');

  if (filenameConfirm) filenameConfirm.addEventListener('click', confirmSaveAs);
  if (filenameCancel) filenameCancel.addEventListener('click', cancelSaveAs);
  if (filenameInput) {
    filenameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmSaveAs();
      } else if (e.key === 'Escape') {
        cancelSaveAs();
      }
    });
  }

  // Settings modal functionality
  loadKeyboardShortcuts();
  setupSettingsModal();
}

// Load keyboard shortcuts from storage
function loadKeyboardShortcuts() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['keyboardShortcuts'], (result) => {
      if (result.keyboardShortcuts) {
        userShortcuts = { ...DEFAULT_SHORTCUTS, ...result.keyboardShortcuts };
      }
      updateShortcutInputs();
    });
  } else {
    // Fallback for testing outside Chrome extension
    updateShortcutInputs();
  }
}

// Save keyboard shortcuts to storage
function saveKeyboardShortcuts() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({ keyboardShortcuts: userShortcuts }, () => {
      console.log('Keyboard shortcuts saved');
    });
  }
}

// Update shortcut input fields with current values
function updateShortcutInputs() {
  Object.keys(userShortcuts).forEach(key => {
    const input = document.getElementById(`shortcut-${key}`);
    if (input) {
      input.value = formatShortcutDisplay(userShortcuts[key]);
    }
  });
}

// Format shortcut for display (e.g., "ctrl+z" -> "Ctrl+Z")
function formatShortcutDisplay(shortcut) {
  return shortcut.split('+').map(part => {
    if (part === 'ctrl') return 'Ctrl';
    if (part === 'shift') return 'Shift';
    if (part === 'alt') return 'Alt';
    if (part === 'meta') return 'Cmd';
    return part.toUpperCase();
  }).join('+');
}

// Setup settings modal event listeners
function setupSettingsModal() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('keyboard-settings-modal');
  const closeBtn = document.getElementById('settings-close-btn');
  const saveBtn = document.getElementById('settings-save-btn');
  const resetBtn = document.getElementById('settings-reset-btn');

  console.log('Settings elements found:', {
    settingsBtn: !!settingsBtn,
    settingsModal: !!settingsModal,
    closeBtn: !!closeBtn,
    saveBtn: !!saveBtn,
    resetBtn: !!resetBtn
  });

  if (!settingsBtn || !settingsModal || !closeBtn || !saveBtn || !resetBtn) {
    console.error('Settings modal elements not found:', {
      settingsBtn: !!settingsBtn,
      settingsModal: !!settingsModal,
      closeBtn: !!closeBtn,
      saveBtn: !!saveBtn,
      resetBtn: !!resetBtn
    });
    return;
  }

  // Open settings
  settingsBtn.addEventListener('click', () => {
    console.log('Settings button clicked - opening modal with bulletproof method');

    // Method 1: Use cssText for highest priority
    settingsModal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.8) !important;
      z-index: 10000000 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif !important;
    `;

    // Add the show class for CSS compatibility
    settingsModal.classList.add('show');

    // Force reflow to ensure rendering
    void settingsModal.offsetHeight;

    // Use requestAnimationFrame to ensure paint happens
    requestAnimationFrame(() => {
      console.log('Settings modal shown, updating shortcuts');
      updateShortcutInputs();

      // Verify rendering after paint
      requestAnimationFrame(() => {
        const computedStyle = window.getComputedStyle(settingsModal);
        const rect = settingsModal.getBoundingClientRect();
        console.log('Settings modal computed styles:', {
          display: computedStyle.display,
          zIndex: computedStyle.zIndex,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          position: computedStyle.position,
          width: computedStyle.width,
          height: computedStyle.height,
          boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          classList: Array.from(settingsModal.classList)
        });
      });
    });
  });

  // Helper function to properly hide settings modal
  function hideSettingsModal() {
    settingsModal.classList.remove('show');
    settingsModal.style.cssText = settingsModal.style.cssText.replace('display: flex !important;', 'display: none !important;');
  }

  // Close settings
  closeBtn.addEventListener('click', () => {
    hideSettingsModal();
  });

  // Close on background click
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      hideSettingsModal();
    }
  });

  // Save shortcuts
  saveBtn.addEventListener('click', () => {
    saveKeyboardShortcuts();
    hideSettingsModal();
    alert('Keyboard shortcuts saved!');
  });

  // Reset to defaults
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all keyboard shortcuts to defaults?')) {
      userShortcuts = { ...DEFAULT_SHORTCUTS };
      updateShortcutInputs();
      saveKeyboardShortcuts();
    }
  });

  // Setup shortcut recording for each input
  document.querySelectorAll('.shortcut-input').forEach(input => {
    input.addEventListener('click', () => {
      startRecordingShortcut(input);
    });
  });
}

// Record a new keyboard shortcut
let isRecording = false;
let recordingInput = null;

function startRecordingShortcut(input) {
  if (isRecording) return;

  isRecording = true;
  recordingInput = input;
  input.classList.add('recording');
  input.value = 'Press a key...';
  input.placeholder = 'Press a key...';
}

// Handle shortcut recording
function handleShortcutRecording(e) {
  if (!isRecording || !recordingInput) return;

  e.preventDefault();
  e.stopPropagation();

  // Build shortcut string
  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  if (e.metaKey) parts.push('meta');

  // Add the actual key (if it's not a modifier)
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    parts.push(e.key.toLowerCase());
  }

  if (parts.length > 0 && parts[parts.length - 1] !== 'ctrl' &&
      parts[parts.length - 1] !== 'shift' && parts[parts.length - 1] !== 'alt' &&
      parts[parts.length - 1] !== 'meta') {
    const shortcut = parts.join('+');
    const shortcutKey = recordingInput.id.replace('shortcut-', '');

    // Check for conflicts
    const conflict = Object.keys(userShortcuts).find(key =>
      key !== shortcutKey && userShortcuts[key] === shortcut
    );

    if (conflict) {
      alert(`This shortcut is already used by "${conflict}"`);
      recordingInput.value = formatShortcutDisplay(userShortcuts[shortcutKey]);
    } else {
      userShortcuts[shortcutKey] = shortcut;
      recordingInput.value = formatShortcutDisplay(shortcut);
    }

    recordingInput.classList.remove('recording');
    isRecording = false;
    recordingInput = null;
  }
}

function getAnnotationBounds(annotation) {
  if (annotation.type === 'arrow') {
    return {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width || 50,
      height: annotation.height || 50,
      rotation: annotation.rotation || 0
    };
  }
  
  if (annotation.type === 'text') {
    // Calculate dynamic bounds based on actual text content
    const canvas = document.getElementById('annotation-canvas');
    let textWidth = annotation.width || 200;
    let textHeight = annotation.height || 30;

    if (canvas && annotation.text) {
      const ctx = canvas.getContext('2d');
      const fontSize = annotation.fontSize || 20;
      ctx.font = `${fontSize}px ${annotation.fontFamily || 'Arial'}`;
      const lines = annotation.text.split('\n');
      let maxWidth = 0;
      lines.forEach(line => {
        const metrics = ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width);
      });
      // Add padding for selection handles
      textWidth = Math.max(annotation.width || 0, maxWidth + 24);
      textHeight = Math.max(annotation.height || 0, fontSize * lines.length * 1.3 + 16);
    }

    return {
      x: annotation.x,
      y: annotation.y,
      width: textWidth,
      height: textHeight,
      rotation: annotation.rotation || 0
    };
  }

  if (annotation.type === 'emoji') {
    // Emoji is similar to text but with fixed square bounds
    const size = annotation.fontSize || 40;
    return {
      x: annotation.x,
      y: annotation.y,
      width: size + 10,
      height: size + 10,
      rotation: annotation.rotation || 0
    };
  }
  
  if (annotation.type === 'line') {
    // Calculate bounds from line endpoints
    const minX = Math.min(annotation.x, annotation.x2 || annotation.x);
    const minY = Math.min(annotation.y, annotation.y2 || annotation.y);
    const maxX = Math.max(annotation.x, annotation.x2 || annotation.x);
    const maxY = Math.max(annotation.y, annotation.y2 || annotation.y);
    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 10),
      height: Math.max(maxY - minY, 10),
      rotation: annotation.rotation || 0
    };
  }

  if (annotation.type === 'rectangle' || annotation.type === 'circle' || annotation.type === 'blur' ||
      annotation.type === 'filled-rectangle' || annotation.type === 'filled-circle') {
    return {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width || 100,
      height: annotation.height || 100,
      rotation: annotation.rotation || 0
    };
  }

  if (annotation.type === 'freehand') {
    // Calculate bounds from points if not already set
    if (annotation.points && annotation.points.length > 0) {
      const bounds = calculateFreehandBounds(annotation.points);
      return {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(bounds.width, 10),
        height: Math.max(bounds.height, 10),
        rotation: annotation.rotation || 0
      };
    }
    return {
      x: annotation.x || 0,
      y: annotation.y || 0,
      width: annotation.width || 10,
      height: annotation.height || 10,
      rotation: annotation.rotation || 0
    };
  }

  if (annotation.type === 'highlight') {
    // Calculate bounds from points if not already set (same as freehand)
    if (annotation.points && annotation.points.length > 0) {
      const bounds = calculateFreehandBounds(annotation.points);
      return {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(bounds.width, 10),
        height: Math.max(bounds.height, 10),
        rotation: annotation.rotation || 0
      };
    }
    return {
      x: annotation.x || 0,
      y: annotation.y || 0,
      width: annotation.width || 10,
      height: annotation.height || 10,
      rotation: annotation.rotation || 0
    };
  }

  return null;
}

function pointInBounds(x, y, bounds) {
  if (!bounds) return false;
  
  // Simple bounding box check first (much faster)
  if (x < bounds.x || x > bounds.x + bounds.width ||
      y < bounds.y || y > bounds.y + bounds.height) {
    return false;
  }
  
  // If no rotation, we're done
  if (!bounds.rotation || bounds.rotation === 0) {
    return true;
  }
  
  // Account for rotation
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const angle = -bounds.rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  // Translate point to origin
  const dx = x - centerX;
  const dy = y - centerY;
  
  // Rotate point back
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  
  // Check if in bounds
  return rx >= -bounds.width / 2 && rx <= bounds.width / 2 &&
         ry >= -bounds.height / 2 && ry <= bounds.height / 2;
}

function getResizeHandle(x, y, bounds) {
  const handles = [
    { name: 'nw', x: bounds.x, y: bounds.y },
    { name: 'ne', x: bounds.x + bounds.width, y: bounds.y },
    { name: 'sw', x: bounds.x, y: bounds.y + bounds.height },
    { name: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { name: 'n', x: bounds.x + bounds.width / 2, y: bounds.y },
    { name: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    { name: 'w', x: bounds.x, y: bounds.y + bounds.height / 2 },
    { name: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
  ];
  
  const handleSize = 12; // Increased for easier clicking (professional tools use larger handles)
  for (const handle of handles) {
    if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
      return handle.name;
    }
  }
  
  // Check rotate handle (top center, above the shape)
  const rotateHandleY = bounds.y - 30; // Increased distance for easier access
  const rotateHandleX = bounds.x + bounds.width / 2;
  if (Math.abs(x - rotateHandleX) < handleSize && Math.abs(y - rotateHandleY) < handleSize) {
    return 'rotate';
  }
  
  return null;
}

function handleMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Reset hover state on mouse down
  hoveredHandle = null;
  
  if (currentTool === 'select') {
    // Exit text editing if clicking on canvas (but not on text input)
    // Check synchronously - the blur handler has its own guard
    if (isTextEditing && !e.target.closest('#text-input-overlay')) {
      exitTextEditing();
    }
    
    // Check if clicking on a resize handle first
    if (selectedAnnotationIndex >= 0) {
      const annotation = annotations[selectedAnnotationIndex];
      const bounds = getAnnotationBounds(annotation);
      if (bounds) {
        const handle = getResizeHandle(x, y, bounds);
        
        if (handle === 'rotate') {
          isRotating = true;
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;
          const angle = Math.atan2(y - centerY, x - centerX);
          annotation.startRotationAngle = angle - (annotation.rotation || 0) * Math.PI / 180;
          // Store initial mouse position for smoother rotation
          annotation.startMouseX = x;
          annotation.startMouseY = y;
          return;
        } else if (handle) {
          // Exit text editing before resizing
          if (isTextEditing) {
            exitTextEditing();
          }
          isResizing = true;
          resizeHandle = handle;
          annotation.startX = bounds.x;
          annotation.startY = bounds.y;
          annotation.startWidth = bounds.width;
          annotation.startHeight = bounds.height;
          // Store original font size for text and emoji resizing
          if (annotation.type === 'text') {
            annotation.startFontSize = annotation.fontSize || 20;
            // Recalculate text bounds to match current font size
            const canvas = document.getElementById('annotation-canvas');
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.font = `${annotation.fontSize}px ${annotation.fontFamily || 'Arial'}`;
              const lines = (annotation.text || 'Text').split('\n');
              let maxWidth = 0;
              lines.forEach(line => {
                const metrics = ctx.measureText(line);
                maxWidth = Math.max(maxWidth, metrics.width);
              });
              // Update bounds to match actual text size
              annotation.startWidth = Math.max(annotation.startWidth, maxWidth + 20);
              annotation.startHeight = Math.max(annotation.startHeight, (annotation.fontSize * lines.length * 1.5));
            }
          }
          if (annotation.type === 'emoji') {
            annotation.startFontSize = annotation.fontSize || 40;
          }
          return;
        }
      }
    }
    
    // Check if clicking on an annotation (check from top to bottom for proper z-order)
    // Note: Freehand annotations are not selectable - they're just drawn paths
    let clickedAnnotation = -1;
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      // Skip freehand and highlight annotations - they don't have selection/move/resize/rotate
      if (annotation.type === 'freehand' || annotation.type === 'highlight') continue;
      const bounds = getAnnotationBounds(annotation);
      if (bounds) {
        // Simple bounding box check first (faster)
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          // Then check rotated bounds
          if (pointInBounds(x, y, bounds)) {
            clickedAnnotation = i;
            break;
          }
        }
      }
    }
    
    if (clickedAnnotation >= 0) {
      selectedAnnotationIndex = clickedAnnotation;
      const annotation = annotations[selectedAnnotationIndex];
      
      // For text annotations, check if double-clicking to edit
      if (annotation.type === 'text' && e.detail === 2) {
        startTextEditing(annotation);
      } else {
        isDragging = true;
        const bounds = getAnnotationBounds(annotation);
        dragOffsetX = x - bounds.x;
        dragOffsetY = y - bounds.y;
      }
      redrawAnnotations();
      return;
    } else {
      // Deselect if clicking on empty space
      selectedAnnotationIndex = -1;
      hoveredHandle = null;
      const canvas = document.getElementById('annotation-canvas');
      if (canvas) {
        canvas.style.cursor = currentTool === 'arrow' ? 'crosshair' : 'default';
      }
      redrawAnnotations();
    }
  }
  
  // Arrow tool - start drag-to-create (like shapes)
  if (currentTool === 'arrow' && selectedArrowType) {
    if (isSelectingArea) {
      cancelAreaSelection();
    }

    isDrawingShape = true;
    shapeStartX = x;
    shapeStartY = y;

    const arrowAnnotation = {
      type: 'arrow',
      x: x,
      y: y,
      width: 0,
      height: 0,
      arrowImage: selectedArrowType,
      color: selectedColor,
      rotation: 0
    };

    annotations.push(arrowAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    // Don't save state here - will save when drag is complete
    return;
  }
  
  // Text tool - create text annotation or edit existing
  if (currentTool === 'text') {
    // Exit any existing text editing
    exitTextEditing();
    
    // Check if clicking on an existing text annotation
    let clickedTextAnnotation = -1;
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      if (annotation.type === 'text') {
        const bounds = getAnnotationBounds(annotation);
        if (bounds && pointInBounds(x, y, bounds)) {
          clickedTextAnnotation = i;
          break;
        }
      }
    }
    
    if (clickedTextAnnotation >= 0) {
      // Edit existing text annotation
      selectedAnnotationIndex = clickedTextAnnotation;
      startTextEditing(annotations[clickedTextAnnotation]);
      redrawAnnotations();
      return;
    }
    
    // Create new text annotation
    // Get current font settings from dropdowns
    const fontFamilySelectEl = document.getElementById('font-family-select');
    const fontSizeSelectEl = document.getElementById('font-size-select');
    const currentFontFamily = fontFamilySelectEl ? fontFamilySelectEl.value : 'Arial';
    const currentFontSize = fontSizeSelectEl ? parseInt(fontSizeSelectEl.value) : 24;

    const textAnnotation = {
      type: 'text',
      x: x,
      y: y,
      width: 80,  // Smaller initial width, will auto-expand based on text
      height: 40, // Taller for better selection handles
      text: 'Text',
      fontSize: currentFontSize,
      fontFamily: currentFontFamily,
      color: selectedColor,
      rotation: 0
    };
    
    annotations.push(textAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    saveState(); // Save state after adding text
    
    // Start editing immediately
    startTextEditing(textAnnotation);
    redrawAnnotations();
    return;
  }
  
  // Line tool - start drawing
  if (currentTool === 'line') {
    // Make sure we're not in area selection mode
    if (isSelectingArea) {
      cancelAreaSelection();
    }

    isDrawingShape = true;
    shapeStartX = x;
    shapeStartY = y;

    const lineAnnotation = {
      type: 'line',
      x: x,
      y: y,
      x2: x,
      y2: y,
      color: selectedColor,
      strokeWidth: 3,
      rotation: 0
    };

    annotations.push(lineAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    // Don't save state here - will save when line drawing is complete
    return;
  }

  // Rectangle and Circle tools - start drawing
  if (currentTool === 'rectangle' || currentTool === 'circle' ||
      currentTool === 'filled-rectangle' || currentTool === 'filled-circle') {
    // Make sure we're not in area selection mode
    if (isSelectingArea) {
      cancelAreaSelection();
    }

    isDrawingShape = true;
    shapeStartX = x;
    shapeStartY = y;

    const shapeAnnotation = {
      type: currentTool,
      x: x,
      y: y,
      width: 0,
      height: 0,
      color: selectedColor,
      strokeWidth: 3,
      rotation: 0
    };

    annotations.push(shapeAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    // Don't save state here - will save when shape drawing is complete
    return;
  }
  
  // Blur tool - start drawing blur area
  if (currentTool === 'blur') {
    // Make sure we're not in area selection mode
    if (isSelectingArea) {
      cancelAreaSelection();
    }

    isDrawingShape = true;
    shapeStartX = x;
    shapeStartY = y;

    const blurAnnotation = {
      type: 'blur',
      x: x,
      y: y,
      width: 0,
      height: 0,
      blurRadius: blurIntensity, // Use blur intensity from slider
      blurEffect: blurEffectType, // 'blur' or 'pixelate'
      rotation: 0
    };

    annotations.push(blurAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    return;
  }

  // Pen/Freehand tool - start drawing path
  if (currentTool === 'pen') {
    if (isSelectingArea) {
      cancelAreaSelection();
    }

    isDrawingFreehand = true;
    currentFreehandPoints = [{ x, y }];

    // Create the freehand annotation immediately
    const freehandAnnotation = {
      type: 'freehand',
      points: currentFreehandPoints,
      color: selectedColor,
      strokeWidth: selectedStrokeWidth,
      rotation: 0
    };

    annotations.push(freehandAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    return;
  }

  // Highlight tool - start drawing highlight stroke (similar to pen but with different style)
  if (currentTool === 'highlight') {
    if (isSelectingArea) {
      cancelAreaSelection();
    }

    isDrawingHighlight = true;
    currentHighlightPoints = [{ x, y }];

    // Create the highlight annotation immediately
    const highlightAnnotation = {
      type: 'highlight',
      points: currentHighlightPoints,
      color: selectedColor,
      strokeWidth: highlightBrushSize, // Use highlight brush size from slider
      rotation: 0
    };

    annotations.push(highlightAnnotation);
    selectedAnnotationIndex = annotations.length - 1;
    return;
  }
}

function showDimensionDisplay(x, y, width, height, rotation = null) {
  const display = document.getElementById('dimension-display');
  if (!display) return;
  
  const canvas = document.getElementById('annotation-canvas');
  if (!canvas) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  const container = canvas.parentElement;
  const containerRect = container.getBoundingClientRect();
  
  // Calculate position relative to viewport
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  
  const displayX = canvasRect.left + (x + width / 2) * scaleX;
  const displayY = canvasRect.top + y * scaleY - 35; // Show above the annotation
  
  display.style.display = 'block';
  display.style.left = displayX + 'px';
  display.style.top = Math.max(60, displayY) + 'px'; // Don't go above top of screen
  display.style.transform = 'translateX(-50%)';
  
  const w = Math.round(Math.abs(width));
  const h = Math.round(Math.abs(height));
  
  if (rotation !== null && rotation !== 0) {
    // Normalize rotation for display
    const rot = Math.round(((rotation % 360) + 360) % 360);
    display.textContent = `${w} × ${h}px • ${rot}°`;
  } else {
    display.textContent = `${w} × ${h}px`;
  }
}

function hideDimensionDisplay() {
  const display = document.getElementById('dimension-display');
  if (display) {
    display.style.display = 'none';
  }
}

function handleMouseMove(e) {
  const rect = e.target.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  if (isRotating && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];
    const bounds = getAnnotationBounds(annotation);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const angle = Math.atan2(currentY - centerY, currentX - centerX);
    annotation.rotation = (angle - annotation.startRotationAngle) * 180 / Math.PI;
    
    // Normalize rotation to 0-360 range for cleaner display
    annotation.rotation = ((annotation.rotation % 360) + 360) % 360;
    
    // Show dimension with rotation
    showDimensionDisplay(bounds.x, bounds.y, bounds.width, bounds.height, annotation.rotation);
    redrawAnnotations();
    return;
  }
  
  if (isResizing && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];
    const dx = currentX - annotation.startX;
    const dy = currentY - annotation.startY;
    
    switch (resizeHandle) {
      case 'nw':
        annotation.x = annotation.startX + dx;
        annotation.y = annotation.startY + dy;
        annotation.width = annotation.startWidth - dx;
        annotation.height = annotation.startHeight - dy;
        break;
      case 'ne':
        annotation.y = annotation.startY + dy;
        annotation.width = annotation.startWidth + dx;
        annotation.height = annotation.startHeight - dy;
        break;
      case 'sw':
        annotation.x = annotation.startX + dx;
        annotation.width = annotation.startWidth - dx;
        annotation.height = annotation.startHeight + dy;
        break;
      case 'se':
        annotation.width = annotation.startWidth + dx;
        annotation.height = annotation.startHeight + dy;
        break;
      case 'n':
        annotation.y = annotation.startY + dy;
        annotation.height = annotation.startHeight - dy;
        break;
      case 's':
        annotation.height = annotation.startHeight + dy;
        break;
      case 'w':
        annotation.x = annotation.startX + dx;
        annotation.width = annotation.startWidth - dx;
        break;
      case 'e':
        annotation.width = annotation.startWidth + dx;
        break;
    }
    
    // For arrows, maintain aspect ratio (smooth resizing)
    if (annotation.type === 'arrow') {
      const aspectRatio = annotation.startWidth / annotation.startHeight;
      // Use the larger change to determine which dimension to scale from
      // This provides smoother, more predictable resizing
      const widthChange = Math.abs(dx);
      const heightChange = Math.abs(dy);
      
      if (widthChange > heightChange) {
        // Width changed more, scale height proportionally
        annotation.height = annotation.width / aspectRatio;
      } else {
        // Height changed more, scale width proportionally
        annotation.width = annotation.height * aspectRatio;
      }
      
      // Ensure minimum size
      annotation.width = Math.max(annotation.width, 20);
      annotation.height = Math.max(annotation.height, 20);
    }
    
    // For circles (outline and filled), maintain circular shape
    if (annotation.type === 'circle' || annotation.type === 'filled-circle') {
      const avgSize = (annotation.width + annotation.height) / 2;
      annotation.width = avgSize;
      annotation.height = avgSize;
    }
    
    // For text, scale font size proportionally and update bounds to match actual text size
    if (annotation.type === 'text') {
      // Ensure minimum dimensions
      annotation.width = Math.max(annotation.width, 30);
      annotation.height = Math.max(annotation.height, 15);

      // Scale font size proportionally to width change (no hard limits)
      if (annotation.startWidth > 0 && annotation.startFontSize) {
        const scaleFactor = annotation.width / annotation.startWidth;
        annotation.fontSize = Math.max(8, (annotation.startFontSize * scaleFactor));

        // Recalculate actual text bounds based on new font size
        const canvas = document.getElementById('annotation-canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.font = `${annotation.fontSize}px ${annotation.fontFamily || 'Arial'}`;
          const lines = (annotation.text || 'Text').split('\n');
          let maxWidth = 0;
          lines.forEach(line => {
            const metrics = ctx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
          });
          // Update width to match actual text width, but keep user's resize width as minimum
          annotation.width = Math.max(annotation.width, maxWidth + 20);
          annotation.height = Math.max(annotation.height, (annotation.fontSize * lines.length * 1.5));
        }
      }
    }

    // For emoji, scale font size proportionally
    if (annotation.type === 'emoji') {
      const avgSize = (annotation.width + annotation.height) / 2;
      annotation.width = avgSize;
      annotation.height = avgSize;

      // Scale font size based on size change
      if (annotation.startWidth > 0 && annotation.startFontSize) {
        const scaleFactor = avgSize / annotation.startWidth;
        annotation.fontSize = Math.max(12, annotation.startFontSize * scaleFactor);
      }
    }
    
    // Show dimension display
    const bounds = getAnnotationBounds(annotation);
    showDimensionDisplay(bounds.x, bounds.y, bounds.width, bounds.height, bounds.rotation);
    redrawAnnotations();
    return;
  }
  
  // Handle shape drawing (rectangle/circle/blur/filled-rectangle/filled-circle)
  if (isDrawingShape && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];

    // Line tool uses x,y,x2,y2 instead of x,y,width,height
    if (annotation.type === 'line') {
      annotation.x2 = currentX;
      annotation.y2 = currentY;
    } else {
      // Rectangle, circle, blur, filled shapes, arrows use x,y,width,height
      const minX = Math.min(shapeStartX, currentX);
      const minY = Math.min(shapeStartY, currentY);
      const maxX = Math.max(shapeStartX, currentX);
      const maxY = Math.max(shapeStartY, currentY);

      annotation.x = minX;
      annotation.y = minY;
      annotation.width = maxX - minX;
      annotation.height = maxY - minY;

      // For arrows, maintain aspect ratio based on original arrow image
      if (annotation.type === 'arrow') {
        // Use the larger dimension to maintain visibility
        const size = Math.max(annotation.width, annotation.height);
        annotation.width = size;
        annotation.height = size;
      }
    }

    redrawAnnotations();
    return;
  }

  // Handle freehand drawing
  if (isDrawingFreehand && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];
    // Add point to the path
    currentFreehandPoints.push({ x: currentX, y: currentY });
    annotation.points = currentFreehandPoints;
    redrawAnnotations();
    return;
  }

  // Handle highlight drawing
  if (isDrawingHighlight && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];
    // Add point to the path
    currentHighlightPoints.push({ x: currentX, y: currentY });
    annotation.points = currentHighlightPoints;
    redrawAnnotations();
    return;
  }
  
  if (isDragging && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];
    annotation.x = currentX - dragOffsetX;
    annotation.y = currentY - dragOffsetY;
    redrawAnnotations();
    return;
  }
  
  // Update cursor and hover state based on handle position
  if (currentTool === 'select' && selectedAnnotationIndex >= 0) {
    const annotation = annotations[selectedAnnotationIndex];
    const bounds = getAnnotationBounds(annotation);
    if (bounds) {
      const handle = getResizeHandle(currentX, currentY, bounds);
      
      // Update cursor based on handle
      const canvas = document.getElementById('annotation-canvas');
      if (handle) {
        hoveredHandle = handle;
        // Set cursor based on handle type
        switch (handle) {
          case 'nw':
          case 'se':
            canvas.style.cursor = 'nwse-resize';
            break;
          case 'ne':
          case 'sw':
            canvas.style.cursor = 'nesw-resize';
            break;
          case 'n':
          case 's':
            canvas.style.cursor = 'ns-resize';
            break;
          case 'w':
          case 'e':
            canvas.style.cursor = 'ew-resize';
            break;
          case 'rotate':
            canvas.style.cursor = 'grab';
            break;
        }
        // Redraw to show hover indicators
        redrawAnnotations();
      } else {
        // Check if hovering over annotation itself
        if (pointInBounds(currentX, currentY, bounds)) {
          canvas.style.cursor = 'move';
          hoveredHandle = null;
        } else {
          canvas.style.cursor = 'default';
          if (hoveredHandle !== null) {
            hoveredHandle = null;
            redrawAnnotations();
          }
        }
      }
    }
  }
  
  // Hide dimension display when not resizing/rotating
  if (!isResizing && !isRotating) {
    hideDimensionDisplay();
  }
}

function handleMouseUp(e) {
  if (isDrawingShape) {
    const annotation = annotations[selectedAnnotationIndex];
    // Remove shape if it's too small (likely accidental click)
    if (annotation.width < 5 || annotation.height < 5) {
      annotations.splice(selectedAnnotationIndex, 1);
      selectedAnnotationIndex = -1;
    } else {
      // Save state after completing shape drawing
      saveState();
      // Switch to Select tool after adding shape
      switchToSelectTool();
    }
    isDrawingShape = false;
    redrawAnnotations();
    return;
  }

  // Complete freehand drawing
  if (isDrawingFreehand) {
    const annotation = annotations[selectedAnnotationIndex];
    // Remove if too few points (accidental click)
    if (currentFreehandPoints.length < 3) {
      annotations.splice(selectedAnnotationIndex, 1);
      selectedAnnotationIndex = -1;
    } else {
      // Simplify the path to reduce point count while keeping shape
      annotation.points = simplifyPath(currentFreehandPoints, 2);
      // Calculate bounding box for the freehand path
      const bounds = calculateFreehandBounds(annotation.points);
      annotation.x = bounds.x;
      annotation.y = bounds.y;
      annotation.width = bounds.width;
      annotation.height = bounds.height;
      // Save state after completing freehand drawing
      saveState();
      // Switch to Select tool after adding freehand
      switchToSelectTool();
    }
    isDrawingFreehand = false;
    currentFreehandPoints = [];
    redrawAnnotations();
    return;
  }

  // Complete highlight drawing
  if (isDrawingHighlight) {
    const annotation = annotations[selectedAnnotationIndex];
    // Remove if too few points (accidental click)
    if (currentHighlightPoints.length < 3) {
      annotations.splice(selectedAnnotationIndex, 1);
      selectedAnnotationIndex = -1;
    } else {
      // Simplify the path to reduce point count while keeping shape
      annotation.points = simplifyPath(currentHighlightPoints, 2);
      // Calculate bounding box for the highlight path
      const bounds = calculateFreehandBounds(annotation.points);
      annotation.x = bounds.x;
      annotation.y = bounds.y;
      annotation.width = bounds.width;
      annotation.height = bounds.height;
      // Save state after completing highlight drawing
      saveState();
      // Switch to Select tool after adding highlight
      switchToSelectTool();
    }
    isDrawingHighlight = false;
    currentHighlightPoints = [];
    redrawAnnotations();
    return;
  }

  if (isRotating || isResizing || isDragging) {
    // Save state after completing move/resize/rotate
    if (selectedAnnotationIndex >= 0) {
      saveState();
    }
    isRotating = false;
    isResizing = false;
    isDragging = false;
    resizeHandle = null;
    hideDimensionDisplay();
    // Redraw to update hover state
    redrawAnnotations();
    return;
  }
}

function handleCanvasClick(e) {
  // Don't add arrow if we're in select mode and clicked on an annotation
  if (currentTool === 'select') {
    // Selection is handled in handleMouseDown
    return;
  }
  
  // Arrow tool now uses drag-to-create (handled in handleMouseDown/Move/Up)
  // Old click-to-place behavior removed in favor of professional drag-to-create workflow

  if (currentTool === 'emoji' && selectedEmoji) {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Capture emoji before switching tools
    const emoji = selectedEmoji;

    // Add new emoji annotation
    annotations.push({
      type: 'emoji',
      emoji: emoji,
      x: x - 20,
      y: y - 20,
      fontSize: 40,
      rotation: 0
    });

    selectedAnnotationIndex = annotations.length - 1;
    saveState(); // Save state after adding emoji

    // Switch to Select tool after adding emoji
    switchToSelectTool();

    redrawAnnotations();
  }
}

// Text editing functions
function startTextEditing(annotation) {
  if (isTextEditing) return;
  
  isTextEditing = true;
  const canvas = document.getElementById('annotation-canvas');
  if (!canvas) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  const img = document.getElementById('screenshot-img');
  const imgRect = img.getBoundingClientRect();
  const bounds = getAnnotationBounds(annotation);
  
  // Calculate scale factor (canvas might be scaled to fit)
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  
  // Create text input overlay positioned relative to viewport
  const textInput = document.createElement('textarea');
  textInput.id = 'text-input-overlay';
  textInput.value = annotation.text || 'Text';
  textInput.style.cssText = `
    position: fixed;
    left: ${imgRect.left + bounds.x * scaleX}px;
    top: ${imgRect.top + bounds.y * scaleY}px;
    width: ${Math.max(bounds.width * scaleX, 200)}px;
    min-height: ${Math.max(bounds.height * scaleY, 30)}px;
    font-size: ${(annotation.fontSize || 20) * scaleX}px;
    font-family: ${annotation.fontFamily || 'Arial'}, sans-serif;
    color: ${annotation.color || '#000000'};
    background: rgba(255, 255, 255, 0.98);
    border: 2px solid #007AFF;
    border-radius: 8px;
    padding: 8px 12px;
    z-index: 1000001;
    resize: both;
    overflow: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    line-height: 1.4;
  `;
  
  document.body.appendChild(textInput);
  textInput.focus();
  textInput.select();
  
  // Handle text input
  const updateText = () => {
    annotation.text = textInput.value;
    // Measure text to update bounds (use original scale)
    const ctx = canvas.getContext('2d');
    ctx.font = `${annotation.fontSize || 20}px ${annotation.fontFamily || 'Arial'}`;
    const lines = annotation.text.split('\n');
    let maxWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    });
    annotation.width = Math.max(maxWidth + 20, 100);
    annotation.height = Math.max((annotation.fontSize || 20) * lines.length * 1.5, 30);
    
    // Update input size
    textInput.style.width = `${Math.max(annotation.width * scaleX, 200)}px`;
    textInput.style.minHeight = `${Math.max(annotation.height * scaleY, 30)}px`;
    
    redrawAnnotations();
  };
  
  textInput.addEventListener('input', updateText);
  
  // Use a flag to prevent multiple blur handlers
  let blurHandled = false;
  const handleBlur = () => {
    if (blurHandled || !isTextEditing) return;
    blurHandled = true;
    saveState(); // Save state when text editing is finished
    exitTextEditing();
  };
  
  textInput.addEventListener('blur', handleBlur);
  
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      blurHandled = true; // Prevent blur handler from running
      exitTextEditing();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Enter (without Shift) finishes editing and switches to Select
      e.preventDefault();
      blurHandled = true; // Prevent blur handler from running
      exitTextEditing(); // This now switches to Select automatically
    }
    // Shift+Enter allows new lines
  });
  
  // Store blur handler reference so we can remove it if needed
  textInput._blurHandler = handleBlur;
}

function exitTextEditing() {
  // Prevent multiple calls - set flag first to prevent race conditions
  if (!isTextEditing) return;
  isTextEditing = false; // Set immediately to prevent re-entry

  const textInput = document.getElementById('text-input-overlay');
  if (textInput) {
    // Remove blur handler to prevent it from firing
    if (textInput._blurHandler) {
      textInput.removeEventListener('blur', textInput._blurHandler);
      textInput._blurHandler = null;
    }

    // Check if element is still in the DOM before removing
    if (textInput.parentNode) {
      try {
        textInput.remove();
      } catch (e) {
        // Element might have been removed already, ignore error
      }
    }
  }

  // Always switch to Select tool after text editing
  switchToSelectTool();
}

// Undo/Redo functions
function saveState() {
  // Deep clone annotations array
  const state = JSON.parse(JSON.stringify(annotations));
  undoHistory.push(state);
  
  // Limit history size
  if (undoHistory.length > MAX_HISTORY) {
    undoHistory.shift();
  }
  
  // Clear redo history when new action is performed
  redoHistory = [];
  
  // Update button states
  updateUndoRedoButtons();
}

function undo() {
  if (undoHistory.length <= 1) return; // Can't undo initial state
  
  exitTextEditing(); // Exit text editing if active
  
  // Move current state to redo history
  const currentState = undoHistory.pop();
  redoHistory.push(currentState);
  
  // Restore previous state
  const previousState = undoHistory[undoHistory.length - 1];
  annotations = JSON.parse(JSON.stringify(previousState));
  selectedAnnotationIndex = -1;
  
  updateUndoRedoButtons();
  redrawAnnotations();
}

function redo() {
  if (redoHistory.length === 0) return;
  
  exitTextEditing(); // Exit text editing if active
  
  // Save current state to undo history
  const currentState = JSON.parse(JSON.stringify(annotations));
  undoHistory.push(currentState);
  
  // Restore from redo history
  const redoState = redoHistory.pop();
  annotations = JSON.parse(JSON.stringify(redoState));
  selectedAnnotationIndex = -1;
  
  updateUndoRedoButtons();
  redrawAnnotations();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  
  // Can undo if there's more than initial state
  undoBtn.disabled = undoHistory.length <= 1;
  
  // Can redo if there's something in redo history
  redoBtn.disabled = redoHistory.length === 0;
}

function deleteSelected() {
  if (selectedAnnotationIndex >= 0) {
    exitTextEditing(); // Exit text editing if active
    saveState(); // Save state before deletion
    annotations.splice(selectedAnnotationIndex, 1);
    selectedAnnotationIndex = -1;
    redrawAnnotations();
  }
}

// Shared helper to render basic annotation shapes (text, rectangle, circle, arrow)
// Used by both drawAnnotation (live preview) and saveScreenshot (final export)
function renderAnnotationShape(ctx, annotation, bounds, options = {}) {
  const { skipTextIfEditing = false, annotationIndex = -1 } = options;

  // Draw text
  if (annotation.type === 'text') {
    // Skip drawing if text is being edited (for live preview only)
    if (skipTextIfEditing && isTextEditing && selectedAnnotationIndex === annotationIndex) {
      return true; // Indicate we handled this type
    }
    ctx.font = `${annotation.fontSize || 20}px ${annotation.fontFamily || 'Arial'}`;
    ctx.fillStyle = annotation.color || '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // Handle multi-line text
    const lines = (annotation.text || 'Text').split('\n');
    const lineHeight = (annotation.fontSize || 20) * 1.2;
    lines.forEach((line, index) => {
      ctx.fillText(line, bounds.x, bounds.y + (index * lineHeight));
    });
    return true;
  }

  // Draw emoji
  if (annotation.type === 'emoji') {
    ctx.font = `${annotation.fontSize || 40}px Arial`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(annotation.emoji || '😀', bounds.x, bounds.y);
    return true;
  }

  // Draw line
  if (annotation.type === 'line') {
    ctx.beginPath();
    ctx.strokeStyle = annotation.color || '#FF0000';
    ctx.lineWidth = annotation.strokeWidth || 3;
    ctx.lineCap = 'round';
    ctx.moveTo(annotation.x, annotation.y);
    ctx.lineTo(annotation.x2 || annotation.x, annotation.y2 || annotation.y);
    ctx.stroke();
    return true;
  }

  // Draw rectangle
  if (annotation.type === 'rectangle') {
    ctx.strokeStyle = annotation.color || '#FF0000';
    ctx.lineWidth = annotation.strokeWidth || 3;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return true;
  }

  // Draw filled rectangle
  if (annotation.type === 'filled-rectangle') {
    ctx.fillStyle = annotation.color || '#FF0000';
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return true;
  }

  // Draw circle
  if (annotation.type === 'circle') {
    const radiusX = bounds.width / 2;
    const radiusY = bounds.height / 2;
    const cx = bounds.x + radiusX;
    const cy = bounds.y + radiusY;

    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = annotation.color || '#FF0000';
    ctx.lineWidth = annotation.strokeWidth || 3;
    ctx.stroke();
    return true;
  }

  // Draw filled circle
  if (annotation.type === 'filled-circle') {
    const radiusX = bounds.width / 2;
    const radiusY = bounds.height / 2;
    const cx = bounds.x + radiusX;
    const cy = bounds.y + radiusY;

    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = annotation.color || '#FF0000';
    ctx.fill();
    return true;
  }

  // Draw arrow (with color tinting)
  if (annotation.type === 'arrow' && annotation.arrowImage) {
    const arrowImg = arrowImageCache[annotation.arrowImage];
    if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
      // If arrow has a color property, colorize it; otherwise draw normally (backward compatibility)
      if (annotation.color) {
        // Create a temporary canvas to colorize the arrow
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = bounds.width;
        tempCanvas.height = bounds.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the arrow image
        tempCtx.drawImage(arrowImg, 0, 0, bounds.width, bounds.height);

        // Apply color tint using composite operation
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.fillStyle = annotation.color;
        tempCtx.fillRect(0, 0, bounds.width, bounds.height);

        // Draw the colorized arrow onto the main canvas
        ctx.drawImage(tempCanvas, bounds.x, bounds.y);
      } else {
        // No color specified, draw original red arrow
        ctx.drawImage(arrowImg, bounds.x, bounds.y, bounds.width, bounds.height);
      }
      return true;
    }
    return false; // Arrow not ready
  }

  // Draw freehand path
  if (annotation.type === 'freehand' && annotation.points && annotation.points.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = annotation.color || '#FF0000';
    ctx.lineWidth = annotation.strokeWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const points = annotation.points;
    ctx.moveTo(points[0].x, points[0].y);

    // Use quadratic curves for smoother lines
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    // Draw to the last point
    if (points.length > 1) {
      const lastPoint = points[points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
    }

    ctx.stroke();
    return true;
  }

  // Draw highlight path (similar to freehand but with transparency)
  if (annotation.type === 'highlight' && annotation.points && annotation.points.length > 1) {
    ctx.save();
    ctx.globalAlpha = 0.4; // Make it semi-transparent like a real highlighter
    ctx.beginPath();
    ctx.strokeStyle = annotation.color || '#FFFF00'; // Default to yellow
    ctx.lineWidth = annotation.strokeWidth || 9; // Thicker than pen
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const points = annotation.points;
    ctx.moveTo(points[0].x, points[0].y);

    // Use quadratic curves for smoother lines
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    // Draw to the last point
    if (points.length > 1) {
      const lastPoint = points[points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
    }

    ctx.stroke();
    ctx.restore();
    return true;
  }

  return false; // Type not handled by this function
}

// Simplify a path using Ramer-Douglas-Peucker algorithm
function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

// Calculate perpendicular distance from point to line
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  return Math.sqrt(Math.pow(point.x - nearestX, 2) + Math.pow(point.y - nearestY, 2));
}

// Calculate bounding box for freehand points
function calculateFreehandBounds(points) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function drawAnnotation(ctx, annotation, isSelected = false) {
  const bounds = getAnnotationBounds(annotation);
  if (!bounds) return;

  ctx.save();

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  // Apply rotation
  if (bounds.rotation && bounds.rotation !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate(bounds.rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
  }

  const annotationIndex = annotations.indexOf(annotation);

  // Try to render basic shapes using shared helper
  if (annotation.type === 'text') {
    renderAnnotationShape(ctx, annotation, bounds, {
      skipTextIfEditing: true,
      annotationIndex
    });
    ctx.restore();
    if (isSelected && !isTextEditing) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'rectangle') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'circle') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'line') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'filled-rectangle') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'filled-circle') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'emoji') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }

  if (annotation.type === 'freehand' || annotation.type === 'highlight') {
    renderAnnotationShape(ctx, annotation, bounds);
    ctx.restore();
    // Freehand and highlight drawings don't have selection handles - they're just drawn paths
    return;
  }

  // Draw blur area
  if (annotation.type === 'blur') {
    const img = document.getElementById('screenshot-img');
    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.restore();
      return;
    }
    
    // Get the canvas element to check dimensions
    const annotationCanvas = document.getElementById('annotation-canvas');
    if (!annotationCanvas) {
      ctx.restore();
      return;
    }
    
    // Wait for image to be fully loaded (with retry limit to prevent infinite loop)
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      // Image not ready, wait for it with a maximum retry count
      let retryCount = 0;
      const maxRetries = 100; // 5 seconds max (100 * 50ms)
      const checkImage = () => {
        retryCount++;
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          redrawAnnotations();
        } else if (retryCount < maxRetries) {
          setTimeout(checkImage, 50);
        } else {
          console.warn('Blur image failed to load after maximum retries');
        }
      };
      checkImage();
      ctx.restore();
      return;
    }
    
    // Calculate scale factors (annotation canvas coordinates to image natural dimensions)
    // The canvas width/height should match the displayed image dimensions
    const canvasWidth = annotationCanvas.width;
    const canvasHeight = annotationCanvas.height;
    
    if (canvasWidth === 0 || canvasHeight === 0) {
      ctx.restore();
      return;
    }
    
    const scaleX = img.naturalWidth / canvasWidth;
    const scaleY = img.naturalHeight / canvasHeight;
    
    // Source coordinates on the original image (natural size)
    const srcX = Math.max(0, Math.min(bounds.x * scaleX, img.naturalWidth - 1));
    const srcY = Math.max(0, Math.min(bounds.y * scaleY, img.naturalHeight - 1));
    const srcWidth = Math.max(1, Math.min(bounds.width * scaleX, img.naturalWidth - srcX));
    const srcHeight = Math.max(1, Math.min(bounds.height * scaleY, img.naturalHeight - srcY));
    
    // Create a temporary canvas to apply blur
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.max(1, Math.round(srcWidth));
    tempCanvas.height = Math.max(1, Math.round(srcHeight));
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw the source area from the image to temp canvas
    try {
      tempCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, tempCanvas.width, tempCanvas.height);
    } catch (e) {
      console.error('Error drawing image to temp canvas for blur:', e, {
        img: img,
        srcX, srcY, srcWidth, srcHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
      ctx.restore();
      return;
    }
    
    // Apply effect based on type
    const blurRadius = annotation.blurRadius || 10;
    const effectType = annotation.blurEffect || 'blur';

    if (effectType === 'pixelate') {
      // Pixelate effect: downscale then upscale with no smoothing
      const pixelSize = Math.max(5, Math.floor(blurRadius / 2)); // Convert blur radius to pixel size
      const pixelCanvas = document.createElement('canvas');
      const pixelWidth = Math.max(1, Math.floor(bounds.width / pixelSize));
      const pixelHeight = Math.max(1, Math.floor(bounds.height / pixelSize));
      pixelCanvas.width = pixelWidth;
      pixelCanvas.height = pixelHeight;
      const pixelCtx = pixelCanvas.getContext('2d');

      // Disable image smoothing for blocky pixels
      pixelCtx.imageSmoothingEnabled = false;

      // Draw temp canvas to tiny size (downscale)
      pixelCtx.drawImage(tempCanvas, 0, 0, pixelWidth, pixelHeight);

      // Disable smoothing on main context too
      ctx.imageSmoothingEnabled = false;

      // Draw tiny canvas back at full size (upscale = pixelated)
      ctx.drawImage(pixelCanvas, bounds.x, bounds.y, bounds.width, bounds.height);

      // Re-enable smoothing
      ctx.imageSmoothingEnabled = true;
    } else {
      // Smooth blur effect using CSS filter
      ctx.filter = `blur(${blurRadius}px)`;

      // Draw the temp canvas (with source image) to annotation canvas with blur filter
      ctx.drawImage(tempCanvas, bounds.x, bounds.y, bounds.width, bounds.height);

      // Reset filter
      ctx.filter = 'none';
    }
    
    // Draw border to show blur area (only when not selected, selection handles will show border)
    if (!isSelected) {
      ctx.strokeStyle = 'rgba(0, 122, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.setLineDash([]);
    }
    
    ctx.restore();
    if (isSelected) {
      drawSelectionHandles(ctx, bounds);
    }
    return;
  }
  
  if (annotation.type === 'arrow' && annotation.arrowImage) {
    const arrowName = annotation.arrowImage;
    let img = arrowImageCache[arrowName];
    
    // Check if we have a valid, loaded image
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Image is ready - draw it!
      try {
        // Apply color tinting if arrow has a color property
        if (annotation.color) {
          // Create a temporary canvas to colorize the arrow
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = bounds.width;
          tempCanvas.height = bounds.height;
          const tempCtx = tempCanvas.getContext('2d');

          // Draw the arrow image
          tempCtx.drawImage(img, 0, 0, bounds.width, bounds.height);

          // Apply color tint using composite operation
          tempCtx.globalCompositeOperation = 'source-in';
          tempCtx.fillStyle = annotation.color;
          tempCtx.fillRect(0, 0, bounds.width, bounds.height);

          // Draw the colorized arrow onto the main canvas
          ctx.drawImage(tempCanvas, bounds.x, bounds.y);
        } else {
          // No color specified, draw original red arrow
          ctx.drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height);
        }
        ctx.restore();
        // Draw selection handles after restoring context
        if (isSelected) {
          drawSelectionHandles(ctx, bounds);
        }
        return; // Successfully drawn
      } catch (e) {
        console.error('Error drawing arrow image:', e, 'Image:', img, 'Bounds:', bounds);
      }
    }
    
    // Image not ready - need to load it
    // Create a fresh image instance
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous'; // Allow cross-origin if needed
    
    // Set up load handler BEFORE setting src
    newImg.onload = function() {
      console.log(`✓ Arrow image LOADED: ${arrowName}`, {
        width: newImg.width,
        height: newImg.height,
        naturalWidth: newImg.naturalWidth,
        naturalHeight: newImg.naturalHeight,
        complete: newImg.complete
      });
      // Store the successfully loaded image
      arrowImageCache[arrowName] = newImg;
      // Force redraw immediately
      setTimeout(() => {
        redrawAnnotations();
      }, 10);
    };
    
    newImg.onerror = function(e) {
      console.error(`✗ Failed to load arrow: ${arrowName}`, {
        error: e,
            url: getArrowImageURL(arrowName)
      });
      // Remove from cache so we can retry
      delete arrowImageCache[arrowName];
    };
    
      // Load the image
      const url = getArrowImageURL(arrowName);
      console.log(`→ Loading arrow: ${arrowName} from ${url}`);
      newImg.src = url;
    
    // Store immediately (will be updated when loaded)
    arrowImageCache[arrowName] = newImg;
    
    // Don't draw placeholder - just wait for image to load
    // The redraw will happen automatically when image loads
  }
  
  ctx.restore();
  
  // Draw selection handles (outside of rotation, in screen coordinates)
  if (isSelected) {
    drawSelectionHandles(ctx, bounds);
  }
}

function drawSelectionHandles(ctx, bounds) {
  ctx.save();
  
  // Selection border
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);
  
  // Draw resize handles with double arrows on hover (professional style)
  const handles = [
    { name: 'nw', x: bounds.x, y: bounds.y, angle: -45 },
    { name: 'ne', x: bounds.x + bounds.width, y: bounds.y, angle: 45 },
    { name: 'sw', x: bounds.x, y: bounds.y + bounds.height, angle: 45 },
    { name: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height, angle: -45 },
    { name: 'n', x: bounds.x + bounds.width / 2, y: bounds.y, angle: 0 },
    { name: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, angle: 180 },
    { name: 'w', x: bounds.x, y: bounds.y + bounds.height / 2, angle: 90 },
    { name: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, angle: -90 }
  ];
  
  const handleRadius = 7; // Larger handles for better interaction
  handles.forEach(handle => {
    const isHovered = hoveredHandle === handle.name;
    
    // Draw outer glow for better visibility
    if (isHovered) {
      ctx.fillStyle = 'rgba(0, 122, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, handleRadius + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw handle circle
    ctx.fillStyle = isHovered ? '#0051D5' : '#007AFF';
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw white border (thicker for better visibility)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw double arrow icon on hover
    if (isHovered) {
      ctx.save();
      ctx.translate(handle.x, handle.y);
      ctx.rotate(handle.angle * Math.PI / 180);
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      // Draw double arrow (↔ or ↕)
      const arrowSize = 4;
      if (handle.name === 'n' || handle.name === 's') {
        // Vertical double arrow
        ctx.beginPath();
        ctx.moveTo(0, -arrowSize);
        ctx.lineTo(0, arrowSize);
        ctx.moveTo(-arrowSize, -arrowSize);
        ctx.lineTo(0, -arrowSize * 1.5);
        ctx.lineTo(arrowSize, -arrowSize);
        ctx.moveTo(-arrowSize, arrowSize);
        ctx.lineTo(0, arrowSize * 1.5);
        ctx.lineTo(arrowSize, arrowSize);
        ctx.stroke();
      } else if (handle.name === 'w' || handle.name === 'e') {
        // Horizontal double arrow
        ctx.beginPath();
        ctx.moveTo(-arrowSize, 0);
        ctx.lineTo(arrowSize, 0);
        ctx.moveTo(-arrowSize, -arrowSize);
        ctx.lineTo(-arrowSize * 1.5, 0);
        ctx.lineTo(-arrowSize, arrowSize);
        ctx.moveTo(arrowSize, -arrowSize);
        ctx.lineTo(arrowSize * 1.5, 0);
        ctx.lineTo(arrowSize, arrowSize);
        ctx.stroke();
      } else {
        // Diagonal double arrow
        ctx.beginPath();
        ctx.moveTo(-arrowSize, -arrowSize);
        ctx.lineTo(arrowSize, arrowSize);
        ctx.moveTo(-arrowSize * 0.7, -arrowSize * 1.5);
        ctx.lineTo(-arrowSize, -arrowSize);
        ctx.lineTo(-arrowSize * 1.5, -arrowSize * 0.7);
        ctx.moveTo(arrowSize * 0.7, arrowSize * 1.5);
        ctx.lineTo(arrowSize, arrowSize);
        ctx.lineTo(arrowSize * 1.5, arrowSize * 0.7);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  });
  
  // Draw rotate handle with icon on hover (professional style)
  const rotateHandleX = bounds.x + bounds.width / 2;
  const rotateHandleY = bounds.y - 30; // Increased distance
  const isRotateHovered = hoveredHandle === 'rotate';
  const rotateHandleRadius = 7; // Larger handle
  
  // Draw outer glow for better visibility
  if (isRotateHovered) {
    ctx.fillStyle = 'rgba(0, 122, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(rotateHandleX, rotateHandleY, rotateHandleRadius + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw handle circle
  ctx.fillStyle = isRotateHovered ? '#0051D5' : '#007AFF';
  ctx.beginPath();
  ctx.arc(rotateHandleX, rotateHandleY, rotateHandleRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw white border (thicker)
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(rotateHandleX, rotateHandleY, rotateHandleRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw rotate icon on hover
  if (isRotateHovered) {
    ctx.save();
    ctx.translate(rotateHandleX, rotateHandleY);
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Draw curved arrow (rotate icon)
    const radius = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
    
    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(Math.cos(Math.PI * 0.7) * radius, Math.sin(Math.PI * 0.7) * radius);
    ctx.lineTo(Math.cos(Math.PI * 0.7) * radius - 2, Math.sin(Math.PI * 0.7) * radius - 1);
    ctx.lineTo(Math.cos(Math.PI * 0.7) * radius - 1, Math.sin(Math.PI * 0.7) * radius - 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
  
  // Draw line to rotate handle (thicker, more visible)
  ctx.beginPath();
  ctx.moveTo(rotateHandleX, bounds.y);
  ctx.lineTo(rotateHandleX, rotateHandleY);
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.restore();
}

// Internal function that performs the actual redraw
function _performRedraw() {
  const canvas = document.getElementById('annotation-canvas');
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw all annotations
  annotations.forEach((annotation, index) => {
    drawAnnotation(ctx, annotation, index === selectedAnnotationIndex);
  });

  // Check if any arrows need their images loaded (with deduplication)
  const pendingArrows = new Set();
  annotations.forEach((annotation) => {
    if (annotation && annotation.type === 'arrow' && annotation.arrowImage) {
      const img = arrowImageCache[annotation.arrowImage];
      if (img && !img.complete && img.naturalWidth === 0 && !pendingArrows.has(annotation.arrowImage)) {
        pendingArrows.add(annotation.arrowImage);
        // Image is still loading, check again soon (single check, not recursive)
        setTimeout(() => {
          const checkImg = arrowImageCache[annotation.arrowImage];
          if (checkImg && checkImg.complete && checkImg.naturalWidth > 0) {
            redrawAnnotations();
          }
        }, 100);
      }
    }
  });
}

// Throttled redraw function using requestAnimationFrame for smooth 60fps rendering
function redrawAnnotations() {
  // If a redraw is already scheduled, skip
  if (redrawScheduled) return;

  const now = performance.now();
  const timeSinceLastRedraw = now - lastRedrawTime;

  if (timeSinceLastRedraw >= MIN_REDRAW_INTERVAL) {
    // Enough time has passed, redraw immediately
    lastRedrawTime = now;
    _performRedraw();
  } else {
    // Schedule redraw on next animation frame
    redrawScheduled = true;
    requestAnimationFrame(() => {
      redrawScheduled = false;
      lastRedrawTime = performance.now();
      _performRedraw();
    });
  }
}

function clearAnnotations() {
  if (confirm('Clear all annotations?')) {
    exitTextEditing(); // Exit text editing if active
    saveState(); // Save state before clearing
    annotations = [];
    selectedAnnotationIndex = -1;
    redrawAnnotations();
  }
}

function showSaveAsDialog() {
  console.log('showSaveAsDialog called');
  const container = document.getElementById('filename-input-container');
  const input = document.getElementById('filename-input');

  console.log('Save dialog elements:', { container: !!container, input: !!input });

  if (!container || !input) {
    console.error('Save dialog elements not found!');
    return;
  }

  // Generate default filename with timestamp
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const defaultName = `screenshot-${dateStr}-${timeStr}`;
  input.value = defaultName;

  console.log('Showing save dialog with bulletproof method');

  // Method 1: Use cssText for highest priority
  container.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    display: flex !important;
    flex-direction: column !important;
    z-index: 10000000 !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    background: linear-gradient(to bottom, #363636, #2d2d2d) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    padding: 24px !important;
    border-radius: 16px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 4px 16px rgba(0, 0, 0, 0.4) !important;
    gap: 16px !important;
    min-width: 350px !important;
    backdrop-filter: blur(20px) !important;
  `;

  // Force reflow to ensure rendering
  void container.offsetHeight;

  // Use requestAnimationFrame to ensure paint happens
  requestAnimationFrame(() => {
    console.log('Dialog shown, focus and select input');
    input.focus();
    input.select();

    // Verify rendering after paint
    requestAnimationFrame(() => {
      const computedStyle = window.getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      console.log('Save dialog computed styles:', {
        display: computedStyle.display,
        zIndex: computedStyle.zIndex,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        position: computedStyle.position,
        top: computedStyle.top,
        left: computedStyle.left,
        transform: computedStyle.transform,
        boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      });
    });
  });
}

function cancelSaveAs() {
  const container = document.getElementById('filename-input-container');
  if (container) {
    container.style.cssText = container.style.cssText.replace('display: flex !important;', 'display: none !important;');
  }
}

function confirmSaveAs() {
  const input = document.getElementById('filename-input');
  const container = document.getElementById('filename-input-container');
  const filename = input.value.trim() || 'screenshot-annotated';

  // Ensure filename has .png extension
  const finalFilename = filename.endsWith('.png') ? filename : filename + '.png';

  // Properly hide the dialog
  if (container) {
    container.style.cssText = container.style.cssText.replace('display: flex !important;', 'display: none !important;');
  }

  saveScreenshot(finalFilename);
}

function saveScreenshot(filename = null) {
  const canvas = document.getElementById('annotation-canvas');
  const img = document.getElementById('screenshot-img');
  
  // Create a new canvas to combine screenshot and annotations
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = img.naturalWidth || img.width;
  finalCanvas.height = img.naturalHeight || img.height;
  // Use alpha:false for opaque output with accurate colors, srgb colorspace
  const finalCtx = finalCanvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  // Disable smoothing for pixel-perfect output
  finalCtx.imageSmoothingEnabled = false;
  
  // Draw screenshot
  finalCtx.drawImage(img, 0, 0);
  
  // Draw annotations
  let imagesToLoad = 0;
  let imagesLoaded = 0;
  
  // Count arrow images that need loading
  annotations.forEach(annotation => {
    if (annotation.type === 'arrow' && annotation.arrowImage) {
      imagesToLoad++;
    }
  });
  
  const drawAnnotations = () => {
    annotations.forEach(annotation => {
      const bounds = getAnnotationBounds(annotation);
      if (!bounds) return;

      finalCtx.save();

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      // Apply rotation
      if (bounds.rotation && bounds.rotation !== 0) {
        finalCtx.translate(centerX, centerY);
        finalCtx.rotate(bounds.rotation * Math.PI / 180);
        finalCtx.translate(-centerX, -centerY);
      }

      // Use shared helper for text, rectangle, circle, arrow, freehand, and highlight
      if (annotation.type === 'text' || annotation.type === 'rectangle' ||
          annotation.type === 'circle' || annotation.type === 'arrow' ||
          annotation.type === 'freehand' || annotation.type === 'highlight') {
        renderAnnotationShape(finalCtx, annotation, bounds);
        finalCtx.restore();
        return;
      }

      // Draw blur (requires special handling for canvas scaling)
      if (annotation.type === 'blur') {
        const img = document.getElementById('screenshot-img');
        if (img) {
          const annotationCanvas = document.getElementById('annotation-canvas');
          if (annotationCanvas) {
            const scaleX = img.naturalWidth / annotationCanvas.width;
            const scaleY = img.naturalHeight / annotationCanvas.height;

            const srcX = bounds.x * scaleX;
            const srcY = bounds.y * scaleY;
            const srcWidth = bounds.width * scaleX;
            const srcHeight = bounds.height * scaleY;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.max(1, Math.round(srcWidth));
            tempCanvas.height = Math.max(1, Math.round(srcHeight));
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, tempCanvas.width, tempCanvas.height);

            const blurRadius = annotation.blurRadius || 10;
            finalCtx.filter = `blur(${blurRadius}px)`;

            const finalScaleX = finalCanvas.width / annotationCanvas.width;
            const finalScaleY = finalCanvas.height / annotationCanvas.height;

            finalCtx.drawImage(
              tempCanvas,
              bounds.x * finalScaleX,
              bounds.y * finalScaleY,
              bounds.width * finalScaleX,
              bounds.height * finalScaleY
            );

            finalCtx.filter = 'none';
          }
        }
      }

      finalCtx.restore();
    });

    downloadImage(finalCanvas, filename);
  };
  
  // Wait for all arrow images to load
  const loadPromises = [];
  annotations.forEach(annotation => {
    if (annotation.type === 'arrow' && annotation.arrowImage) {
      const arrowImg = arrowImageCache[annotation.arrowImage];
      if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
        // Already loaded
      } else if (arrowImagePromises[annotation.arrowImage]) {
        loadPromises.push(arrowImagePromises[annotation.arrowImage]);
      } else {
        // Load it now
        const newImg = new Image();
        const promise = new Promise((resolve, reject) => {
          newImg.onload = () => {
            arrowImageCache[annotation.arrowImage] = newImg;
            resolve(newImg);
          };
          newImg.onerror = reject;
        });
        newImg.src = getArrowImageURL(annotation.arrowImage);
        loadPromises.push(promise);
      }
    }
  });
  
  if (loadPromises.length === 0) {
    drawAnnotations();
  } else {
    Promise.all(loadPromises).then(() => {
      drawAnnotations();
    }).catch((error) => {
      console.error('Error loading arrow images:', error);
      // Still try to draw what we can
      drawAnnotations();
    });
  }
}

function copyToClipboard() {
  const canvas = document.getElementById('annotation-canvas');
  const img = document.getElementById('screenshot-img');

  // Create a new canvas to combine screenshot and annotations
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = img.naturalWidth || img.width;
  finalCanvas.height = img.naturalHeight || img.height;
  const finalCtx = finalCanvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  finalCtx.imageSmoothingEnabled = false;

  // Draw screenshot
  finalCtx.drawImage(img, 0, 0);

  const drawAnnotationsAndCopy = () => {
    annotations.forEach(annotation => {
      const bounds = getAnnotationBounds(annotation);
      if (!bounds) return;

      finalCtx.save();

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      // Apply rotation
      if (bounds.rotation && bounds.rotation !== 0) {
        finalCtx.translate(centerX, centerY);
        finalCtx.rotate(bounds.rotation * Math.PI / 180);
        finalCtx.translate(-centerX, -centerY);
      }

      // Use shared helper for text, rectangle, circle, arrow, freehand, and highlight
      if (annotation.type === 'text' || annotation.type === 'rectangle' ||
          annotation.type === 'circle' || annotation.type === 'arrow' ||
          annotation.type === 'freehand' || annotation.type === 'highlight') {
        renderAnnotationShape(finalCtx, annotation, bounds);
        finalCtx.restore();
        return;
      }

      // Draw blur (requires special handling for canvas scaling)
      if (annotation.type === 'blur') {
        const blurImg = document.getElementById('screenshot-img');
        if (blurImg) {
          const annotationCanvas = document.getElementById('annotation-canvas');
          if (annotationCanvas) {
            const scaleX = blurImg.naturalWidth / annotationCanvas.width;
            const scaleY = blurImg.naturalHeight / annotationCanvas.height;

            const srcX = bounds.x * scaleX;
            const srcY = bounds.y * scaleY;
            const srcWidth = bounds.width * scaleX;
            const srcHeight = bounds.height * scaleY;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.max(1, Math.round(srcWidth));
            tempCanvas.height = Math.max(1, Math.round(srcHeight));
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.drawImage(blurImg, srcX, srcY, srcWidth, srcHeight, 0, 0, tempCanvas.width, tempCanvas.height);

            const blurRadius = annotation.blurRadius || 10;
            finalCtx.filter = `blur(${blurRadius}px)`;

            const finalScaleX = finalCanvas.width / annotationCanvas.width;
            const finalScaleY = finalCanvas.height / annotationCanvas.height;

            finalCtx.drawImage(
              tempCanvas,
              bounds.x * finalScaleX,
              bounds.y * finalScaleY,
              bounds.width * finalScaleX,
              bounds.height * finalScaleY
            );

            finalCtx.filter = 'none';
          }
        }
      }

      finalCtx.restore();
    });

    // Copy to clipboard
    finalCanvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showCopyFeedback('Copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        showCopyFeedback('Failed to copy');
      }
    }, 'image/png');
  };

  // Wait for all arrow images to load
  const loadPromises = [];
  annotations.forEach(annotation => {
    if (annotation.type === 'arrow' && annotation.arrowImage) {
      const arrowImg = arrowImageCache[annotation.arrowImage];
      if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
        // Already loaded
      } else if (arrowImagePromises[annotation.arrowImage]) {
        loadPromises.push(arrowImagePromises[annotation.arrowImage]);
      } else {
        // Load it now
        const newImg = new Image();
        const promise = new Promise((resolve, reject) => {
          newImg.onload = () => {
            arrowImageCache[annotation.arrowImage] = newImg;
            resolve(newImg);
          };
          newImg.onerror = reject;
        });
        newImg.src = getArrowImageURL(annotation.arrowImage);
        loadPromises.push(promise);
      }
    }
  });

  if (loadPromises.length === 0) {
    drawAnnotationsAndCopy();
  } else {
    Promise.all(loadPromises).then(() => {
      drawAnnotationsAndCopy();
    }).catch((error) => {
      console.error('Error loading arrow images:', error);
      drawAnnotationsAndCopy();
    });
  }
}

function showCopyFeedback(message) {
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = `<span style="font-size: 11px;">${message}</span>`;
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
    }, 1500);
  }
}

function downloadImage(canvas, filename = null) {
  // Use PNG format for lossless quality
  canvas.toBlob((blob) => {
    const defaultFilename = filename || `screenshot-annotated-${Date.now()}.png`;

    // Use chrome.downloads API for Save As functionality
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];

      // Send to background script to handle download with Save As dialog
      chrome.runtime.sendMessage({
        action: 'downloadImage',
        data: base64Data,
        filename: defaultFilename
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          // Fallback to regular download
          fallbackDownload(blob, defaultFilename);
        } else if (response && response.success) {
          console.log('File saved successfully');
        } else {
          // Fallback to regular download
          fallbackDownload(blob, defaultFilename);
        }
      });
    };
    reader.readAsDataURL(blob);
  }, 'image/png');
}

function fallbackDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function closeOverlay() {
  exitTextEditing(); // Exit text editing if active

  // Clean up event listeners to prevent memory leaks
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler);
    documentClickHandler = null;
  }
  if (documentKeydownHandler) {
    document.removeEventListener('keydown', documentKeydownHandler);
    documentKeydownHandler = null;
  }

  const overlay = document.getElementById('screenshot-annotation-overlay');
  const dimensionDisplay = document.getElementById('dimension-display');
  const filenameContainer = document.getElementById('filename-input-container');

  if (overlay) {
    overlay.remove();
  }
  if (dimensionDisplay) {
    dimensionDisplay.remove();
  }
  if (filenameContainer) {
    filenameContainer.remove();
  }

  document.body.style.overflow = '';
  annotations = [];
  selectedAnnotationIndex = -1;
  selectedArrowType = null;
  selectedShapeType = null;
  currentTool = 'select';
  hideDimensionDisplay();

  // Clear undo/redo history to free memory
  undoHistory = [];
  redoHistory = [];
}

} // End of window.screenshotAnnotationScriptLoaded guard - prevents duplicate script injection

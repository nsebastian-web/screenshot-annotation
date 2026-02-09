// Background service worker for screenshot extension

// Handle keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-screenshot') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      // Check if we're on a restricted page
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
        console.log('Cannot capture on chrome:// pages');
        return;
      }

      try {
        // Inject content script if not already injected
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });

        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));

        // Send message to start capture
        await chrome.tabs.sendMessage(tab.id, { action: 'startCapture' });
      } catch (error) {
        console.error('Error starting capture:', error);
      }
    }
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  // This will be handled by the popup, but keeping for direct action support
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    // Get the current window ID, or use null for current window
    chrome.windows.getCurrent((window) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting window:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      const windowId = window ? window.id : null;
      chrome.tabs.captureVisibleTab(windowId, { format: 'png', quality: 100 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Screenshot error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else if (!dataUrl) {
          sendResponse({ success: false, error: 'Failed to capture screenshot - no data returned' });
        } else {
          sendResponse({ success: true, dataUrl });
        }
      });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'downloadImage') {
    // Convert base64 to data URL and download
    // Note: Service workers don't support URL.createObjectURL, so we use data URL instead
    try {
      const dataUrl = 'data:image/png;base64,' + request.data;
      
      // Use chrome.downloads API for Save As dialog
      chrome.downloads.download({
        url: dataUrl,
        filename: request.filename,
        saveAs: true, // This triggers the Save As dialog
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      });
    } catch (error) {
      console.error('Error processing download:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getArrowImages') {
    // Return list of arrow images
    const arrows = [
      'arrow1.png',
      'arrow2.png',
      'arrow3.png',
      'arrow4.png'
    ];
    sendResponse({ arrows });
  }
});

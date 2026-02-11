// Background service worker for screenshot extension

// Google Drive API integration class
class GoogleDriveUploader {
  constructor() {
    this.accessToken = null;
    this.DRIVE_API_BASE = 'https://www.googleapis.com';
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
  }

  // Get OAuth token (interactive or silent)
  async authenticate(interactive = false) {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!token) {
            reject(new Error('No token received'));
          } else {
            resolve(token);
          }
        });
      });

      this.accessToken = token;
      return token;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Upload file to Google Drive
  async uploadFile(blob, filename) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    if (blob.size > this.MAX_FILE_SIZE) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Create metadata
    const metadata = {
      name: filename,
      mimeType: 'image/png'
    };

    // Create multipart form data
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    // Read blob as array buffer
    const fileData = await blob.arrayBuffer();

    // Construct multipart body
    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const filePart = delimiter +
      'Content-Type: image/png\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n';

    // Convert file data to base64
    const base64Data = this._arrayBufferToBase64(fileData);

    const multipartBody = metadataPart + filePart + base64Data + closeDelim;

    // Upload to Drive
    const response = await fetch(
      `${this.DRIVE_API_BASE}/upload/drive/v3/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.id; // Return file ID
  }

  // Helper function to convert ArrayBuffer to base64
  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Make file publicly accessible
  async makeFilePublic(fileId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'anyone',
          role: 'reader'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to set permissions: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // Get shareable link
  async getShareableLink(fileId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files/${fileId}?fields=webViewLink,webContentLink`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get link: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.webViewLink || result.webContentLink;
  }

  // Complete upload flow
  async shareScreenshot(blobData, filename) {
    try {
      // Try silent auth first
      try {
        await this.authenticate(false);
      } catch (error) {
        // If silent fails, try interactive
        await this.authenticate(true);
      }

      // Convert base64 to blob
      const response = await fetch(blobData);
      const blob = await response.blob();

      // Upload file
      const fileId = await this.uploadFile(blob, filename);
      console.log('File uploaded:', fileId);

      // Make public
      await this.makeFilePublic(fileId);
      console.log('File made public');

      // Get link
      const link = await this.getShareableLink(fileId);
      console.log('Share link obtained:', link);

      return {
        success: true,
        link,
        fileId
      };
    } catch (error) {
      console.error('Share screenshot error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  // Revoke access token (sign out)
  async signOut() {
    if (!this.accessToken) {
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken(
          { token: this.accessToken },
          () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          }
        );
      });

      this.accessToken = null;
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
}

// Global instance
const googleDriveUploader = new GoogleDriveUploader();

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
      // Determine MIME type from filename extension
      let mimeType = 'image/png';
      if (request.filename) {
        if (request.filename.endsWith('.jpg') || request.filename.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (request.filename.endsWith('.pdf')) {
          mimeType = 'application/pdf';
        }
      }

      const dataUrl = `data:${mimeType};base64,` + request.data;

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

  if (request.action === 'getCaptureShortcut') {
    // Get the current capture screenshot shortcut
    chrome.commands.getAll((commands) => {
      const captureCommand = commands.find(cmd => cmd.name === 'capture-screenshot');
      if (captureCommand) {
        sendResponse({ success: true, shortcut: captureCommand.shortcut || '' });
      } else {
        sendResponse({ success: false, error: 'Command not found' });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'updateCaptureShortcut') {
    // Update the capture screenshot shortcut
    chrome.commands.update({
      name: 'capture-screenshot',
      shortcut: request.shortcut
    }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'shareToGoogleDrive') {
    // Handle Google Drive upload
    (async () => {
      try {
        const result = await googleDriveUploader.shareScreenshot(
          request.blobData,
          request.filename
        );
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (request.action === 'signOutGoogleDrive') {
    // Handle Google Drive sign out
    (async () => {
      try {
        await googleDriveUploader.signOut();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (request.action === 'testGoogleDriveAuth') {
    // Test Google Drive authentication
    (async () => {
      try {
        await googleDriveUploader.authenticate(true);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message || 'Authentication failed'
        });
      }
    })();
    return true; // Keep channel open for async response
  }
});

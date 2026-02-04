// Popup script for extension controls

document.addEventListener('DOMContentLoaded', () => {
  const captureBtn = document.getElementById('captureBtn');
  
  if (!captureBtn) {
    console.error('Capture button not found!');
    return;
  }
  
  captureBtn.addEventListener('click', async () => {
    console.log('Capture button clicked');
    
    // Show loading state
    document.getElementById('btnText').style.display = 'none';
    document.getElementById('btnLoading').style.display = 'inline';
    document.getElementById('errorMsg').style.display = 'none';
    captureBtn.disabled = true;
    
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      console.log('Active tab:', tab.url);
      
      // Check if we're on a chrome:// page (can't inject scripts)
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
        showError('Cannot capture chrome:// pages. Please navigate to a regular webpage first.');
        resetButton();
        return;
      }
      
      // First, try to inject content script (it's safer to always inject fresh)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (e) {
        // If injection fails, it might already be injected, try to send message anyway
        console.log('Script injection note (might already be injected):', e.message);
      }
      
      // Inject CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
      } catch (e) {
        // CSS might already be injected, continue
        console.log('CSS injection note:', e.message);
      }
      
      // Wait for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Send message to content script with retry logic
      let messageSent = false;
      const maxRetries = 3;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { action: 'startCapture' }, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          
          console.log('Message sent successfully:', response);
          messageSent = true;
          // Close popup after successful message send
          setTimeout(() => window.close(), 100);
          break;
        } catch (error) {
          console.log(`Message send attempt ${attempt + 1} failed:`, error.message);
          
          if (attempt < maxRetries - 1) {
            // Wait a bit longer before retrying
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            // Last attempt failed
            throw new Error(`Could not establish connection: ${error.message}`);
          }
        }
      }
      
      if (!messageSent) {
        throw new Error('Failed to establish connection after multiple attempts');
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      let errorMessage = error.message;
      
      // Provide more helpful error messages
      if (errorMessage.includes('Cannot access')) {
        errorMessage = 'Cannot access this page. Please navigate to a regular webpage (not chrome:// pages).';
      } else if (errorMessage.includes('establish connection')) {
        errorMessage = 'Could not connect to content script. Please:\n1. Refresh the page\n2. Try again\n\nIf the problem persists, reload the extension.';
      }
      
      showError('Error: ' + errorMessage);
      resetButton();
    }
  });
  
  function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
  }
  
  function resetButton() {
    document.getElementById('btnText').style.display = 'inline';
    document.getElementById('btnLoading').style.display = 'none';
    captureBtn.disabled = false;
  }
});

// Popup script for extension controls

// ============================================================================
// PRODUCTION LOGGER
// ============================================================================
const DEBUG_MODE = false; // Set to false for production
const logger = {
  log: (...args) => { if (DEBUG_MODE) console.log('[Popup]', ...args); },
  info: (...args) => { if (DEBUG_MODE) console.info('[Popup]', ...args); },
  warn: (...args) => console.warn('[Popup]', ...args),
  error: (...args) => console.error('[Popup]', ...args)
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI
  initializeUI();
  loadRecentUploads();
  checkFirstTimeUser();

  const captureBtn = document.getElementById('captureBtn');

  if (!captureBtn) {
    logger.error('Capture button not found!');
    return;
  }

  captureBtn.addEventListener('click', async () => {
    logger.log('Capture button clicked');

    // Show loading state
    const btnLoading = document.getElementById('btnLoading');
    if (btnLoading) {
      btnLoading.style.display = 'flex';
    }
    document.getElementById('errorMsg').style.display = 'none';
    captureBtn.disabled = true;
    
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      logger.log('Active tab:', tab.url);
      
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
        logger.log('Content script injected successfully');
      } catch (e) {
        // If injection fails, it might already be injected, try to send message anyway
        logger.log('Script injection note (might already be injected):', e.message);
      }
      
      // Inject CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
      } catch (e) {
        // CSS might already be injected, continue
        logger.log('CSS injection note:', e.message);
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
          
          logger.log('Message sent successfully:', response);
          messageSent = true;
          // Close popup after successful message send
          setTimeout(() => window.close(), 100);
          break;
        } catch (error) {
          logger.log(`Message send attempt ${attempt + 1} failed:`, error.message);
          
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
      logger.error('Error capturing screenshot:', error);
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

  // Full Page Screenshot button handler
  const captureFullPageBtn = document.getElementById('captureFullPageBtn');

  if (captureFullPageBtn) {
    captureFullPageBtn.addEventListener('click', async () => {
      logger.log('Full-page capture button clicked');

      // Show loading state
      captureFullPageBtn.disabled = true;
      captureFullPageBtn.textContent = '⏳ Capturing...';
      document.getElementById('errorMsg').style.display = 'none';

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          throw new Error('No active tab found');
        }

        // Check for restricted pages
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
          showError('Cannot capture chrome:// pages');
          captureFullPageBtn.disabled = false;
          captureFullPageBtn.textContent = '📄 Full Page Screenshot';
          return;
        }

        // Inject scripts
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (e) {
          logger.log('Script injection note:', e.message);
        }

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        }).catch(e => logger.log('CSS injection note:', e.message));

        await new Promise(resolve => setTimeout(resolve, 200));

        // Send full-page capture message
        await chrome.tabs.sendMessage(tab.id, { action: 'startFullPageCapture' });

        setTimeout(() => window.close(), 100);

      } catch (error) {
        logger.error('Error:', error);
        showError('Error: ' + error.message);
        captureFullPageBtn.disabled = false;
        captureFullPageBtn.textContent = '📄 Full Page Screenshot';
      }
    });
  }

  // Capture Selection button handler
  const captureSelectionBtn = document.getElementById('captureSelectionBtn');

  if (captureSelectionBtn) {
    captureSelectionBtn.addEventListener('click', async () => {
      logger.log('Capture selection button clicked');

      // Show loading state
      captureSelectionBtn.disabled = true;
      captureSelectionBtn.textContent = '⏳ Starting...';
      document.getElementById('errorMsg').style.display = 'none';

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          throw new Error('No active tab found');
        }

        // Check for restricted pages
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
          showError('Cannot capture chrome:// pages');
          captureSelectionBtn.disabled = false;
          captureSelectionBtn.textContent = '✂️ Capture Selection';
          return;
        }

        // Inject scripts
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (e) {
          logger.log('Script injection note:', e.message);
        }

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        }).catch(e => logger.log('CSS injection note:', e.message));

        await new Promise(resolve => setTimeout(resolve, 200));

        // Send message with 'capture' mode
        await chrome.tabs.sendMessage(tab.id, {
          action: 'startCapture',
          mode: 'capture' // NEW: Pass mode parameter
        });

        setTimeout(() => window.close(), 100);

      } catch (error) {
        logger.error('Error:', error);
        showError('Error: ' + error.message);
        captureSelectionBtn.disabled = false;
        captureSelectionBtn.textContent = '✂️ Capture Selection';
      }
    });
  }

  // Settings button handler
  const settingsBtn = document.getElementById('settingsBtn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // Open settings page in a new tab
      chrome.tabs.create({ url: 'settings.html' });
    });
  }

  function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
  }

  function resetButton() {
    const btnLoading = document.getElementById('btnLoading');
    if (btnLoading) {
      btnLoading.style.display = 'none';
    }
    captureBtn.disabled = false;
  }

  // ============================================================================
  // NEW: UI INITIALIZATION AND ENHANCEMENTS
  // ============================================================================

  function initializeUI() {
    // Add keyboard shortcut hints based on platform
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (!isMac) {
      // Replace ⌘ with Ctrl for non-Mac
      document.querySelectorAll('.btn-shortcut').forEach(el => {
        el.textContent = el.textContent.replace('⌘', 'Ctrl');
      });
    }

    logger.log('UI initialized');
  }

  function loadRecentUploads() {
    // Get upload history from background
    chrome.runtime.sendMessage({ action: 'getUploadHistory', limit: 3 }, (response) => {
      if (response && response.success && response.history && response.history.length > 0) {
        displayRecentUploads(response.history);
      } else {
        logger.log('No recent uploads found');
      }
    });
  }

  function displayRecentUploads(history) {
    const recentSection = document.getElementById('recentSection');
    const recentList = document.getElementById('recentList');

    if (!recentSection || !recentList || history.length === 0) {
      return;
    }

    recentList.innerHTML = '';

    history.forEach(item => {
      const recentItem = document.createElement('div');
      recentItem.className = 'recent-item';

      const thumbnail = document.createElement('div');
      thumbnail.className = 'recent-thumbnail';
      thumbnail.textContent = '📸';

      const info = document.createElement('div');
      info.className = 'recent-info';

      const name = document.createElement('div');
      name.className = 'recent-name';
      name.textContent = item.filename || 'Screenshot';

      const time = document.createElement('div');
      time.className = 'recent-time';
      time.textContent = getTimeAgo(item.timestamp);

      info.appendChild(name);
      info.appendChild(time);

      const action = document.createElement('button');
      action.className = 'recent-action';
      action.innerHTML = '↗';
      action.title = 'Open in Drive';
      action.onclick = (e) => {
        e.stopPropagation();
        if (item.link) {
          chrome.tabs.create({ url: item.link });
        }
      };

      recentItem.onclick = () => {
        if (item.link) {
          chrome.tabs.create({ url: item.link });
        }
      };

      recentItem.appendChild(thumbnail);
      recentItem.appendChild(info);
      recentItem.appendChild(action);

      recentList.appendChild(recentItem);
    });

    recentSection.style.display = 'block';
  }

  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function checkFirstTimeUser() {
    chrome.storage.sync.get(['hasSeenWelcome'], (result) => {
      if (!result.hasSeenWelcome) {
        showWelcomeOverlay();
      }
    });
  }

  function showWelcomeOverlay() {
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    if (!welcomeOverlay) return;

    welcomeOverlay.style.display = 'flex';

    document.getElementById('skipWelcome').addEventListener('click', () => {
      welcomeOverlay.style.display = 'none';
      chrome.storage.sync.set({ hasSeenWelcome: true });
    });

    document.getElementById('startTour').addEventListener('click', () => {
      welcomeOverlay.style.display = 'none';
      chrome.storage.sync.set({ hasSeenWelcome: true });
      // Could open settings or show more detailed tour
      logger.log('User started tour');
    });
  }

  // View All button handler
  const viewAllBtn = document.getElementById('viewAllBtn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      // Open a full history page (could create history.html)
      chrome.tabs.create({ url: 'settings.html#history' });
    });
  }
});

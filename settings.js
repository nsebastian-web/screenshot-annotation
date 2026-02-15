// Settings page script

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all sections
  await loadKeyboardShortcuts();
  await loadPreferences();
  await loadHistory();
  initializeEventListeners();

  // Handle URL hash navigation (e.g., #history)
  if (window.location.hash === '#history') {
    document.getElementById('historySection')?.scrollIntoView({ behavior: 'smooth' });
  }
});

/**
 * Load and display current keyboard shortcuts
 */
async function loadKeyboardShortcuts() {
  try {
    // Get all commands (keyboard shortcuts) for this extension
    const commands = await chrome.commands.getAll();

    console.log('Loaded commands:', commands);

    // Display shortcuts in the list
    displayShortcutsList(commands);

    // Update quick reference table
    updateQuickReference(commands);

  } catch (error) {
    console.error('Error loading shortcuts:', error);
    const shortcutsList = document.getElementById('shortcutsList');
    shortcutsList.innerHTML = `
      <div class="alert alert-warning">
        <strong>Error:</strong> Could not load keyboard shortcuts. Please try reloading the extension.
      </div>
    `;
  }
}

/**
 * Display shortcuts in the main list
 */
function displayShortcutsList(commands) {
  const shortcutsList = document.getElementById('shortcutsList');

  if (!commands || commands.length === 0) {
    shortcutsList.innerHTML = `
      <div class="alert alert-warning">
        No keyboard shortcuts configured.
      </div>
    `;
    return;
  }

  let html = '';

  commands.forEach(command => {
    const shortcutKey = command.shortcut || 'Not set';
    const isUnset = !command.shortcut;

    html += `
      <div class="shortcut-item">
        <div>
          <div class="shortcut-name">${getCommandDisplayName(command.name)}</div>
          <div class="shortcut-description">${command.description || 'No description'}</div>
        </div>
        <div>
          ${isUnset
            ? `<span class="shortcut-unset">Not Set</span>`
            : `<span class="shortcut-badge">${formatShortcut(shortcutKey)}</span>`
          }
        </div>
      </div>
    `;
  });

  shortcutsList.innerHTML = html;
}

/**
 * Update the quick reference table
 */
function updateQuickReference(commands) {
  const commandMap = {};
  commands.forEach(cmd => {
    commandMap[cmd.name] = cmd.shortcut || 'Not set';
  });

  // Update each shortcut display
  updateShortcutDisplay('capture-screenshot', commandMap['capture-screenshot']);
  updateShortcutDisplay('capture-fullpage', commandMap['capture-fullpage']);
  updateShortcutDisplay('capture-selection', commandMap['capture-selection']);
}

/**
 * Update individual shortcut display in quick reference
 */
function updateShortcutDisplay(commandName, shortcut) {
  const element = document.getElementById(`shortcut-${commandName}`);
  if (!element) return;

  if (!shortcut || shortcut === 'Not set') {
    element.innerHTML = '<span class="shortcut-unset">Not Set</span>';
  } else {
    element.innerHTML = `<span class="shortcut-badge">${formatShortcut(shortcut)}</span>`;
  }
}

/**
 * Get display name for command
 */
function getCommandDisplayName(commandName) {
  const names = {
    'capture-screenshot': '📸 Capture Screenshot',
    'capture-fullpage': '📄 Full Page Screenshot',
    'capture-selection': '✂️ Capture Selection'
  };
  return names[commandName] || commandName;
}

/**
 * Format shortcut key for display (e.g., "Ctrl+Shift+S" -> "⌃⇧S")
 */
function formatShortcut(shortcut) {
  if (!shortcut) return 'Not set';

  // Replace common key names with symbols
  return shortcut
    .replace(/Command/g, '⌘')
    .replace(/Cmd/g, '⌘')
    .replace(/Ctrl/g, '⌃')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .replace(/Option/g, '⌥')
    .replace(/\+/g, '');
}

// ============================================================================
// NEW: PREFERENCES MANAGEMENT
// ============================================================================

async function loadPreferences() {
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.sync.get(['preferences'], (result) => {
        resolve(result.preferences || {});
      });
    });

    // Set default values
    document.getElementById('defaultFormat').value = data.defaultFormat || 'png';
    document.getElementById('jpgQuality').value = data.jpgQuality || 90;
    document.getElementById('jpgQualityValue').textContent = `${data.jpgQuality || 90}%`;
    document.getElementById('autoUpload').checked = data.autoUpload || false;
    document.getElementById('autoDateFolders').checked = data.autoDateFolders !== false;
    document.getElementById('autoQR').checked = data.autoQR || false;
    document.getElementById('autoShorten').checked = data.autoShorten !== false;

    console.log('Preferences loaded');
  } catch (error) {
    console.error('Failed to load preferences:', error);
  }
}

async function savePreferences() {
  const preferences = {
    defaultFormat: document.getElementById('defaultFormat').value,
    jpgQuality: parseInt(document.getElementById('jpgQuality').value),
    autoUpload: document.getElementById('autoUpload').checked,
    autoDateFolders: document.getElementById('autoDateFolders').checked,
    autoQR: document.getElementById('autoQR').checked,
    autoShorten: document.getElementById('autoShorten').checked
  };

  await new Promise((resolve) => {
    chrome.storage.sync.set({ preferences }, resolve);
  });

  console.log('Preferences saved');
}

// ============================================================================
// NEW: HISTORY MANAGEMENT
// ============================================================================

async function loadHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  historyList.innerHTML = '<div class="loading">Loading history...</div>';

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getUploadHistory', limit: 50 }, resolve);
    });

    if (response && response.success && response.history && response.history.length > 0) {
      displayHistory(response.history);
    } else {
      historyList.innerHTML = '<div class="loading">No history yet</div>';
    }
  } catch (error) {
    console.error('Failed to load history:', error);
    historyList.innerHTML = '<div class="loading">Failed to load history</div>';
  }
}

function displayHistory(history) {
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '';

  history.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';

    const thumbnail = document.createElement('div');
    thumbnail.className = 'history-thumbnail';
    thumbnail.textContent = '📸';

    const details = document.createElement('div');
    details.className = 'history-details';

    const name = document.createElement('div');
    name.className = 'history-name';
    name.textContent = item.filename || 'Screenshot';

    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.innerHTML = `
      <span>${formatDate(item.timestamp)}</span>
      ${item.description ? `<span>${item.description}</span>` : ''}
    `;

    details.appendChild(name);
    details.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    // Open button
    const openBtn = document.createElement('button');
    openBtn.className = 'history-action-btn';
    openBtn.innerHTML = '↗';
    openBtn.title = 'Open in Drive';
    openBtn.onclick = () => {
      if (item.link) {
        chrome.tabs.create({ url: item.link });
      }
    };

    // Copy link button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'history-action-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = 'Copy Link';
    copyBtn.onclick = async () => {
      if (item.link) {
        await navigator.clipboard.writeText(item.link);
        copyBtn.innerHTML = '✓';
        setTimeout(() => {
          copyBtn.innerHTML = '📋';
        }, 2000);
      }
    };

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'history-action-btn delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = async () => {
      if (confirm('Delete this screenshot from Google Drive?')) {
        await deleteHistoryItem(item.fileId);
        historyItem.remove();
      }
    };

    actions.appendChild(openBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);

    historyItem.appendChild(thumbnail);
    historyItem.appendChild(details);
    historyItem.appendChild(actions);

    historyList.appendChild(historyItem);
  });
}

async function deleteHistoryItem(fileId) {
  try {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'deleteDriveFile', fileId }, resolve);
    });
    console.log('Item deleted');
  } catch (error) {
    console.error('Failed to delete:', error);
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes === 0 ? 'Just now' : `${minutes}m ago`;
  }

  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Format as date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// ============================================================================
// NEW: EVENT LISTENERS
// ============================================================================

function initializeEventListeners() {
  // JPG Quality Slider
  const jpgQuality = document.getElementById('jpgQuality');
  const jpgQualityValue = document.getElementById('jpgQualityValue');
  if (jpgQuality && jpgQualityValue) {
    jpgQuality.addEventListener('input', (e) => {
      jpgQualityValue.textContent = `${e.target.value}%`;
    });
  }

  // Configure Shortcuts button
  const openShortcutsBtn = document.getElementById('openShortcutsBtn');
  if (openShortcutsBtn) {
    openShortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // Clear History button
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('Clear all upload history? This cannot be undone.')) {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'clearUploadHistory' }, resolve);
        });
        await loadHistory();
      }
    });
  }

  // Export History button
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  if (exportHistoryBtn) {
    exportHistoryBtn.addEventListener('click', async () => {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getUploadHistory', limit: 1000 }, resolve);
      });

      if (response && response.success && response.history) {
        const blob = new Blob([JSON.stringify(response.history, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screenshot-history-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  // Advanced option buttons
  const configureWebhookBtn = document.getElementById('configureWebhookBtn');
  if (configureWebhookBtn) {
    configureWebhookBtn.addEventListener('click', () => {
      alert('Webhook configuration coming soon!\n\nYou can already use webhooks via the shareToGoogleDrive API with the webhookUrl option.');
    });
  }

  const batchToolsBtn = document.getElementById('batchToolsBtn');
  if (batchToolsBtn) {
    batchToolsBtn.addEventListener('click', () => {
      alert('Batch tools UI coming soon!\n\nYou can already use batch operations via the batchUpload and batchDelete API methods.');
    });
  }

  const driveSettingsBtn = document.getElementById('driveSettingsBtn');
  if (driveSettingsBtn) {
    driveSettingsBtn.addEventListener('click', () => {
      alert('Google Drive management UI coming soon!\n\nYou can already use folder management via the API methods.');
    });
  }

  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset all settings to defaults?')) {
        await new Promise((resolve) => {
          chrome.storage.sync.remove('preferences', resolve);
        });
        await loadPreferences();
      }
    });
  }

  // Close button (now saves)
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', async () => {
      await savePreferences();
      window.close();
    });
  }
}

// Background service worker for screenshot extension

// ============================================================================
// PRODUCTION LOGGER
// ============================================================================
const DEBUG_MODE = false; // Set to false for production
const logger = {
  log: (...args) => { if (DEBUG_MODE) console.log('[Background]', ...args); },
  info: (...args) => { if (DEBUG_MODE) console.info('[Background]', ...args); },
  warn: (...args) => console.warn('[Background]', ...args),
  error: (...args) => console.error('[Background]', ...args)
};

// ============================================================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================================================
const ErrorMessages = {
  'No access token': 'Unable to connect to Google Drive. Please sign in again.',
  'Not authenticated': 'Please sign in to Google Drive first.',
  'No client ID configured': 'Google Drive not configured. Please set up in extension settings.',
  'Upload failed': 'Failed to upload. Please check your connection and try again.',
  'Failed to set permissions': 'Uploaded successfully, but could not make file public.',
  'File size exceeds': 'Screenshot too large (max 10MB). Try a smaller area.',
  'Cannot access': 'Cannot capture chrome:// system pages.',
  'Failed to fetch': 'Network error. Please check your internet connection.',
  'NetworkError': 'No internet connection. Please connect and try again.'
};

function getUserFriendlyError(technicalError) {
  for (const [key, msg] of Object.entries(ErrorMessages)) {
    if (technicalError.includes(key)) {
      return msg;
    }
  }
  return 'Something went wrong. Please try again.';
}

// ============================================================================
// GOOGLE DRIVE API INTEGRATION
// ============================================================================

// Google Drive API integration class
class GoogleDriveUploader {
  constructor() {
    this.accessToken = null;
    this.DRIVE_API_BASE = 'https://www.googleapis.com';
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

    // Rate limiting for uploads
    this.uploadQueue = [];
    this.isProcessingQueue = false;
    this.lastUploadTime = 0;
    this.MIN_UPLOAD_INTERVAL = 2000; // 2 seconds between uploads

    // Folder management
    this.folderCache = new Map(); // Cache folder IDs
    this.defaultFolderName = 'Screenshots';

    // Upload history
    this.uploadHistory = [];
    this.MAX_HISTORY_SIZE = 100;

    // Multi-account support
    this.accounts = new Map(); // accountId -> { accessToken, email, name }
    this.activeAccountId = null;

    // Load saved settings
    this.loadSettings();
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const data = await new Promise((resolve) => {
        chrome.storage.sync.get(['driveSettings', 'uploadHistory', 'driveAccounts'], (result) => {
          resolve(result);
        });
      });

      if (data.uploadHistory) {
        this.uploadHistory = data.uploadHistory;
      }

      if (data.driveAccounts) {
        // Restore account information (but not tokens - those must be re-authenticated)
        this.accounts = new Map(Object.entries(data.driveAccounts));
      }

      if (data.driveSettings) {
        this.activeAccountId = data.driveSettings.activeAccountId;
        this.defaultFolderName = data.driveSettings.defaultFolderName || 'Screenshots';
      }

      logger.info('Settings loaded');
    } catch (error) {
      logger.error('Failed to load settings:', error);
    }
  }

  // Save settings to storage
  async saveSettings() {
    try {
      await new Promise((resolve) => {
        chrome.storage.sync.set({
          driveSettings: {
            activeAccountId: this.activeAccountId,
            defaultFolderName: this.defaultFolderName
          },
          uploadHistory: this.uploadHistory.slice(-this.MAX_HISTORY_SIZE),
          driveAccounts: Object.fromEntries(
            Array.from(this.accounts.entries()).map(([id, account]) => [
              id,
              { email: account.email, name: account.name }
            ])
          )
        }, resolve);
      });
      logger.info('Settings saved');
    } catch (error) {
      logger.error('Failed to save settings:', error);
    }
  }

  // ============================================================================
  // FOLDER MANAGEMENT
  // ============================================================================

  // Create folder in Google Drive
  async createFolder(folderName, parentId = null) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create folder: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.id;
  }

  // Find folder by name
  async findFolder(folderName, parentId = null) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    // Check cache first
    const cacheKey = `${folderName}-${parentId || 'root'}`;
    if (this.folderCache.has(cacheKey)) {
      return this.folderCache.get(cacheKey);
    }

    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to find folder: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.files && result.files.length > 0) {
      const folderId = result.files[0].id;
      // Cache the folder ID
      this.folderCache.set(cacheKey, folderId);
      return folderId;
    }

    return null;
  }

  // Get or create folder (with auto-creation)
  async getOrCreateFolder(folderName, parentId = null) {
    let folderId = await this.findFolder(folderName, parentId);

    if (!folderId) {
      logger.log(`Folder "${folderName}" not found, creating...`);
      folderId = await this.createFolder(folderName, parentId);
      logger.log(`Folder created with ID: ${folderId}`);
    }

    return folderId;
  }

  // Get or create date-based folder structure (e.g., Screenshots/2026/2026-02-12)
  async getOrCreateDateFolder() {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateFolder = `${year}-${month}-${day}`;

    // Create folder hierarchy: Screenshots -> YYYY -> YYYY-MM-DD
    const screenshotsFolderId = await this.getOrCreateFolder(this.defaultFolderName);
    const yearFolderId = await this.getOrCreateFolder(year, screenshotsFolderId);
    const dateFolderId = await this.getOrCreateFolder(dateFolder, yearFolderId);

    return dateFolderId;
  }

  // List folders
  async listFolders(parentId = null) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    let query = `mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=name`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list folders: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.files || [];
  }

  // ============================================================================
  // OAUTH AND AUTHENTICATION
  // ============================================================================

  // Get OAuth token (interactive or silent)
  async authenticate(interactive = false) {
    try {
      // Get client ID from storage
      const clientId = await new Promise((resolve) => {
        chrome.storage.sync.get(['googleDriveClientId'], (result) => {
          resolve(result.googleDriveClientId);
        });
      });

      if (!clientId) {
        throw new Error('No client ID configured. Please set up Google Drive in extension settings.');
      }

      // Check for cached token in memory first
      if (this.accessToken && !interactive) {
        return this.accessToken;
      }

      // Try to retrieve token from session storage (survives service worker restarts)
      if (!interactive) {
        const stored = await new Promise((resolve) => {
          chrome.storage.session.get(['googleDriveToken'], (result) => {
            resolve(result.googleDriveToken);
          });
        });

        if (stored) {
          this.accessToken = stored;
          logger.info('Reused token from session storage');
          return this.accessToken;
        }
      }

      // Construct OAuth URL
      const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
      const scope = 'https://www.googleapis.com/auth/drive.file';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&response_type=token` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}`;

      logger.log('OAuth Debug Info:', {
        extensionId: chrome.runtime.id,
        redirectUri: redirectUri,
        clientId: clientId.substring(0, 20) + '...',
        interactive: interactive
      });

      // Launch OAuth flow
      const responseUrl = await new Promise((resolve, reject) => {
        const flowOptions = {
          url: authUrl,
          interactive: interactive
        };

        // Add timeout settings for non-interactive mode to handle redirects
        if (!interactive) {
          flowOptions.abortOnLoadForNonInteractive = true;
          flowOptions.timeoutMsForNonInteractive = 3000;
        }

        chrome.identity.launchWebAuthFlow(
          flowOptions,
          (responseUrl) => {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message;
              logger.error('OAuth flow error:', errorMsg);

              // Provide more helpful error messages
              if (errorMsg.includes('did not approve') || errorMsg.includes('user cancelled')) {
                reject(new Error('OAuth cancelled. Please click "Allow" on the consent screen to grant access.'));
              } else if (errorMsg.includes('redirect_uri_mismatch')) {
                reject(new Error(`Redirect URI mismatch. Make sure your Google Cloud OAuth client has this redirect URI: ${redirectUri}`));
              } else {
                reject(new Error(errorMsg));
              }
            } else if (!responseUrl) {
              reject(new Error('No response from OAuth'));
            } else {
              logger.log('OAuth success, got response URL');
              resolve(responseUrl);
            }
          }
        );
      });

      // Extract access token from response URL
      const params = new URL(responseUrl).hash.substring(1);
      const tokenMatch = params.match(/access_token=([^&]+)/);

      if (!tokenMatch) {
        throw new Error('No access token in response');
      }

      this.accessToken = tokenMatch[1];

      // Store token in session storage (survives service worker restarts)
      await new Promise((resolve) => {
        chrome.storage.session.set({ googleDriveToken: this.accessToken }, resolve);
      });
      logger.info('Token stored in session storage');

      return this.accessToken;
    } catch (error) {
      logger.error('Authentication error:', error);
      throw error;
    }
  }

  // Upload file to Google Drive
  async uploadFile(blob, filename, folderId = null, description = null) {
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

    // Add folder parent if specified
    if (folderId) {
      metadata.parents = [folderId];
    }

    // Add description if specified
    if (description) {
      metadata.description = description;
    }

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

  // ============================================================================
  // FILE MANAGEMENT
  // ============================================================================

  // Delete file from Google Drive
  async deleteFile(fileId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete file: ${response.status} - ${errorText}`);
    }

    // Remove from upload history
    this.uploadHistory = this.uploadHistory.filter(item => item.fileId !== fileId);
    await this.saveSettings();

    logger.log(`File ${fileId} deleted successfully`);
    return true;
  }

  // Rename file
  async renameFile(fileId, newName) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files/${fileId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to rename file: ${response.status} - ${errorText}`);
    }

    // Update upload history
    const historyItem = this.uploadHistory.find(item => item.fileId === fileId);
    if (historyItem) {
      historyItem.filename = newName;
      await this.saveSettings();
    }

    logger.log(`File ${fileId} renamed to ${newName}`);
    return true;
  }

  // Update file description
  async updateFileDescription(fileId, description) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files/${fileId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update description: ${response.status} - ${errorText}`);
    }

    // Update upload history
    const historyItem = this.uploadHistory.find(item => item.fileId === fileId);
    if (historyItem) {
      historyItem.description = description;
      await this.saveSettings();
    }

    logger.log(`File ${fileId} description updated`);
    return true;
  }

  // Get file info
  async getFileInfo(fileId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${this.DRIVE_API_BASE}/drive/v3/files/${fileId}?fields=id,name,description,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get file info: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // Add to upload history
  addToHistory(fileId, filename, link, folderId = null, description = null) {
    const historyItem = {
      fileId,
      filename,
      link,
      folderId,
      description,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };

    this.uploadHistory.unshift(historyItem);

    // Keep only last MAX_HISTORY_SIZE items
    if (this.uploadHistory.length > this.MAX_HISTORY_SIZE) {
      this.uploadHistory = this.uploadHistory.slice(0, this.MAX_HISTORY_SIZE);
    }

    this.saveSettings();
  }

  // Get upload history
  getHistory(limit = 20) {
    return this.uploadHistory.slice(0, limit);
  }

  // Clear upload history
  async clearHistory() {
    this.uploadHistory = [];
    await this.saveSettings();
    logger.log('Upload history cleared');
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  // Batch upload files
  async batchUpload(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Invalid files array');
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await this.shareScreenshot(
          file.blobData,
          file.filename,
          file.folderId,
          file.description
        );

        results.push({
          filename: file.filename,
          success: true,
          ...result
        });
      } catch (error) {
        logger.error(`Batch upload error for ${file.filename}:`, error);
        errors.push({
          filename: file.filename,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      total: files.length,
      uploaded: results.length,
      failed: errors.length
    };
  }

  // Batch delete files
  async batchDelete(fileIds) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error('Invalid file IDs array');
    }

    const results = [];
    const errors = [];

    for (const fileId of fileIds) {
      try {
        await this.deleteFile(fileId);
        results.push({ fileId, success: true });
      } catch (error) {
        logger.error(`Batch delete error for ${fileId}:`, error);
        errors.push({ fileId, success: false, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      total: fileIds.length,
      deleted: results.length,
      failed: errors.length
    };
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

  // Get shareable link (with optional shortening)
  async getShareableLink(fileId, shouldShorten = true) {
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
    let link = result.webViewLink || result.webContentLink;

    // Clean up query parameters (remove tracking params)
    if (link) {
      link = link.split('?')[0];
    }

    // Shorten the link if requested
    if (shouldShorten && link) {
      try {
        const shortened = await urlShortener.shortenWithTinyURL(link);
        logger.log('Link shortened:', link, '->', shortened);
        return shortened;
      } catch (error) {
        logger.warn('Shortening failed, using full link:', error);
        // Fallback to full link
      }
    }

    return link;
  }

  // ============================================================================
  // ENHANCED SHARING
  // ============================================================================

  // Generate QR code for link (returns data URL)
  async generateQRCode(link) {
    try {
      // Use QR Server API (free, no API key needed)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      // Convert to blob and then to data URL
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      logger.error('QR code generation error:', error);
      throw error;
    }
  }

  // Send to webhook (Slack, Discord, etc.)
  async sendToWebhook(webhookUrl, message, link, filename) {
    try {
      // Support both Slack and Discord webhook formats
      const isSlack = webhookUrl.includes('slack.com');
      const isDiscord = webhookUrl.includes('discord.com');

      let payload;

      if (isSlack) {
        payload = {
          text: message || 'New screenshot uploaded',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${filename}*\n${message || 'Screenshot uploaded to Google Drive'}`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Screenshot'
                  },
                  url: link
                }
              ]
            }
          ]
        };
      } else if (isDiscord) {
        payload = {
          content: message || 'New screenshot uploaded',
          embeds: [
            {
              title: filename,
              description: 'Screenshot uploaded to Google Drive',
              url: link,
              color: 3447003, // Blue color
              timestamp: new Date().toISOString()
            }
          ]
        };
      } else {
        // Generic webhook format
        payload = {
          message: message || 'New screenshot uploaded',
          filename,
          link,
          timestamp: new Date().toISOString()
        };
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      logger.log('Webhook sent successfully');
      return true;
    } catch (error) {
      logger.error('Webhook error:', error);
      throw error;
    }
  }

  // Generate email compose link
  generateEmailLink(link, filename, subject = null, body = null) {
    const defaultSubject = `Screenshot: ${filename}`;
    const defaultBody = `Hi,\n\nI've shared a screenshot with you:\n\n${link}\n\nBest regards`;

    const emailSubject = encodeURIComponent(subject || defaultSubject);
    const emailBody = encodeURIComponent(body || defaultBody);

    return `mailto:?subject=${emailSubject}&body=${emailBody}`;
  }

  // Complete upload flow with rate limiting
  async shareScreenshot(blobData, filename, options = {}) {
    return new Promise((resolve, reject) => {
      // Add to queue with options
      this.uploadQueue.push({
        blobData,
        filename,
        options,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  // Process upload queue with rate limiting
  async processQueue() {
    if (this.isProcessingQueue || this.uploadQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    // Check rate limit
    const timeSinceLastUpload = Date.now() - this.lastUploadTime;
    if (timeSinceLastUpload < this.MIN_UPLOAD_INTERVAL) {
      // Wait before processing
      setTimeout(() => {
        this.isProcessingQueue = false;
        this.processQueue();
      }, this.MIN_UPLOAD_INTERVAL - timeSinceLastUpload);
      return;
    }

    const item = this.uploadQueue.shift();
    const options = item.options || {};

    try {
      // Try to reuse existing token if available, otherwise use interactive auth
      if (!this.accessToken) {
        // First time - go straight to interactive auth
        await this.authenticate(true);
      } else {
        // Have token - try to reuse it, fall back to interactive if it fails
        try {
          await this.authenticate(false);
        } catch (error) {
          // Token expired or invalid - get new one interactively
          await this.authenticate(true);
        }
      }

      // Convert base64 to blob
      const response = await fetch(item.blobData);
      const blob = await response.blob();

      // Determine folder ID
      let folderId = options.folderId;

      if (!folderId && options.useAutoFolder !== false) {
        // Auto-create date-based folder structure
        folderId = await this.getOrCreateDateFolder();
        logger.log('Using date folder:', folderId);
      }

      // Upload file with folder and description
      const fileId = await this.uploadFile(
        blob,
        item.filename,
        folderId,
        options.description
      );
      logger.log('File uploaded:', fileId);

      // Make public (unless explicitly disabled)
      if (options.makePublic !== false) {
        await this.makeFilePublic(fileId);
        logger.log('File made public');
      }

      // Get shortened link
      const shouldShorten = options.shortenLink !== false;
      const link = await this.getShareableLink(fileId, shouldShorten);
      logger.log('Link obtained:', link);

      // Also get full link as fallback
      const fullLink = shouldShorten
        ? await this.getShareableLink(fileId, false)
        : link;

      // Generate QR code if requested
      let qrCode = null;
      if (options.generateQR) {
        try {
          qrCode = await this.generateQRCode(link);
          logger.log('QR code generated');
        } catch (error) {
          logger.warn('QR code generation failed:', error);
        }
      }

      // Send to webhook if configured
      if (options.webhookUrl) {
        try {
          await this.sendToWebhook(
            options.webhookUrl,
            options.webhookMessage,
            link,
            item.filename
          );
          logger.log('Webhook sent');
        } catch (error) {
          logger.warn('Webhook failed:', error);
        }
      }

      // Generate email link if requested
      let emailLink = null;
      if (options.generateEmail) {
        emailLink = this.generateEmailLink(
          link,
          item.filename,
          options.emailSubject,
          options.emailBody
        );
      }

      // Add to history
      this.addToHistory(fileId, item.filename, link, folderId, options.description);

      this.lastUploadTime = Date.now();

      item.resolve({
        success: true,
        link,        // Shortened link (or full if shortening disabled)
        fullLink,    // Full Google Drive link
        fileId,
        folderId,
        qrCode,      // QR code data URL (if requested)
        emailLink,   // mailto: link (if requested)
        description: options.description
      });
    } catch (error) {
      logger.error('Share screenshot error:', error);
      item.resolve({
        success: false,
        error: getUserFriendlyError(error.message || 'Unknown error')
      });
    } finally {
      this.isProcessingQueue = false;

      // Process next item if queue has more
      if (this.uploadQueue.length > 0) {
        setTimeout(() => this.processQueue(), this.MIN_UPLOAD_INTERVAL);
      }
    }
  }

  // Revoke access token (sign out)
  async signOut() {
    if (!this.accessToken) {
      return;
    }

    try {
      // Revoke token via Google API
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${this.accessToken}`, {
        method: 'POST'
      });

      this.accessToken = null;

      // Clear token from session storage
      await new Promise((resolve) => {
        chrome.storage.session.remove('googleDriveToken', resolve);
      });

      logger.info('Signed out successfully');
    } catch (error) {
      logger.error('Sign out error:', error);
      // Clear token anyway
      this.accessToken = null;
      await new Promise((resolve) => {
        chrome.storage.session.remove('googleDriveToken', resolve);
      });
      throw error;
    }
  }
}

// Global instance
const googleDriveUploader = new GoogleDriveUploader();

// ============================================================================
// URL SHORTENING SERVICE
// ============================================================================

class URLShortener {
  constructor() {
    this.TINYURL_API = 'https://tinyurl.com/api-create.php';
  }

  // Shorten URL using TinyURL (no API key required)
  async shortenWithTinyURL(longUrl) {
    try {
      const response = await fetch(
        `${this.TINYURL_API}?url=${encodeURIComponent(longUrl)}`
      );

      if (!response.ok) {
        throw new Error('TinyURL API failed');
      }

      const shortUrl = await response.text(); // Returns shortened URL as plain text
      return shortUrl.trim();

    } catch (error) {
      logger.error('TinyURL error:', error);
      // Always fallback to original URL
      return longUrl;
    }
  }
}

// Global instance
const urlShortener = new URLShortener();

// ============================================================================
// CONTEXT MENU INTEGRATION (Right-Click Access)
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'screenshot-capture',
    title: '📸 Capture Screenshot',
    contexts: ['page', 'selection', 'link', 'image']
  });

  chrome.contextMenus.create({
    id: 'screenshot-fullpage',
    title: '📄 Capture Full Page',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'screenshot-selection',
    title: '✂️ Capture Selection',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'separator-1',
    type: 'separator',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'screenshot-history',
    title: '🕒 Recent Screenshots',
    contexts: ['page']
  });

  logger.log('Context menus created');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  // Check for restricted pages
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
    logger.warn('Cannot capture on chrome:// pages');
    return;
  }

  try {
    // Inject scripts
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    // Handle different menu items
    switch (info.menuItemId) {
      case 'screenshot-capture':
        await chrome.tabs.sendMessage(tab.id, { action: 'startCapture', mode: 'crop' });
        break;
      case 'screenshot-fullpage':
        await chrome.tabs.sendMessage(tab.id, { action: 'startFullPageCapture' });
        break;
      case 'screenshot-selection':
        await chrome.tabs.sendMessage(tab.id, { action: 'startCapture', mode: 'capture' });
        break;
      case 'screenshot-history':
        // Open settings page with history
        chrome.tabs.create({ url: 'settings.html#history' });
        break;
    }

    logger.log('Context menu action executed:', info.menuItemId);
  } catch (error) {
    logger.error('Context menu error:', error);
  }
});

// Handle keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  // Check if we're on a restricted page
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
    logger.info('Cannot capture on chrome:// pages');
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

    // Route to correct handler based on command
    if (command === 'capture-screenshot') {
      await chrome.tabs.sendMessage(tab.id, { action: 'startCapture', mode: 'crop' });
    } else if (command === 'capture-fullpage') {
      await chrome.tabs.sendMessage(tab.id, { action: 'startFullPageCapture' });
    } else if (command === 'capture-selection') {
      // NEW: Selection mode shortcut
      await chrome.tabs.sendMessage(tab.id, { action: 'startCapture', mode: 'capture' });
    }
  } catch (error) {
    logger.error('Error starting capture:', error);
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
          logger.error('Screenshot error:', chrome.runtime.lastError);
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
          logger.error('Download error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      });
    } catch (error) {
      logger.error('Error processing download:', error);
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

  // ============================================================================
  // NEW: FOLDER MANAGEMENT HANDLERS
  // ============================================================================

  if (request.action === 'listDriveFolders') {
    (async () => {
      try {
        const folders = await googleDriveUploader.listFolders(request.parentId);
        sendResponse({ success: true, folders });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'createDriveFolder') {
    (async () => {
      try {
        const folderId = await googleDriveUploader.createFolder(
          request.folderName,
          request.parentId
        );
        sendResponse({ success: true, folderId });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  // ============================================================================
  // NEW: FILE MANAGEMENT HANDLERS
  // ============================================================================

  if (request.action === 'deleteDriveFile') {
    (async () => {
      try {
        await googleDriveUploader.deleteFile(request.fileId);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'renameDriveFile') {
    (async () => {
      try {
        await googleDriveUploader.renameFile(request.fileId, request.newName);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'updateDriveFileDescription') {
    (async () => {
      try {
        await googleDriveUploader.updateFileDescription(
          request.fileId,
          request.description
        );
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'getDriveFileInfo') {
    (async () => {
      try {
        const info = await googleDriveUploader.getFileInfo(request.fileId);
        sendResponse({ success: true, info });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'getUploadHistory') {
    try {
      const history = googleDriveUploader.getHistory(request.limit);
      sendResponse({ success: true, history });
    } catch (error) {
      sendResponse({
        success: false,
        error: getUserFriendlyError(error.message)
      });
    }
    return true;
  }

  if (request.action === 'clearUploadHistory') {
    (async () => {
      try {
        await googleDriveUploader.clearHistory();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  // ============================================================================
  // NEW: BATCH OPERATIONS HANDLERS
  // ============================================================================

  if (request.action === 'batchUpload') {
    (async () => {
      try {
        const result = await googleDriveUploader.batchUpload(request.files);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'batchDelete') {
    (async () => {
      try {
        const result = await googleDriveUploader.batchDelete(request.fileIds);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  // ============================================================================
  // NEW: ENHANCED SHARING HANDLERS
  // ============================================================================

  if (request.action === 'generateQRCode') {
    (async () => {
      try {
        const qrCode = await googleDriveUploader.generateQRCode(request.link);
        sendResponse({ success: true, qrCode });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'sendToWebhook') {
    (async () => {
      try {
        await googleDriveUploader.sendToWebhook(
          request.webhookUrl,
          request.message,
          request.link,
          request.filename
        );
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: getUserFriendlyError(error.message)
        });
      }
    })();
    return true;
  }

  if (request.action === 'generateEmailLink') {
    try {
      const emailLink = googleDriveUploader.generateEmailLink(
        request.link,
        request.filename,
        request.subject,
        request.body
      );
      sendResponse({ success: true, emailLink });
    } catch (error) {
      sendResponse({
        success: false,
        error: getUserFriendlyError(error.message)
      });
    }
    return true;
  }
});

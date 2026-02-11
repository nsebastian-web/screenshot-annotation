// Google Drive API integration module
// Handles authentication, upload, and sharing operations

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
  async shareScreenshot(blob, filename) {
    try {
      // Try silent auth first
      try {
        await this.authenticate(false);
      } catch (error) {
        // If silent fails, try interactive
        await this.authenticate(true);
      }

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

// GoogleDriveUploader class is now available in the scope where this code is eval'd

// End-to-end encryption utilities using Web Crypto API

class EncryptionManager {
  constructor() {
    this.algorithm = {
      name: 'AES-GCM',
      length: 256
    };
    this.keyPair = null;
    this.publicKey = null;
    this.privateKey = null;
  }

  // Generate a new key pair for the user
  async generateKeyPair() {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );

      this.keyPair = keyPair;
      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;

      // Export public key for sharing
      const exportedPublicKey = await window.crypto.subtle.exportKey(
        'spki',
        keyPair.publicKey
      );

      return {
        publicKey: this.arrayBufferToBase64(exportedPublicKey),
        keyPair
      };
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw new Error('Failed to generate encryption keys');
    }
  }

  // Import a public key from another user
  async importPublicKey(publicKeyBase64) {
    try {
      const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyBase64);
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        []
      );
      return publicKey;
    } catch (error) {
      console.error('Error importing public key:', error);
      throw new Error('Failed to import public key');
    }
  }

  // Generate a shared secret between two users
  async deriveSharedSecret(otherPublicKey) {
    try {
      const sharedSecret = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: otherPublicKey
        },
        this.privateKey,
        256
      );
      return sharedSecret;
    } catch (error) {
      console.error('Error deriving shared secret:', error);
      throw new Error('Failed to derive shared secret');
    }
  }

  // Generate an encryption key from shared secret
  async deriveEncryptionKey(sharedSecret, salt = null) {
    try {
      if (!salt) {
        salt = window.crypto.getRandomValues(new Uint8Array(16));
      }

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const encryptionKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        this.algorithm,
        false,
        ['encrypt', 'decrypt']
      );

      return {
        key: encryptionKey,
        salt: this.arrayBufferToBase64(salt)
      };
    } catch (error) {
      console.error('Error deriving encryption key:', error);
      throw new Error('Failed to derive encryption key');
    }
  }

  // Encrypt a message
  async encryptMessage(message, recipientPublicKey) {
    try {
      // Import recipient's public key
      const importedPublicKey = await this.importPublicKey(recipientPublicKey);
      
      // Derive shared secret
      const sharedSecret = await this.deriveSharedSecret(importedPublicKey);
      
      // Derive encryption key
      const { key: encryptionKey, salt } = await this.deriveEncryptionKey(sharedSecret);
      
      // Generate IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Convert message to ArrayBuffer
      const messageBuffer = new TextEncoder().encode(message);
      
      // Encrypt the message
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: this.algorithm.name,
          iv: iv
        },
        encryptionKey,
        messageBuffer
      );

      // Combine IV, salt, and encrypted data
      const combined = new Uint8Array(iv.length + salt.length + encryptedData.byteLength);
      combined.set(iv, 0);
      combined.set(this.base64ToArrayBuffer(salt), iv.length);
      combined.set(new Uint8Array(encryptedData), iv.length + salt.length);

      return {
        encryptedData: this.arrayBufferToBase64(combined),
        iv: this.arrayBufferToBase64(iv),
        salt: salt
      };
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  // Decrypt a message
  async decryptMessage(encryptedData, senderPublicKey, iv, salt) {
    try {
      // Import sender's public key
      const importedPublicKey = await this.importPublicKey(senderPublicKey);
      
      // Derive shared secret
      const sharedSecret = await this.deriveSharedSecret(importedPublicKey);
      
      // Derive encryption key
      const { key: encryptionKey } = await this.deriveEncryptionKey(
        sharedSecret,
        this.base64ToArrayBuffer(salt)
      );
      
      // Decrypt the message
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: this.algorithm.name,
          iv: this.base64ToArrayBuffer(iv)
        },
        encryptionKey,
        this.base64ToArrayBuffer(encryptedData)
      );

      // Convert back to string
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // Encrypt a file
  async encryptFile(file, recipientPublicKey) {
    try {
      const fileBuffer = await file.arrayBuffer();
      
      // Import recipient's public key
      const importedPublicKey = await this.importPublicKey(recipientPublicKey);
      
      // Derive shared secret
      const sharedSecret = await this.deriveSharedSecret(importedPublicKey);
      
      // Derive encryption key
      const { key: encryptionKey, salt } = await this.deriveEncryptionKey(sharedSecret);
      
      // Generate IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the file
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: this.algorithm.name,
          iv: iv
        },
        encryptionKey,
        fileBuffer
      );

      return {
        encryptedData: this.arrayBufferToBase64(encryptedData),
        iv: this.arrayBufferToBase64(iv),
        salt: salt,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  // Decrypt a file
  async decryptFile(encryptedData, senderPublicKey, iv, salt, fileName, fileType) {
    try {
      // Import sender's public key
      const importedPublicKey = await this.importPublicKey(senderPublicKey);
      
      // Derive shared secret
      const sharedSecret = await this.deriveSharedSecret(importedPublicKey);
      
      // Derive encryption key
      const { key: encryptionKey } = await this.deriveEncryptionKey(
        sharedSecret,
        this.base64ToArrayBuffer(salt)
      );
      
      // Decrypt the file
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: this.algorithm.name,
          iv: this.base64ToArrayBuffer(iv)
        },
        encryptionKey,
        this.base64ToArrayBuffer(encryptedData)
      );

      // Create a new file from the decrypted data
      return new File([decryptedData], fileName, { type: fileType });
    } catch (error) {
      console.error('Error decrypting file:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  // Utility functions for base64 conversion
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Generate a random key for room encryption
  async generateRoomKey() {
    try {
      const key = await window.crypto.subtle.generateKey(
        this.algorithm,
        true,
        ['encrypt', 'decrypt']
      );

      const exportedKey = await window.crypto.subtle.exportKey('raw', key);
      return {
        key,
        keyBase64: this.arrayBufferToBase64(exportedKey)
      };
    } catch (error) {
      console.error('Error generating room key:', error);
      throw new Error('Failed to generate room key');
    }
  }

  // Import a room key
  async importRoomKey(keyBase64) {
    try {
      const keyBuffer = this.base64ToArrayBuffer(keyBase64);
      const key = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        this.algorithm,
        false,
        ['encrypt', 'decrypt']
      );
      return key;
    } catch (error) {
      console.error('Error importing room key:', error);
      throw new Error('Failed to import room key');
    }
  }

  // Encrypt message for room
  async encryptRoomMessage(message, roomKey) {
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const messageBuffer = new TextEncoder().encode(message);
      
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: this.algorithm.name,
          iv: iv
        },
        roomKey,
        messageBuffer
      );

      return {
        encryptedData: this.arrayBufferToBase64(encryptedData),
        iv: this.arrayBufferToBase64(iv)
      };
    } catch (error) {
      console.error('Error encrypting room message:', error);
      throw new Error('Failed to encrypt room message');
    }
  }

  // Decrypt message for room
  async decryptRoomMessage(encryptedData, roomKey, iv) {
    try {
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: this.algorithm.name,
          iv: this.base64ToArrayBuffer(iv)
        },
        roomKey,
        this.base64ToArrayBuffer(encryptedData)
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Error decrypting room message:', error);
      throw new Error('Failed to decrypt room message');
    }
  }
}

// Create a singleton instance
const encryptionManager = new EncryptionManager();

export default encryptionManager;
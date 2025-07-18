import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

export interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EncryptionResult {
  success: boolean;
  encryptedPath?: string;
  keyId?: string;
  error?: string;
}

export interface DecryptionResult {
  success: boolean;
  decryptedPath?: string;
  error?: string;
}

export class FileEncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private tagLength = 16; // 128 bits
  private saltLength = 32; // 256 bits

  constructor(private masterKey?: string) {
    // Use environment variable if no master key provided
    this.masterKey = masterKey || process.env.FILE_ENCRYPTION_MASTER_KEY;

    if (!this.masterKey) {
      console.warn('No master key configured for file encryption');
    }
  }

  async encryptFile(
    inputPath: string,
    outputPath: string,
    keyId?: string
  ): Promise<EncryptionResult> {
    try {
      // Generate or retrieve encryption key
      const encryptionKey = keyId
        ? await this.getEncryptionKey(keyId)
        : await this.generateEncryptionKey();

      if (!encryptionKey) {
        return {
          success: false,
          error: 'Failed to obtain encryption key',
        };
      }

      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, encryptionKey.key, iv);

      // Read input file
      const inputData = await fs.readFile(inputPath);

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(inputData), cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      const outputData = Buffer.concat([iv, authTag, encrypted]);

      // Write to output file
      await fs.writeFile(outputPath, outputData);

      return {
        success: true,
        encryptedPath: outputPath,
        keyId: encryptionKey.id,
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async decryptFile(
    inputPath: string,
    outputPath: string,
    keyId: string
  ): Promise<DecryptionResult> {
    try {
      // Get encryption key
      const encryptionKey = await this.getEncryptionKey(keyId);
      if (!encryptionKey) {
        return {
          success: false,
          error: 'Encryption key not found',
        };
      }

      // Read encrypted file
      const encryptedData = await fs.readFile(inputPath);

      // Extract IV, auth tag, and encrypted content
      const iv = encryptedData.slice(0, this.ivLength);
      const authTag = encryptedData.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedData.slice(this.ivLength + this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      // Write to output file
      await fs.writeFile(outputPath, decrypted);

      return {
        success: true,
        decryptedPath: outputPath,
      };
    } catch (error) {
      console.error('Error decrypting file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async encryptStream(
    inputPath: string,
    outputPath: string,
    keyId?: string
  ): Promise<EncryptionResult> {
    try {
      // Generate or retrieve encryption key
      const encryptionKey = keyId
        ? await this.getEncryptionKey(keyId)
        : await this.generateEncryptionKey();

      if (!encryptionKey) {
        return {
          success: false,
          error: 'Failed to obtain encryption key',
        };
      }

      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher stream
      const cipher = crypto.createCipheriv(this.algorithm, encryptionKey.key, iv);

      // Create read and write streams
      const input = createReadStream(inputPath);
      const output = createWriteStream(outputPath);

      // Write IV to output first
      output.write(iv);

      // Pipe through cipher
      await pipeline(input, cipher, output);

      // Get and write auth tag
      const authTag = cipher.getAuthTag();
      await fs.appendFile(outputPath, authTag);

      return {
        success: true,
        encryptedPath: outputPath,
        keyId: encryptionKey.id,
      };
    } catch (error) {
      console.error('Error encrypting stream:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async generateEncryptionKey(): Promise<EncryptionKey> {
    const keyId = crypto.randomUUID();
    const key = crypto.randomBytes(this.keyLength);

    // Store key securely (in production, use a key management service)
    await this.storeKey(keyId, key);

    return {
      id: keyId,
      key,
      algorithm: this.algorithm,
      createdAt: new Date(),
    };
  }

  private async getEncryptionKey(keyId: string): Promise<EncryptionKey | null> {
    // In production, retrieve from secure key storage
    return await this.retrieveKey(keyId);
  }

  private async storeKey(keyId: string, key: Buffer): Promise<void> {
    // In production, use a secure key management service (AWS KMS, Azure Key Vault, etc.)
    // For now, we'll use a simple encrypted storage

    if (!this.masterKey) {
      throw new Error('Master key not configured');
    }

    const salt = crypto.randomBytes(this.saltLength);
    const derivedKey = crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

    const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Store encrypted key with metadata
    const keyData = {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedKey: encrypted.toString('base64'),
      algorithm: this.algorithm,
      createdAt: new Date().toISOString(),
    };

    // In production, store in secure database or key management service
    await fs.writeFile(`/tmp/key_${keyId}.json`, JSON.stringify(keyData, null, 2));
  }

  private async retrieveKey(keyId: string): Promise<EncryptionKey | null> {
    try {
      if (!this.masterKey) {
        throw new Error('Master key not configured');
      }

      // In production, retrieve from secure storage
      const keyDataRaw = await fs.readFile(`/tmp/key_${keyId}.json`, 'utf-8');
      const keyData = JSON.parse(keyDataRaw);

      const salt = Buffer.from(keyData.salt, 'base64');
      const iv = Buffer.from(keyData.iv, 'base64');
      const authTag = Buffer.from(keyData.authTag, 'base64');
      const encryptedKey = Buffer.from(keyData.encryptedKey, 'base64');

      const derivedKey = crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');

      const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
      decipher.setAuthTag(authTag);

      const key = Buffer.concat([decipher.update(encryptedKey), decipher.final()]);

      return {
        id: keyId,
        key,
        algorithm: keyData.algorithm,
        createdAt: new Date(keyData.createdAt),
      };
    } catch (error) {
      console.error('Error retrieving key:', error);
      return null;
    }
  }

  async rotateKeys(daysOld: number = 90): Promise<{ rotated: number; failed: number }> {
    // In production, implement key rotation strategy
    console.log(`Key rotation not implemented. Would rotate keys older than ${daysOld} days.`);
    return { rotated: 0, failed: 0 };
  }

  generateFileHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const fileData = await fs.readFile(filePath);
      const actualHash = this.generateFileHash(fileData);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('Error verifying file integrity:', error);
      return false;
    }
  }
}

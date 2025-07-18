import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  tagLength: number;
}

export class EncryptionService {
  private readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 32,
    tagLength: 16,
  };

  private masterKey: string;

  constructor() {
    // In production, this should come from environment variables or key management service
    this.masterKey =
      process.env.ENCRYPTION_MASTER_KEY || 'default-development-key-do-not-use-in-production';

    if (
      this.masterKey === 'default-development-key-do-not-use-in-production' &&
      process.env.NODE_ENV === 'production'
    ) {
      throw new Error('Production encryption key not configured');
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      // Generate random salt and IV
      const salt = randomBytes(this.config.saltLength);
      const iv = randomBytes(this.config.ivLength);

      // Derive key from master key and salt
      const key = await this.deriveKey(this.masterKey, salt);

      // Create cipher
      const cipher = createCipheriv(this.config.algorithm, key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

      // Get auth tag
      const tag = cipher.getAuthTag();

      // Combine salt, iv, tag, and encrypted data
      const combined = Buffer.concat([salt, iv, tag, encrypted]);

      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = combined.slice(0, this.config.saltLength);
      const iv = combined.slice(
        this.config.saltLength,
        this.config.saltLength + this.config.ivLength
      );
      const tag = combined.slice(
        this.config.saltLength + this.config.ivLength,
        this.config.saltLength + this.config.ivLength + this.config.tagLength
      );
      const encrypted = combined.slice(
        this.config.saltLength + this.config.ivLength + this.config.tagLength
      );

      // Derive key from master key and salt
      const key = await this.deriveKey(this.masterKey, salt);

      // Create decipher
      const decipher = createDecipheriv(this.config.algorithm, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt data
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt object fields
   */
  async encryptFields<T extends Record<string, any>>(data: T, fields: string[]): Promise<T> {
    const encrypted = { ...data };

    for (const field of fields) {
      if (data[field] !== null && data[field] !== undefined) {
        const value = typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field]);

        encrypted[field] = await this.encrypt(value);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt object fields
   */
  async decryptFields<T extends Record<string, any>>(data: T, fields: string[]): Promise<T> {
    const decrypted = { ...data };

    for (const field of fields) {
      if (data[field] !== null && data[field] !== undefined) {
        try {
          const decryptedValue = await this.decrypt(data[field]);

          // Try to parse as JSON, fallback to string
          try {
            decrypted[field] = JSON.parse(decryptedValue);
          } catch {
            decrypted[field] = decryptedValue;
          }
        } catch (error) {
          // If decryption fails, leave the field as is
          console.error(`Failed to decrypt field ${field}:`, error);
        }
      }
    }

    return decrypted;
  }

  /**
   * Hash sensitive data (one-way)
   */
  async hash(data: string): Promise<string> {
    const salt = randomBytes(this.config.saltLength);
    const hash = (await scryptAsync(data, salt, 64)) as Buffer;

    // Combine salt and hash
    const combined = Buffer.concat([salt, hash]);
    return combined.toString('base64');
  }

  /**
   * Verify hashed data
   */
  async verifyHash(data: string, hashedData: string): Promise<boolean> {
    try {
      const combined = Buffer.from(hashedData, 'base64');
      const salt = combined.slice(0, this.config.saltLength);
      const storedHash = combined.slice(this.config.saltLength);

      const hash = (await scryptAsync(data, salt, 64)) as Buffer;
      return hash.equals(storedHash);
    } catch {
      return false;
    }
  }

  /**
   * Derive encryption key from master key and salt
   */
  private async deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
    return scryptAsync(masterKey, salt, this.config.keyLength) as Promise<Buffer>;
  }

  /**
   * Encrypt sensitive stand fields
   */
  async encryptStandData(standData: any): Promise<any> {
    const sensitiveFields = ['metadata', 'infrastructure.securityCodes'];
    return this.encryptFields(standData, sensitiveFields);
  }

  /**
   * Decrypt sensitive stand fields
   */
  async decryptStandData(standData: any): Promise<any> {
    const sensitiveFields = ['metadata', 'infrastructure.securityCodes'];
    return this.decryptFields(standData, sensitiveFields);
  }

  /**
   * Generate encrypted API key
   */
  async generateApiKey(
    userId: string,
    organizationId: string
  ): Promise<{
    apiKey: string;
    hashedKey: string;
  }> {
    // Generate random key
    const environment = process.env.NODE_ENV || 'dev';
    const randomPart = randomBytes(16).toString('hex');
    const apiKey = `sk_${environment}_${randomPart}`;

    // Hash for storage
    const hashedKey = await this.hash(apiKey);

    // Store metadata encrypted
    const metadata = {
      userId,
      organizationId,
      createdAt: new Date().toISOString(),
    };

    const encryptedMetadata = await this.encrypt(JSON.stringify(metadata));

    return {
      apiKey,
      hashedKey: `${hashedKey}:${encryptedMetadata}`,
    };
  }

  /**
   * Verify API key
   */
  async verifyApiKey(
    apiKey: string,
    storedHash: string
  ): Promise<{ valid: boolean; metadata?: any }> {
    try {
      const [hashedKey, encryptedMetadata] = storedHash.split(':');

      // Verify key
      const valid = await this.verifyHash(apiKey, hashedKey);
      if (!valid) {
        return { valid: false };
      }

      // Decrypt metadata
      const metadata = JSON.parse(await this.decrypt(encryptedMetadata));

      return { valid: true, metadata };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(oldMasterKey: string, newMasterKey: string, data: string): Promise<string> {
    // Temporarily use old key to decrypt
    const tempMasterKey = this.masterKey;
    this.masterKey = oldMasterKey;

    const decrypted = await this.decrypt(data);

    // Use new key to encrypt
    this.masterKey = newMasterKey;
    const encrypted = await this.encrypt(decrypted);

    // Restore original key
    this.masterKey = tempMasterKey;

    return encrypted;
  }
}

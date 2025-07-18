import * as crypto from 'crypto';
import { StandCapabilities } from '../types';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export interface EncryptedField {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface EncryptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class EncryptionService {
  private static readonly DEFAULT_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
  };

  private encryptionKey: Buffer;
  private config: EncryptionConfig;

  constructor(encryptionKey?: string, config?: Partial<EncryptionConfig>) {
    this.config = { ...EncryptionService.DEFAULT_CONFIG, ...config };

    if (encryptionKey) {
      this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    } else {
      // Use environment variable or generate a key
      const keyHex = process.env.CAPABILITIES_ENCRYPTION_KEY;
      if (keyHex) {
        this.encryptionKey = Buffer.from(keyHex, 'hex');
      } else {
        throw new Error(
          'Encryption key not provided and CAPABILITIES_ENCRYPTION_KEY environment variable not set'
        );
      }
    }

    if (this.encryptionKey.length !== this.config.keyLength) {
      throw new Error(
        `Encryption key must be ${this.config.keyLength} bytes (${this.config.keyLength * 2} hex characters)`
      );
    }
  }

  /**
   * Encrypt a string value
   */
  encryptString(plaintext: string): EncryptedField {
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipherGCM(this.config.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt a string value
   */
  decryptString(encryptedField: EncryptedField): string {
    const iv = Buffer.from(encryptedField.iv, 'hex');
    const tag = Buffer.from(encryptedField.tag, 'hex');

    const decipher = crypto.createDecipherGCM(this.config.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedField.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt a JSON object
   */
  encryptObject(obj: any): EncryptedField {
    const jsonString = JSON.stringify(obj);
    return this.encryptString(jsonString);
  }

  /**
   * Decrypt a JSON object
   */
  decryptObject<T = any>(encryptedField: EncryptedField): T {
    const jsonString = this.decryptString(encryptedField);
    return JSON.parse(jsonString);
  }

  /**
   * Encrypt sensitive fields in stand capabilities
   */
  encryptCapabilities(capabilities: StandCapabilities): EncryptionResult {
    try {
      const encryptedCapabilities = { ...capabilities };

      // Encrypt sensitive operational constraints
      if (capabilities.operationalConstraints) {
        const sensitiveConstraints = { ...capabilities.operationalConstraints };

        // Encrypt noise restrictions if present
        if (sensitiveConstraints.noiseRestrictions) {
          const encrypted = this.encryptObject(sensitiveConstraints.noiseRestrictions);
          (sensitiveConstraints as any).noiseRestrictions = encrypted;
        }

        // Encrypt security-related operational data
        if (sensitiveConstraints.securityRequirements) {
          const encrypted = this.encryptObject(sensitiveConstraints.securityRequirements);
          (sensitiveConstraints as any).securityRequirements = encrypted;
        }

        encryptedCapabilities.operationalConstraints = sensitiveConstraints;
      }

      // Encrypt sensitive infrastructure data
      if (capabilities.infrastructure) {
        const sensitiveInfrastructure = { ...capabilities.infrastructure };

        // Encrypt security system details
        if (sensitiveInfrastructure.securitySystemDetails) {
          const encrypted = this.encryptObject(sensitiveInfrastructure.securitySystemDetails);
          (sensitiveInfrastructure as any).securitySystemDetails = encrypted;
        }

        // Encrypt fire suppression system details
        if (sensitiveInfrastructure.fireSuppressionDetails) {
          const encrypted = this.encryptObject(sensitiveInfrastructure.fireSuppressionDetails);
          (sensitiveInfrastructure as any).fireSuppressionDetails = encrypted;
        }

        encryptedCapabilities.infrastructure = sensitiveInfrastructure;
      }

      // Encrypt sensitive maintenance access codes
      // TODO: Add maintenanceAccess to StandCapabilities type
      // if (capabilities.maintenanceAccess) {
      //   const encrypted = this.encryptObject(capabilities.maintenanceAccess);
      //   (encryptedCapabilities as any).maintenanceAccess = encrypted;
      // }

      return {
        success: true,
        data: encryptedCapabilities,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encryption error',
      };
    }
  }

  /**
   * Decrypt sensitive fields in stand capabilities
   */
  decryptCapabilities(encryptedCapabilities: any): EncryptionResult {
    try {
      const decryptedCapabilities = { ...encryptedCapabilities };

      // Decrypt operational constraints
      if (encryptedCapabilities.operationalConstraints) {
        const constraints = { ...encryptedCapabilities.operationalConstraints };

        // Decrypt noise restrictions if present and encrypted
        if (constraints.noiseRestrictions && this.isEncryptedField(constraints.noiseRestrictions)) {
          constraints.noiseRestrictions = this.decryptObject(constraints.noiseRestrictions);
        }

        // Decrypt security requirements if present and encrypted
        if (
          constraints.securityRequirements &&
          this.isEncryptedField(constraints.securityRequirements)
        ) {
          constraints.securityRequirements = this.decryptObject(constraints.securityRequirements);
        }

        decryptedCapabilities.operationalConstraints = constraints;
      }

      // Decrypt infrastructure data
      if (encryptedCapabilities.infrastructure) {
        const infrastructure = { ...encryptedCapabilities.infrastructure };

        // Decrypt security system details
        if (
          infrastructure.securitySystemDetails &&
          this.isEncryptedField(infrastructure.securitySystemDetails)
        ) {
          infrastructure.securitySystemDetails = this.decryptObject(
            infrastructure.securitySystemDetails
          );
        }

        // Decrypt fire suppression details
        if (
          infrastructure.fireSuppressionDetails &&
          this.isEncryptedField(infrastructure.fireSuppressionDetails)
        ) {
          infrastructure.fireSuppressionDetails = this.decryptObject(
            infrastructure.fireSuppressionDetails
          );
        }

        decryptedCapabilities.infrastructure = infrastructure;
      }

      // Decrypt maintenance access codes
      if (
        encryptedCapabilities.maintenanceAccess &&
        this.isEncryptedField(encryptedCapabilities.maintenanceAccess)
      ) {
        decryptedCapabilities.maintenanceAccess = this.decryptObject(
          encryptedCapabilities.maintenanceAccess
        );
      }

      return {
        success: true,
        data: decryptedCapabilities,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown decryption error',
      };
    }
  }

  /**
   * Check if a value is an encrypted field
   */
  private isEncryptedField(value: any): value is EncryptedField {
    return (
      typeof value === 'object' &&
      value !== null &&
      'encrypted' in value &&
      'iv' in value &&
      'tag' in value
    );
  }

  /**
   * Generate a new encryption key
   */
  static generateKey(): string {
    return crypto.randomBytes(EncryptionService.DEFAULT_CONFIG.keyLength).toString('hex');
  }

  /**
   * Derive key from password (for development/testing)
   */
  static deriveKeyFromPassword(password: string, salt: string): string {
    return crypto
      .pbkdf2Sync(password, salt, 10000, EncryptionService.DEFAULT_CONFIG.keyLength, 'sha256')
      .toString('hex');
  }

  /**
   * Encrypt maintenance record sensitive data
   */
  encryptMaintenanceRecord(record: any): EncryptionResult {
    try {
      const encryptedRecord = { ...record };

      // Encrypt cost information
      if (record.cost !== undefined && record.cost !== null) {
        encryptedRecord.cost = this.encryptObject({ value: record.cost });
      }

      // Encrypt sensitive work descriptions
      if (record.workPerformed && record.workPerformed.includes('SENSITIVE:')) {
        encryptedRecord.workPerformed = this.encryptString(record.workPerformed);
      }

      // Encrypt contractor information
      if (record.contractorDetails) {
        encryptedRecord.contractorDetails = this.encryptObject(record.contractorDetails);
      }

      return {
        success: true,
        data: encryptedRecord,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encryption error',
      };
    }
  }

  /**
   * Decrypt maintenance record sensitive data
   */
  decryptMaintenanceRecord(encryptedRecord: any): EncryptionResult {
    try {
      const decryptedRecord = { ...encryptedRecord };

      // Decrypt cost information
      if (encryptedRecord.cost && this.isEncryptedField(encryptedRecord.cost)) {
        const decryptedCost = this.decryptObject(encryptedRecord.cost);
        decryptedRecord.cost = decryptedCost.value;
      }

      // Decrypt work descriptions
      if (encryptedRecord.workPerformed && this.isEncryptedField(encryptedRecord.workPerformed)) {
        decryptedRecord.workPerformed = this.decryptString(encryptedRecord.workPerformed);
      }

      // Decrypt contractor details
      if (
        encryptedRecord.contractorDetails &&
        this.isEncryptedField(encryptedRecord.contractorDetails)
      ) {
        decryptedRecord.contractorDetails = this.decryptObject(encryptedRecord.contractorDetails);
      }

      return {
        success: true,
        data: decryptedRecord,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown decryption error',
      };
    }
  }

  /**
   * Bulk encrypt multiple records
   */
  async bulkEncrypt(
    records: any[],
    encryptFunction: (record: any) => EncryptionResult
  ): Promise<{
    successful: any[];
    failed: Array<{ record: any; error: string }>;
  }> {
    const successful: any[] = [];
    const failed: Array<{ record: any; error: string }> = [];

    for (const record of records) {
      const result = encryptFunction(record);
      if (result.success) {
        successful.push(result.data);
      } else {
        failed.push({ record, error: result.error || 'Unknown error' });
      }
    }

    return { successful, failed };
  }

  /**
   * Bulk decrypt multiple records
   */
  async bulkDecrypt(
    records: any[],
    decryptFunction: (record: any) => EncryptionResult
  ): Promise<{
    successful: any[];
    failed: Array<{ record: any; error: string }>;
  }> {
    const successful: any[] = [];
    const failed: Array<{ record: any; error: string }> = [];

    for (const record of records) {
      const result = decryptFunction(record);
      if (result.success) {
        successful.push(result.data);
      } else {
        failed.push({ record, error: result.error || 'Unknown error' });
      }
    }

    return { successful, failed };
  }

  /**
   * Test encryption/decryption functionality
   */
  test(): boolean {
    try {
      const testData = { test: 'Hello, World!', number: 42 };
      const encrypted = this.encryptObject(testData);
      const decrypted = this.decryptObject(encrypted);

      return JSON.stringify(testData) === JSON.stringify(decrypted);
    } catch (error) {
      return false;
    }
  }
}

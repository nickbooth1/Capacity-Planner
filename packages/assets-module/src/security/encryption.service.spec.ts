import { EncryptionService } from './encryption.service';
import { StandCapabilities, ICAOAircraftCategory } from '../types';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const testKey = EncryptionService.generateKey();

  beforeEach(() => {
    encryptionService = new EncryptionService(testKey);
  });

  describe('constructor', () => {
    it('should create service with valid key', () => {
      expect(encryptionService).toBeDefined();
      expect(encryptionService.test()).toBe(true);
    });

    it('should throw error with invalid key length', () => {
      expect(() => {
        new EncryptionService('invalid-key');
      }).toThrow('Encryption key must be 32 bytes');
    });

    it('should throw error with no key and no environment variable', () => {
      delete process.env.CAPABILITIES_ENCRYPTION_KEY;
      expect(() => {
        new EncryptionService();
      }).toThrow('Encryption key not provided');
    });
  });

  describe('string encryption/decryption', () => {
    it('should encrypt and decrypt strings correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encryptString(plaintext);
      const decrypted = encryptionService.decryptString(encrypted);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'Hello, World!';
      const encrypted1 = encryptionService.encryptString(plaintext);
      const encrypted2 = encryptionService.encryptString(plaintext);

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // But both should decrypt to the same plaintext
      expect(encryptionService.decryptString(encrypted1)).toBe(plaintext);
      expect(encryptionService.decryptString(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encryptionService.encryptString(plaintext);
      const decrypted = encryptionService.decryptString(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello, 世界! 🌍';
      const encrypted = encryptionService.encryptString(plaintext);
      const decrypted = encryptionService.decryptString(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('object encryption/decryption', () => {
    it('should encrypt and decrypt objects correctly', () => {
      const obj = {
        string: 'Hello',
        number: 42,
        boolean: true,
        nested: { prop: 'value' },
        array: [1, 2, 3],
      };

      const encrypted = encryptionService.encryptObject(obj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it('should handle complex nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              data: 'deep nested value',
              numbers: [1, 2, 3, 4, 5],
            },
          },
        },
      };

      const encrypted = encryptionService.encryptObject(obj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });
  });

  describe('capability encryption/decryption', () => {
    const testCapabilities: StandCapabilities = {
      dimensions: {
        length: 60,
        width: 45,
        height: 5,
        icaoCategory: ICAOAircraftCategory.C,
      },
      aircraftCompatibility: {
        supportedAircraftTypes: ['A320', 'B737'],
        maxWingspan: 36,
        maxLength: 45,
        maxWeight: 79000,
      },
      groundSupport: {
        hasPowerSupply: true,
        hasAirConditioning: true,
        hasJetbridge: true,
        groundPowerUnits: 2,
        airStartUnits: 1,
      },
      operationalConstraints: {
        operatingHours: {
          start: '05:00',
          end: '23:00',
        },
        weatherLimitations: ['HIGH_WIND', 'HEAVY_RAIN'],
        noiseRestrictions: {
          hasRestrictions: true,
          maxDecibels: 85,
          restrictedHours: ['22:00-06:00'],
        },
        securityRequirements: {
          level: 'high',
          checkpoints: ['main', 'secondary'],
        },
      },
      environmentalFeatures: {
        deIcingCapability: true,
        fuelHydrantSystem: true,
        wasteServiceCapability: true,
        cateringServiceCapability: true,
      },
      infrastructure: {
        lightingType: 'LED',
        hasFireSuppressionSystem: true,
        hasSecuritySystem: true,
        pavementType: 'CONCRETE',
        drainageSystem: 'SUBSURFACE',
        securitySystemDetails: {
          cameras: 12,
          sensors: 8,
          accessCodes: ['123456', '789012'],
        },
        fireSuppressionDetails: {
          type: 'foam',
          capacity: 5000,
          lastInspection: '2024-01-15',
        },
      },
      maintenanceAccess: {
        codes: ['MAINT001', 'MAINT002'],
        schedules: ['daily', 'weekly'],
      },
    };

    it('should encrypt sensitive fields in capabilities', () => {
      const result = encryptionService.encryptCapabilities(testCapabilities);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const encrypted = result.data;

      // Check that sensitive fields are encrypted
      expect(encrypted.operationalConstraints.noiseRestrictions).toHaveProperty('encrypted');
      expect(encrypted.operationalConstraints.securityRequirements).toHaveProperty('encrypted');
      expect(encrypted.infrastructure.securitySystemDetails).toHaveProperty('encrypted');
      expect(encrypted.infrastructure.fireSuppressionDetails).toHaveProperty('encrypted');
      expect(encrypted.maintenanceAccess).toHaveProperty('encrypted');

      // Check that non-sensitive fields are not encrypted
      expect(encrypted.dimensions).toEqual(testCapabilities.dimensions);
      expect(encrypted.aircraftCompatibility).toEqual(testCapabilities.aircraftCompatibility);
      expect(encrypted.groundSupport).toEqual(testCapabilities.groundSupport);
    });

    it('should decrypt capabilities back to original form', () => {
      const encryptResult = encryptionService.encryptCapabilities(testCapabilities);
      expect(encryptResult.success).toBe(true);

      const decryptResult = encryptionService.decryptCapabilities(encryptResult.data);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(testCapabilities);
    });

    it('should handle partial capabilities', () => {
      const partialCapabilities: Partial<StandCapabilities> = {
        dimensions: {
          length: 30,
          width: 25,
          icaoCategory: ICAOAircraftCategory.B,
        },
        operationalConstraints: {
          noiseRestrictions: {
            hasRestrictions: false,
          },
        },
      };

      const encryptResult = encryptionService.encryptCapabilities(
        partialCapabilities as StandCapabilities
      );
      expect(encryptResult.success).toBe(true);

      const decryptResult = encryptionService.decryptCapabilities(encryptResult.data);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(partialCapabilities);
    });

    it('should handle capabilities without sensitive fields', () => {
      const basicCapabilities: StandCapabilities = {
        dimensions: {
          length: 40,
          width: 30,
          icaoCategory: ICAOAircraftCategory.B,
        },
        groundSupport: {
          hasPowerSupply: true,
          hasJetbridge: false,
        },
      };

      const encryptResult = encryptionService.encryptCapabilities(basicCapabilities);
      expect(encryptResult.success).toBe(true);

      const decryptResult = encryptionService.decryptCapabilities(encryptResult.data);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(basicCapabilities);
    });
  });

  describe('maintenance record encryption/decryption', () => {
    const testRecord = {
      id: 'maintenance-123',
      standId: 'stand-456',
      type: 'routine',
      cost: 1500.5,
      workPerformed: 'SENSITIVE: Replaced security system components',
      contractorDetails: {
        name: 'SecureTech Solutions',
        contact: 'john.doe@securetech.com',
        clearanceLevel: 'TOP_SECRET',
      },
      scheduledDate: '2024-02-01',
    };

    it('should encrypt sensitive fields in maintenance records', () => {
      const result = encryptionService.encryptMaintenanceRecord(testRecord);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const encrypted = result.data;

      // Check that sensitive fields are encrypted
      expect(encrypted.cost).toHaveProperty('encrypted');
      expect(encrypted.workPerformed).toHaveProperty('encrypted');
      expect(encrypted.contractorDetails).toHaveProperty('encrypted');

      // Check that non-sensitive fields are not encrypted
      expect(encrypted.id).toBe(testRecord.id);
      expect(encrypted.standId).toBe(testRecord.standId);
      expect(encrypted.type).toBe(testRecord.type);
      expect(encrypted.scheduledDate).toBe(testRecord.scheduledDate);
    });

    it('should decrypt maintenance records back to original form', () => {
      const encryptResult = encryptionService.encryptMaintenanceRecord(testRecord);
      expect(encryptResult.success).toBe(true);

      const decryptResult = encryptionService.decryptMaintenanceRecord(encryptResult.data);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(testRecord);
    });

    it('should handle records without sensitive fields', () => {
      const basicRecord = {
        id: 'maintenance-789',
        standId: 'stand-012',
        type: 'inspection',
        scheduledDate: '2024-02-15',
      };

      const encryptResult = encryptionService.encryptMaintenanceRecord(basicRecord);
      expect(encryptResult.success).toBe(true);

      const decryptResult = encryptionService.decryptMaintenanceRecord(encryptResult.data);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(basicRecord);
    });
  });

  describe('bulk operations', () => {
    it('should bulk encrypt multiple records', async () => {
      const records = [
        { data: 'record1', sensitive: true },
        { data: 'record2', sensitive: false },
        { data: 'record3', sensitive: true },
      ];

      const result = await encryptionService.bulkEncrypt(records, (record) =>
        encryptionService.encryptMaintenanceRecord(record)
      );

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
    });

    it('should bulk decrypt multiple records', async () => {
      const records = [
        { data: 'record1', cost: 100 },
        { data: 'record2', cost: 200 },
        { data: 'record3', cost: 300 },
      ];

      // First encrypt them
      const encryptResult = await encryptionService.bulkEncrypt(records, (record) =>
        encryptionService.encryptMaintenanceRecord(record)
      );

      // Then decrypt them
      const decryptResult = await encryptionService.bulkDecrypt(
        encryptResult.successful,
        (record) => encryptionService.decryptMaintenanceRecord(record)
      );

      expect(decryptResult.successful).toHaveLength(3);
      expect(decryptResult.failed).toHaveLength(0);
      expect(decryptResult.successful).toEqual(records);
    });
  });

  describe('key management', () => {
    it('should generate valid keys', () => {
      const key = EncryptionService.generateKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes = 64 hex characters
      expect(/^[a-fA-F0-9]+$/.test(key)).toBe(true);
    });

    it('should derive keys from passwords', () => {
      const password = 'test-password';
      const salt = 'test-salt';
      const key = EncryptionService.deriveKeyFromPassword(password, salt);

      expect(key).toBeDefined();
      expect(key.length).toBe(64);
      expect(/^[a-fA-F0-9]+$/.test(key)).toBe(true);

      // Same password and salt should produce same key
      const key2 = EncryptionService.deriveKeyFromPassword(password, salt);
      expect(key).toBe(key2);
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors gracefully', () => {
      const invalidData = { circular: {} };
      invalidData.circular = invalidData; // Create circular reference

      const result = encryptionService.encryptCapabilities(invalidData as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle decryption errors gracefully', () => {
      const invalidEncrypted = {
        encrypted: 'invalid-data',
        iv: 'invalid-iv',
        tag: 'invalid-tag',
      };

      const result = encryptionService.decryptCapabilities(invalidEncrypted);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('test functionality', () => {
    it('should pass self-test', () => {
      expect(encryptionService.test()).toBe(true);
    });
  });
});

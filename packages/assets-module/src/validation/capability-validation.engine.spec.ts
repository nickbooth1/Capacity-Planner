import { CapabilityValidationEngine } from './capability-validation.engine';
import { StandCapabilities, ICAOAircraftCategory } from '../types';

// Mock the ValidationCache
jest.mock('../cache/validation-cache', () => ({
  ValidationCache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
    clear: jest.fn(),
    getMetrics: jest.fn(() => ({ hits: 0, misses: 0, errors: 0, evictions: 0 })),
  })),
}));

describe('CapabilityValidationEngine', () => {
  let engine: CapabilityValidationEngine;
  let mockCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new CapabilityValidationEngine();
    mockCache = (engine as any).cache;
  });

  describe('validate', () => {
    it('should validate valid stand capabilities', async () => {
      const capabilities: StandCapabilities = {
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: ICAOAircraftCategory.C,
        },
        aircraftCompatibility: {
          maxWingspan: 36,
          maxLength: 40,
          compatibleCategories: [ICAOAircraftCategory.C],
        },
        groundSupport: {
          hasPowerSupply: true,
          powerSupplyType: ['400Hz'],
        },
      };

      mockCache.get.mockResolvedValue(null); // Cache miss

      const { result } = await engine.validate(capabilities);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.icaoCompliant).toBe(true);
      expect(mockCache.set).toHaveBeenCalledWith(capabilities, result, undefined);
    });

    it('should detect cross-capability conflicts', async () => {
      const capabilities: StandCapabilities = {
        dimensions: {
          length: 50,
          width: 30, // Too narrow for the wingspan
        },
        aircraftCompatibility: {
          maxWingspan: 36, // Exceeds safe limits for 30m width
        },
      };

      const { result } = await engine.validate(capabilities);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'aircraftCompatibility.maxWingspan',
          code: 'WINGSPAN_EXCEEDS_WIDTH',
        })
      );
    });

    it('should validate with performance tracking', async () => {
      const capabilities: StandCapabilities = {
        dimensions: { length: 60, width: 45 },
      };

      const response = await engine.validate(capabilities, {
        performanceTracking: true,
      });

      expect(response.performance).toBeDefined();
      expect(response.performance?.totalDuration).toBeGreaterThan(0);
      expect(response.performance?.validatorDurations).toHaveProperty('dimensions');
    });

    it('should validate single capability type', async () => {
      const dimensions = {
        length: 60,
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
      };

      const result = await engine.validateSingle('dimensions', dimensions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle validator errors gracefully', async () => {
      // Force an error by passing invalid data type
      const capabilities = {
        dimensions: 'invalid' as any,
      };

      mockCache.get.mockResolvedValue(null); // Cache miss

      const { result } = await engine.validate(capabilities);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'dimensions',
          code: 'VALIDATOR_ERROR',
        })
      );
    });

    it('should return cached result when available', async () => {
      const capabilities: StandCapabilities = {
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: ICAOAircraftCategory.C,
        },
      };

      const cachedResult = {
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
        timestamp: new Date(),
      };

      mockCache.get.mockResolvedValue(cachedResult);

      const { result } = await engine.validate(capabilities);

      expect(result).toBe(cachedResult);
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should skip cache when useCache is false', async () => {
      const capabilities: StandCapabilities = {
        dimensions: {
          length: 60,
          width: 45,
        },
      };

      const { result } = await engine.validate(capabilities, { useCache: false });

      expect(result.isValid).toBe(true);
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('cross-capability validation', () => {
    it('should warn about missing deicing for snow operations', async () => {
      const capabilities: StandCapabilities = {
        groundSupport: {
          hasDeicing: false,
        },
        operationalConstraints: {
          weatherLimits: {
            snowOperations: true,
          },
        },
      };

      mockCache.get.mockResolvedValue(null); // Cache miss

      const { result } = await engine.validate(capabilities);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'groundSupport.hasDeicing',
          code: 'MISSING_DEICING_FOR_SNOW_OPS',
        })
      );
    });

    it('should error on insufficient width for jetbridge', async () => {
      const capabilities: StandCapabilities = {
        dimensions: {
          length: 50,
          width: 25, // Too narrow for jetbridge
        },
        infrastructure: {
          hasJetbridge: true,
        },
      };

      mockCache.get.mockResolvedValue(null); // Cache miss

      const { result } = await engine.validate(capabilities);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'infrastructure.hasJetbridge',
          code: 'INSUFFICIENT_WIDTH_FOR_JETBRIDGE',
        })
      );
    });
  });

  describe('empty capabilities', () => {
    it('should handle empty capabilities gracefully', async () => {
      const emptyCapabilities = {} as StandCapabilities;
      mockCache.get.mockResolvedValue(null);

      const { result } = await engine.validate(emptyCapabilities);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

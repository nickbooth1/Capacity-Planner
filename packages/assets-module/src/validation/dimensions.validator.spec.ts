import { DimensionsValidator, ValidationResult } from './dimensions.validator';
import { ICAOAircraftCategory, StandDimensions } from '../types/stand-capabilities';

describe('DimensionsValidator', () => {
  let validator: DimensionsValidator;

  beforeEach(() => {
    validator = new DimensionsValidator();
  });

  describe('validate', () => {
    it('should validate valid Category C stand dimensions', () => {
      const dimensions: StandDimensions = {
        length: 60, // Increased to meet recommended length
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
        clearances: {
          wingtipClearance: 4.5,
          taxilaneClearance: 19.5,
        },
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject zero or negative dimensions', () => {
      const dimensions: StandDimensions = {
        length: 0,
        width: -5,
        icaoCategory: ICAOAircraftCategory.A,
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Stand length must be greater than 0');
      expect(result.errors).toContain('Stand width must be greater than 0');
    });

    it('should reject insufficient width for aircraft category', () => {
      const dimensions: StandDimensions = {
        length: 60,
        width: 30, // Too narrow for Category D
        icaoCategory: ICAOAircraftCategory.D,
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Stand width (30m) is insufficient for Category D')
      );
    });

    it('should warn about potentially insufficient length', () => {
      const dimensions: StandDimensions = {
        length: 45, // Marginal for Category C
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(true); // Warning only, not an error
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Stand length (45m) may be insufficient')
      );
    });

    it('should reject insufficient wingtip clearance', () => {
      const dimensions: StandDimensions = {
        length: 50,
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
        clearances: {
          wingtipClearance: 3, // Should be 4.5m for Category C
        },
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Insufficient wingtip clearance for Category C')
      );
    });

    it('should reject insufficient taxilane clearance', () => {
      const dimensions: StandDimensions = {
        length: 50,
        width: 45,
        icaoCategory: ICAOAircraftCategory.D,
        clearances: {
          wingtipClearance: 7.5,
          taxilaneClearance: 20, // Should be 23.5m for Category D
        },
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Insufficient taxilane clearance for Category D')
      );
    });

    it('should warn about excessive slopes', () => {
      const dimensions: StandDimensions = {
        length: 50,
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
        slope: {
          longitudinal: 1.5, // Exceeds 1%
          transverse: 2.0, // Exceeds 1.5%
        },
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(true); // Warnings only
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Longitudinal slope (1.5%) exceeds recommended maximum')
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Transverse slope (2%) exceeds recommended maximum')
      );
    });

    it('should reject parking envelope larger than stand', () => {
      const dimensions: StandDimensions = {
        length: 50,
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
        maxParkingEnvelope: {
          length: 55, // Exceeds stand length
          width: 50, // Exceeds stand width
        },
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parking envelope length exceeds stand length');
      expect(result.errors).toContain('Parking envelope width exceeds stand width');
    });

    it('should validate Category F stand with all parameters', () => {
      const dimensions: StandDimensions = {
        length: 100,
        width: 95, // 80m wingspan + 2*7.5m clearance
        icaoCategory: ICAOAircraftCategory.F,
        clearances: {
          wingtipClearance: 7.5,
          taxilaneClearance: 35,
          noseClearance: 15,
          tailClearance: 15,
        },
        maxParkingEnvelope: {
          length: 90,
          width: 90,
        },
        slope: {
          longitudinal: 0.5,
          transverse: 1.0,
        },
      };

      const result = validator.validate(dimensions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateBulk', () => {
    it('should validate multiple stand dimensions', () => {
      const dimensionsList: StandDimensions[] = [
        {
          length: 50,
          width: 45,
          icaoCategory: ICAOAircraftCategory.C,
        },
        {
          length: 0, // Invalid
          width: 30,
          icaoCategory: ICAOAircraftCategory.B,
        },
        {
          length: 70,
          width: 67,
          icaoCategory: ICAOAircraftCategory.D,
        },
      ];

      const results = validator.validateBulk(dimensionsList);

      expect(results.size).toBe(3);
      expect(results.get(0)?.isValid).toBe(true);
      expect(results.get(1)?.isValid).toBe(false);
      expect(results.get(2)?.isValid).toBe(true);
    });
  });
});

import {
  AircraftCompatibility,
  ICAOAircraftCategory,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types';

export class AircraftCompatibilityValidator {
  private readonly categoryWingspanLimits = {
    [ICAOAircraftCategory.A]: 15,
    [ICAOAircraftCategory.B]: 24,
    [ICAOAircraftCategory.C]: 36,
    [ICAOAircraftCategory.D]: 52,
    [ICAOAircraftCategory.E]: 65,
    [ICAOAircraftCategory.F]: 80,
  };

  private readonly commonAircraft = {
    // Regional jets and small aircraft
    ATR42: { wingspan: 24.57, length: 22.67, mtow: 18600, category: ICAOAircraftCategory.B },
    ATR72: { wingspan: 27.05, length: 27.17, mtow: 23000, category: ICAOAircraftCategory.C },
    CRJ900: { wingspan: 24.85, length: 36.4, mtow: 38330, category: ICAOAircraftCategory.C },
    E175: { wingspan: 28.65, length: 31.68, mtow: 40370, category: ICAOAircraftCategory.C },

    // Narrow body
    A320: { wingspan: 35.8, length: 37.57, mtow: 78000, category: ICAOAircraftCategory.C },
    A321: { wingspan: 35.8, length: 44.51, mtow: 97000, category: ICAOAircraftCategory.C },
    'B737-800': { wingspan: 35.79, length: 39.5, mtow: 79010, category: ICAOAircraftCategory.C },
    'B737-900': { wingspan: 35.79, length: 42.1, mtow: 85200, category: ICAOAircraftCategory.C },

    // Wide body
    'A330-300': { wingspan: 60.3, length: 63.66, mtow: 242000, category: ICAOAircraftCategory.E },
    'A350-900': { wingspan: 64.75, length: 66.8, mtow: 280000, category: ICAOAircraftCategory.E },
    'B777-300': { wingspan: 64.8, length: 73.86, mtow: 351500, category: ICAOAircraftCategory.E },
    'B787-9': { wingspan: 60.12, length: 62.81, mtow: 254000, category: ICAOAircraftCategory.E },

    // Very large
    A380: { wingspan: 79.75, length: 72.72, mtow: 560000, category: ICAOAircraftCategory.F },
    'B747-8': { wingspan: 68.4, length: 76.3, mtow: 447700, category: ICAOAircraftCategory.E },
  };

  validate(compatibility: AircraftCompatibility): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate wingspan
    if (compatibility.maxWingspan !== undefined) {
      if (compatibility.maxWingspan <= 0) {
        errors.push({
          field: 'aircraftCompatibility.maxWingspan',
          message: 'Maximum wingspan must be greater than 0',
          code: 'INVALID_WINGSPAN',
          severity: 'error',
        });
      } else if (compatibility.maxWingspan > 80) {
        warnings.push({
          field: 'aircraftCompatibility.maxWingspan',
          message: 'Maximum wingspan exceeds largest aircraft category (80m)',
          code: 'EXCESSIVE_WINGSPAN',
          severity: 'warning',
        });
      }
    }

    // Validate length
    if (compatibility.maxLength !== undefined) {
      if (compatibility.maxLength <= 0) {
        errors.push({
          field: 'aircraftCompatibility.maxLength',
          message: 'Maximum length must be greater than 0',
          code: 'INVALID_LENGTH',
          severity: 'error',
        });
      } else if (compatibility.maxLength > 85) {
        warnings.push({
          field: 'aircraftCompatibility.maxLength',
          message: 'Maximum length exceeds typical large aircraft (85m)',
          code: 'EXCESSIVE_LENGTH',
          severity: 'warning',
        });
      }
    }

    // Validate height
    if (compatibility.maxHeight !== undefined) {
      if (compatibility.maxHeight <= 0) {
        errors.push({
          field: 'aircraftCompatibility.maxHeight',
          message: 'Maximum height must be greater than 0',
          code: 'INVALID_HEIGHT',
          severity: 'error',
        });
      } else if (compatibility.maxHeight > 25) {
        warnings.push({
          field: 'aircraftCompatibility.maxHeight',
          message: 'Maximum height exceeds typical aircraft height (25m)',
          code: 'EXCESSIVE_HEIGHT',
          severity: 'warning',
        });
      }
    }

    // Validate weight
    if (compatibility.maxWeight !== undefined) {
      if (compatibility.maxWeight <= 0) {
        errors.push({
          field: 'aircraftCompatibility.maxWeight',
          message: 'Maximum weight must be greater than 0',
          code: 'INVALID_WEIGHT',
          severity: 'error',
        });
      } else if (compatibility.maxWeight < 5000) {
        warnings.push({
          field: 'aircraftCompatibility.maxWeight',
          message: 'Maximum weight very low, may exclude most aircraft',
          code: 'LOW_WEIGHT_LIMIT',
          severity: 'warning',
        });
      }
    }

    // Validate compatible categories
    if (compatibility.compatibleCategories) {
      // Check wingspan consistency with categories
      if (compatibility.maxWingspan) {
        const maxCategoryForWingspan = this.getMaxCategoryForWingspan(compatibility.maxWingspan);

        for (const category of compatibility.compatibleCategories) {
          if (category > maxCategoryForWingspan) {
            errors.push({
              field: 'aircraftCompatibility.compatibleCategories',
              message: `Category ${category} incompatible with max wingspan ${compatibility.maxWingspan}m`,
              code: 'CATEGORY_WINGSPAN_MISMATCH',
              severity: 'error',
            });
          }
        }
      }
    }

    // Validate specific aircraft
    if (compatibility.specificAircraft) {
      for (const aircraft of compatibility.specificAircraft) {
        const aircraftData = this.commonAircraft[aircraft as keyof typeof this.commonAircraft];

        if (aircraftData) {
          // Check if aircraft fits within specified limits
          if (compatibility.maxWingspan && aircraftData.wingspan > compatibility.maxWingspan) {
            errors.push({
              field: 'aircraftCompatibility.specificAircraft',
              message: `${aircraft} wingspan (${aircraftData.wingspan}m) exceeds max wingspan (${compatibility.maxWingspan}m)`,
              code: 'AIRCRAFT_EXCEEDS_WINGSPAN',
              severity: 'error',
            });
          }

          if (compatibility.maxLength && aircraftData.length > compatibility.maxLength) {
            errors.push({
              field: 'aircraftCompatibility.specificAircraft',
              message: `${aircraft} length (${aircraftData.length}m) exceeds max length (${compatibility.maxLength}m)`,
              code: 'AIRCRAFT_EXCEEDS_LENGTH',
              severity: 'error',
            });
          }

          if (compatibility.maxWeight && aircraftData.mtow > compatibility.maxWeight) {
            errors.push({
              field: 'aircraftCompatibility.specificAircraft',
              message: `${aircraft} MTOW (${aircraftData.mtow}kg) exceeds max weight (${compatibility.maxWeight}kg)`,
              code: 'AIRCRAFT_EXCEEDS_WEIGHT',
              severity: 'error',
            });
          }
        }
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      icaoCompliant: isValid,
      timestamp: new Date(),
    };
  }

  private getMaxCategoryForWingspan(wingspan: number): ICAOAircraftCategory {
    const categories = Object.entries(this.categoryWingspanLimits);

    for (let i = categories.length - 1; i >= 0; i--) {
      const [category, limit] = categories[i];
      if (wingspan <= limit) {
        return category as ICAOAircraftCategory;
      }
    }

    return ICAOAircraftCategory.A;
  }

  /**
   * Suggest compatible aircraft based on specifications
   */
  suggestCompatibleAircraft(compatibility: AircraftCompatibility): string[] {
    const compatible: string[] = [];

    for (const [aircraft, data] of Object.entries(this.commonAircraft)) {
      let isCompatible = true;

      if (compatibility.maxWingspan && data.wingspan > compatibility.maxWingspan) {
        isCompatible = false;
      }

      if (compatibility.maxLength && data.length > compatibility.maxLength) {
        isCompatible = false;
      }

      if (compatibility.maxWeight && data.mtow > compatibility.maxWeight) {
        isCompatible = false;
      }

      if (
        compatibility.compatibleCategories &&
        !compatibility.compatibleCategories.includes(data.category)
      ) {
        isCompatible = false;
      }

      if (isCompatible) {
        compatible.push(aircraft);
      }
    }

    return compatible;
  }
}

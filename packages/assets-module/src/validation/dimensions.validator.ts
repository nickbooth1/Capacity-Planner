import {
  StandDimensions,
  ICAOAircraftCategory,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types';

/**
 * ICAO Annex 14 compliant dimensions validator
 */
export class DimensionsValidator {
  private readonly icaoRequirements = {
    [ICAOAircraftCategory.A]: {
      minLength: 30,
      minWidth: 20,
      recommendedLength: 35,
      recommendedWidth: 25,
      maxWingspan: 15,
    },
    [ICAOAircraftCategory.B]: {
      minLength: 35,
      minWidth: 25,
      recommendedLength: 40,
      recommendedWidth: 30,
      maxWingspan: 24,
    },
    [ICAOAircraftCategory.C]: {
      minLength: 45,
      minWidth: 35,
      recommendedLength: 50,
      recommendedWidth: 40,
      maxWingspan: 36,
    },
    [ICAOAircraftCategory.D]: {
      minLength: 60,
      minWidth: 45,
      recommendedLength: 65,
      recommendedWidth: 50,
      maxWingspan: 52,
    },
    [ICAOAircraftCategory.E]: {
      minLength: 70,
      minWidth: 55,
      recommendedLength: 75,
      recommendedWidth: 60,
      maxWingspan: 65,
    },
    [ICAOAircraftCategory.F]: {
      minLength: 80,
      minWidth: 60,
      recommendedLength: 85,
      recommendedWidth: 65,
      maxWingspan: 80,
    },
  };

  validate(dimensions: StandDimensions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic dimension validation
    if (dimensions.length <= 0) {
      errors.push({
        field: 'dimensions.length',
        message: 'Stand length must be greater than 0',
        code: 'INVALID_LENGTH',
        severity: 'error',
      });
    }

    if (dimensions.width <= 0) {
      errors.push({
        field: 'dimensions.width',
        message: 'Stand width must be greater than 0',
        code: 'INVALID_WIDTH',
        severity: 'error',
      });
    }

    if (dimensions.height !== undefined && dimensions.height <= 0) {
      errors.push({
        field: 'dimensions.height',
        message: 'Stand height must be greater than 0',
        code: 'INVALID_HEIGHT',
        severity: 'error',
      });
    }

    if (dimensions.slope !== undefined) {
      if (dimensions.slope < 0 || dimensions.slope > 5) {
        errors.push({
          field: 'dimensions.slope',
          message: 'Stand slope must be between 0% and 5%',
          code: 'INVALID_SLOPE',
          severity: 'error',
        });
      } else if (dimensions.slope > 2) {
        warnings.push({
          field: 'dimensions.slope',
          message: 'Stand slope exceeds recommended maximum of 2%',
          code: 'HIGH_SLOPE',
          severity: 'warning',
        });
      }
    }

    // ICAO category validation
    if (dimensions.icaoCategory && dimensions.length > 0 && dimensions.width > 0) {
      const requirements = this.icaoRequirements[dimensions.icaoCategory];

      if (requirements) {
        // Check minimum requirements
        if (dimensions.length < requirements.minLength) {
          errors.push({
            field: 'dimensions.length',
            message: `Stand length ${dimensions.length}m is insufficient for Category ${dimensions.icaoCategory} (minimum ${requirements.minLength}m)`,
            code: 'ICAO_LENGTH_INSUFFICIENT',
            severity: 'error',
          });
        } else if (dimensions.length < requirements.recommendedLength) {
          warnings.push({
            field: 'dimensions.length',
            message: `Stand length ${dimensions.length}m is below recommended ${requirements.recommendedLength}m for Category ${dimensions.icaoCategory}`,
            code: 'ICAO_LENGTH_BELOW_RECOMMENDED',
            severity: 'warning',
          });
        }

        if (dimensions.width < requirements.minWidth) {
          errors.push({
            field: 'dimensions.width',
            message: `Stand width ${dimensions.width}m is insufficient for Category ${dimensions.icaoCategory} (minimum ${requirements.minWidth}m)`,
            code: 'ICAO_WIDTH_INSUFFICIENT',
            severity: 'error',
          });
        } else if (dimensions.width < requirements.recommendedWidth) {
          warnings.push({
            field: 'dimensions.width',
            message: `Stand width ${dimensions.width}m is below recommended ${requirements.recommendedWidth}m for Category ${dimensions.icaoCategory}`,
            code: 'ICAO_WIDTH_BELOW_RECOMMENDED',
            severity: 'warning',
          });
        }
      }
    }

    // Surface condition validation
    if (dimensions.surfaceCondition === 'poor') {
      warnings.push({
        field: 'dimensions.surfaceCondition',
        message: 'Poor surface condition may limit aircraft operations',
        code: 'POOR_SURFACE_CONDITION',
        severity: 'warning',
      });
    }

    // Load bearing validation
    if (dimensions.loadBearing !== undefined) {
      if (dimensions.loadBearing < 1000) {
        errors.push({
          field: 'dimensions.loadBearing',
          message: 'Load bearing capacity is too low for aircraft operations',
          code: 'INSUFFICIENT_LOAD_BEARING',
          severity: 'error',
        });
      } else if (dimensions.loadBearing < 5000) {
        warnings.push({
          field: 'dimensions.loadBearing',
          message: 'Load bearing capacity may limit heavy aircraft operations',
          code: 'LOW_LOAD_BEARING',
          severity: 'warning',
        });
      }
    }

    const isValid = errors.length === 0;
    const icaoCompliant = isValid && this.checkICAOCompliance(dimensions, errors);

    return {
      isValid,
      errors,
      warnings,
      icaoCompliant,
      timestamp: new Date(),
    };
  }

  private checkICAOCompliance(dimensions: StandDimensions, errors: ValidationError[]): boolean {
    // ICAO compliance requires:
    // 1. No errors
    // 2. Valid ICAO category
    // 3. Dimensions meet minimum requirements
    // 4. Slope within limits

    if (errors.length > 0) return false;

    if (!dimensions.icaoCategory) return true; // Can't check compliance without category

    const requirements = this.icaoRequirements[dimensions.icaoCategory];
    if (!requirements) return false;

    return (
      dimensions.length >= requirements.minLength &&
      dimensions.width >= requirements.minWidth &&
      (!dimensions.slope || dimensions.slope <= 2)
    );
  }

  /**
   * Suggest appropriate ICAO category based on dimensions
   */
  suggestICAOCategory(dimensions: StandDimensions): ICAOAircraftCategory | null {
    if (dimensions.length <= 0 || dimensions.width <= 0) return null;

    // Find the highest category that the stand can accommodate
    const categories = Object.entries(this.icaoRequirements).reverse();

    for (const [category, requirements] of categories) {
      if (
        dimensions.length >= requirements.recommendedLength &&
        dimensions.width >= requirements.recommendedWidth
      ) {
        return category as ICAOAircraftCategory;
      }
    }

    // If no category fits the recommended sizes, check minimum sizes
    for (const [category, requirements] of categories) {
      if (
        dimensions.length >= requirements.minLength &&
        dimensions.width >= requirements.minWidth
      ) {
        return category as ICAOAircraftCategory;
      }
    }

    return ICAOAircraftCategory.A; // Default to smallest category
  }
}

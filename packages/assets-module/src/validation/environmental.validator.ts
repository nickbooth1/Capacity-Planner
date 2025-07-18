import {
  EnvironmentalFeatures,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types';

export class EnvironmentalValidator {
  validate(environmental: EnvironmentalFeatures): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate noise restrictions
    if (environmental.noiseRestrictions) {
      const { hours, maxDecibels } = environmental.noiseRestrictions;

      if (hours && hours.length > 0) {
        for (const timeRange of hours) {
          if (!this.isValidTime(timeRange.start)) {
            errors.push({
              field: 'environmentalFeatures.noiseRestrictions.hours',
              message: 'Invalid start time in noise restriction hours',
              code: 'INVALID_NOISE_START_TIME',
              severity: 'error',
            });
          }

          if (!this.isValidTime(timeRange.end)) {
            errors.push({
              field: 'environmentalFeatures.noiseRestrictions.hours',
              message: 'Invalid end time in noise restriction hours',
              code: 'INVALID_NOISE_END_TIME',
              severity: 'error',
            });
          }
        }
      }

      if (maxDecibels !== undefined && maxDecibels <= 0) {
        errors.push({
          field: 'environmentalFeatures.noiseRestrictions.maxDecibels',
          message: 'Maximum decibels must be greater than 0',
          code: 'INVALID_DECIBELS',
          severity: 'error',
        });
      }
    }

    // Validate emissions limit
    if (environmental.emissionsLimit !== undefined && environmental.emissionsLimit <= 0) {
      errors.push({
        field: 'environmentalFeatures.emissionsLimit',
        message: 'Emissions limit must be greater than 0',
        code: 'INVALID_EMISSIONS_LIMIT',
        severity: 'error',
      });
    }

    // Warnings
    if (environmental.noiseLevel === 'high') {
      warnings.push({
        field: 'environmentalFeatures.noiseLevel',
        message: 'High noise level may restrict operations',
        code: 'HIGH_NOISE_LEVEL',
        severity: 'warning',
      });
    }

    if (!environmental.electricGSE) {
      warnings.push({
        field: 'environmentalFeatures.electricGSE',
        message: 'Consider electric GSE for sustainability',
        code: 'NO_ELECTRIC_GSE',
        severity: 'warning',
      });
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

  private isValidTime(time: string): boolean {
    return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }
}

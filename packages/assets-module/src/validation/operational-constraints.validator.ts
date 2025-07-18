import {
  OperationalConstraints,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types';

export class OperationalConstraintsValidator {
  validate(constraints: OperationalConstraints): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate operating hours
    if (constraints.operatingHours) {
      const { start, end } = constraints.operatingHours;

      if (!this.isValidTime(start)) {
        errors.push({
          field: 'operationalConstraints.operatingHours.start',
          message: 'Invalid start time format (use HH:MM)',
          code: 'INVALID_START_TIME',
          severity: 'error',
        });
      }

      if (!this.isValidTime(end)) {
        errors.push({
          field: 'operationalConstraints.operatingHours.end',
          message: 'Invalid end time format (use HH:MM)',
          code: 'INVALID_END_TIME',
          severity: 'error',
        });
      }
    }

    // Validate weather limits
    if (constraints.weatherLimits) {
      const { maxWindSpeed, maxCrosswind, minVisibility } = constraints.weatherLimits;

      if (maxWindSpeed !== undefined && maxWindSpeed <= 0) {
        errors.push({
          field: 'operationalConstraints.weatherLimits.maxWindSpeed',
          message: 'Maximum wind speed must be greater than 0',
          code: 'INVALID_WIND_SPEED',
          severity: 'error',
        });
      }

      if (maxCrosswind !== undefined && maxCrosswind <= 0) {
        errors.push({
          field: 'operationalConstraints.weatherLimits.maxCrosswind',
          message: 'Maximum crosswind must be greater than 0',
          code: 'INVALID_CROSSWIND',
          severity: 'error',
        });
      }

      if (minVisibility !== undefined && minVisibility <= 0) {
        errors.push({
          field: 'operationalConstraints.weatherLimits.minVisibility',
          message: 'Minimum visibility must be greater than 0',
          code: 'INVALID_VISIBILITY',
          severity: 'error',
        });
      }
    }

    // Validate clearances
    if (constraints.requiredClearances !== undefined && constraints.requiredClearances <= 0) {
      errors.push({
        field: 'operationalConstraints.requiredClearances',
        message: 'Required clearances must be greater than 0',
        code: 'INVALID_CLEARANCES',
        severity: 'error',
      });
    }

    // Warnings
    if (constraints.nightRestrictions) {
      warnings.push({
        field: 'operationalConstraints.nightRestrictions',
        message: 'Night restrictions may limit operations',
        code: 'NIGHT_RESTRICTIONS',
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

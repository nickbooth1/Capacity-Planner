import {
  GroundSupportCapabilities,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types';

export class GroundSupportValidator {
  validate(groundSupport: GroundSupportCapabilities): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate power supply
    if (groundSupport.hasPowerSupply && groundSupport.powerSupplyType) {
      if (groundSupport.powerSupplyType.length === 0) {
        errors.push({
          field: 'groundSupport.powerSupplyType',
          message: 'Power supply enabled but no type specified',
          code: 'MISSING_POWER_TYPE',
          severity: 'error',
        });
      }

      if (
        groundSupport.powerSupplyCapacity !== undefined &&
        groundSupport.powerSupplyCapacity <= 0
      ) {
        errors.push({
          field: 'groundSupport.powerSupplyCapacity',
          message: 'Power supply capacity must be greater than 0',
          code: 'INVALID_POWER_CAPACITY',
          severity: 'error',
        });
      }
    }

    // Validate ground air
    if (groundSupport.hasGroundAir && groundSupport.groundAirCapacity !== undefined) {
      if (groundSupport.groundAirCapacity <= 0) {
        errors.push({
          field: 'groundSupport.groundAirCapacity',
          message: 'Ground air capacity must be greater than 0',
          code: 'INVALID_AIR_CAPACITY',
          severity: 'error',
        });
      }
    }

    // Validate fuel
    if (groundSupport.hasFuelHydrant && groundSupport.fuelTypes) {
      if (groundSupport.fuelTypes.length === 0) {
        errors.push({
          field: 'groundSupport.fuelTypes',
          message: 'Fuel hydrant enabled but no fuel types specified',
          code: 'MISSING_FUEL_TYPES',
          severity: 'error',
        });
      }
    }

    // Validate deicing
    if (groundSupport.hasDeicing && groundSupport.deicingType) {
      if (groundSupport.deicingType.length === 0) {
        errors.push({
          field: 'groundSupport.deicingType',
          message: 'Deicing enabled but no types specified',
          code: 'MISSING_DEICING_TYPES',
          severity: 'error',
        });
      }
    }

    // Warnings for missing common services
    if (!groundSupport.hasPowerSupply) {
      warnings.push({
        field: 'groundSupport.hasPowerSupply',
        message: 'No power supply may limit aircraft operations',
        code: 'NO_POWER_SUPPLY',
        severity: 'warning',
      });
    }

    if (!groundSupport.pushbackRequired && !groundSupport.towingRequired) {
      warnings.push({
        field: 'groundSupport',
        message: 'Neither pushback nor towing specified',
        code: 'NO_MOVEMENT_METHOD',
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
}

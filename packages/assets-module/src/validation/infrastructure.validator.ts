import {
  InfrastructureCapabilities,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types';

export class InfrastructureValidator {
  validate(infrastructure: InfrastructureCapabilities): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate jetbridge
    if (infrastructure.hasJetbridge && !infrastructure.jetbridgeType) {
      warnings.push({
        field: 'infrastructure.jetbridgeType',
        message: 'Jetbridge enabled but type not specified',
        code: 'MISSING_JETBRIDGE_TYPE',
        severity: 'warning',
      });
    }

    // Validate lighting
    if (infrastructure.lightingType && infrastructure.lightingType.length === 0) {
      errors.push({
        field: 'infrastructure.lightingType',
        message: 'Lighting type array cannot be empty',
        code: 'EMPTY_LIGHTING_TYPE',
        severity: 'error',
      });
    }

    // Validate VDGS
    if (infrastructure.hasVDGS && !infrastructure.vdgsType) {
      warnings.push({
        field: 'infrastructure.vdgsType',
        message: 'VDGS enabled but type not specified',
        code: 'MISSING_VDGS_TYPE',
        severity: 'warning',
      });
    }

    // Validate stand markings
    if (infrastructure.standMarkings && infrastructure.standMarkings.length === 0) {
      errors.push({
        field: 'infrastructure.standMarkings',
        message: 'Stand markings array cannot be empty',
        code: 'EMPTY_STAND_MARKINGS',
        severity: 'error',
      });
    }

    // Warnings for poor conditions
    if (infrastructure.pavementCondition === 'poor') {
      warnings.push({
        field: 'infrastructure.pavementCondition',
        message: 'Poor pavement condition requires maintenance',
        code: 'POOR_PAVEMENT',
        severity: 'warning',
      });
    }

    // Warnings for missing safety features
    if (!infrastructure.hasCCTV) {
      warnings.push({
        field: 'infrastructure.hasCCTV',
        message: 'Consider CCTV for security and safety',
        code: 'NO_CCTV',
        severity: 'warning',
      });
    }

    if (!infrastructure.standMarkings || !infrastructure.standMarkings.includes('safety')) {
      warnings.push({
        field: 'infrastructure.standMarkings',
        message: 'Consider adding safety markings',
        code: 'NO_SAFETY_MARKINGS',
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

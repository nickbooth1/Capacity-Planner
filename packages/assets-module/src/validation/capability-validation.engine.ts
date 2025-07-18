import { StandCapabilities, ValidationResult, ValidationError, ValidationWarning } from '../types';
import { DimensionsValidator } from './dimensions.validator';
import { AircraftCompatibilityValidator } from './aircraft-compatibility.validator';
import { GroundSupportValidator } from './ground-support.validator';
import { OperationalConstraintsValidator } from './operational-constraints.validator';
import { EnvironmentalValidator } from './environmental.validator';
import { InfrastructureValidator } from './infrastructure.validator';
import { ValidationCache } from '../cache/validation-cache';

export interface Validator<T> {
  validate(data: T): ValidationResult;
}

export interface ValidationOptions {
  skipICAOCompliance?: boolean;
  performanceTracking?: boolean;
  useCache?: boolean;
  cacheTTL?: number;
}

export interface ValidationPerformanceMetrics {
  totalDuration: number;
  validatorDurations: Record<string, number>;
}

/**
 * Main validation engine that orchestrates all capability validators
 */
export class CapabilityValidationEngine {
  private validators: Map<keyof StandCapabilities, Validator<any>>;
  private cache: ValidationCache;

  constructor() {
    this.validators = new Map<keyof StandCapabilities, Validator<any>>();
    this.validators.set('dimensions', new DimensionsValidator());
    this.validators.set('aircraftCompatibility', new AircraftCompatibilityValidator());
    this.validators.set('groundSupport', new GroundSupportValidator());
    this.validators.set('operationalConstraints', new OperationalConstraintsValidator());
    this.validators.set('environmentalFeatures', new EnvironmentalValidator());
    this.validators.set('infrastructure', new InfrastructureValidator());
    this.cache = new ValidationCache();
  }

  /**
   * Validate all stand capabilities
   */
  async validate(
    capabilities: StandCapabilities,
    options: ValidationOptions = {}
  ): Promise<{
    result: ValidationResult;
    performance?: ValidationPerformanceMetrics;
  }> {
    // Check cache if enabled
    if (options.useCache !== false) {
      const cachedResult = await this.cache.get(capabilities);
      if (cachedResult) {
        return { result: cachedResult };
      }
    }

    const startTime = options.performanceTracking ? Date.now() : 0;
    const validatorDurations: Record<string, number> = {};

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let icaoCompliant = true;

    // Run validators for each capability type
    for (const [capabilityType, validator] of this.validators) {
      const capabilityData = capabilities[capabilityType];

      if (capabilityData) {
        const validatorStartTime = options.performanceTracking ? Date.now() : 0;

        const result = await this.runValidator(validator, capabilityData, capabilityType as string);

        if (options.performanceTracking) {
          validatorDurations[capabilityType as string] = Date.now() - validatorStartTime;
        }

        errors.push(...result.errors);
        warnings.push(...result.warnings);

        if (!result.icaoCompliant && !options.skipICAOCompliance) {
          icaoCompliant = false;
        }
      }
    }

    // Cross-capability validation
    const crossValidationResult = this.validateCrossCapabilities(capabilities);
    errors.push(...crossValidationResult.errors);
    warnings.push(...crossValidationResult.warnings);

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      icaoCompliant: icaoCompliant && errors.length === 0,
      timestamp: new Date(),
    };

    // Cache the result if caching is enabled
    if (options.useCache !== false) {
      await this.cache.set(capabilities, result, options.cacheTTL);
    }

    const response: {
      result: ValidationResult;
      performance?: ValidationPerformanceMetrics;
    } = { result };

    if (options.performanceTracking) {
      response.performance = {
        totalDuration: Date.now() - startTime,
        validatorDurations,
      };
    }

    return response;
  }

  /**
   * Run a single validator with error handling
   */
  private async runValidator(
    validator: Validator<any>,
    data: any,
    capabilityType: string
  ): Promise<ValidationResult> {
    try {
      return validator.validate(data);
    } catch (error) {
      // If a validator fails, return an error result
      return {
        isValid: false,
        errors: [
          {
            field: capabilityType,
            message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'VALIDATOR_ERROR',
            severity: 'error',
          },
        ],
        warnings: [],
        icaoCompliant: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate cross-capability constraints
   */
  private validateCrossCapabilities(
    capabilities: StandCapabilities
  ): Pick<ValidationResult, 'errors' | 'warnings'> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check dimension and aircraft compatibility consistency
    if (capabilities.dimensions && capabilities.aircraftCompatibility) {
      const { dimensions, aircraftCompatibility } = capabilities;

      // Check wingspan against width
      if (
        aircraftCompatibility.maxWingspan &&
        dimensions.width &&
        aircraftCompatibility.maxWingspan > dimensions.width - 10 // Need at least 5m clearance on each side
      ) {
        errors.push({
          field: 'aircraftCompatibility.maxWingspan',
          message: `Maximum wingspan ${aircraftCompatibility.maxWingspan}m exceeds safe limits for stand width ${dimensions.width}m`,
          code: 'WINGSPAN_EXCEEDS_WIDTH',
          severity: 'error',
        });
      }

      // Check aircraft length against stand length
      if (
        aircraftCompatibility.maxLength &&
        dimensions.length &&
        aircraftCompatibility.maxLength > dimensions.length - 10
      ) {
        warnings.push({
          field: 'aircraftCompatibility.maxLength',
          message: `Maximum aircraft length ${aircraftCompatibility.maxLength}m is close to stand length ${dimensions.length}m`,
          code: 'LENGTH_CLOSE_TO_LIMIT',
          severity: 'warning',
        });
      }

      // Check ICAO category consistency
      if (
        dimensions.icaoCategory &&
        aircraftCompatibility.compatibleCategories &&
        !aircraftCompatibility.compatibleCategories.includes(dimensions.icaoCategory)
      ) {
        warnings.push({
          field: 'aircraftCompatibility.compatibleCategories',
          message: `Stand ICAO category ${dimensions.icaoCategory} not included in compatible categories`,
          code: 'ICAO_CATEGORY_MISMATCH',
          severity: 'warning',
        });
      }
    }

    // Check ground support and operational constraints
    if (capabilities.groundSupport && capabilities.operationalConstraints) {
      const { groundSupport, operationalConstraints } = capabilities;

      // Deicing requirements in winter operations
      if (operationalConstraints.weatherLimits?.snowOperations && !groundSupport.hasDeicing) {
        warnings.push({
          field: 'groundSupport.hasDeicing',
          message: 'Snow operations enabled but no deicing capability',
          code: 'MISSING_DEICING_FOR_SNOW_OPS',
          severity: 'warning',
        });
      }
    }

    // Check infrastructure and dimensions
    if (capabilities.infrastructure && capabilities.dimensions) {
      const { infrastructure, dimensions } = capabilities;

      // Jetbridge requires minimum dimensions
      if (infrastructure.hasJetbridge && dimensions.width && dimensions.width < 35) {
        errors.push({
          field: 'infrastructure.hasJetbridge',
          message: 'Stand width insufficient for jetbridge operations',
          code: 'INSUFFICIENT_WIDTH_FOR_JETBRIDGE',
          severity: 'error',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate a single capability type
   */
  async validateSingle<K extends keyof StandCapabilities>(
    capabilityType: K,
    data: StandCapabilities[K]
  ): Promise<ValidationResult> {
    const validator = this.validators.get(capabilityType);

    if (!validator) {
      throw new Error(`No validator found for capability type: ${capabilityType}`);
    }

    return this.runValidator(validator, data, capabilityType as string);
  }

  /**
   * Get performance benchmarks for validators
   */
  async benchmark(capabilities: StandCapabilities): Promise<ValidationPerformanceMetrics> {
    const result = await this.validate(capabilities, { performanceTracking: true });
    return result.performance!;
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return this.cache.getMetrics();
  }

  /**
   * Clear validation cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Invalidate specific capability cache entry
   */
  async invalidateCache(capabilities: StandCapabilities): Promise<void> {
    await this.cache.invalidate(capabilities);
  }
}

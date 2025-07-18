import { z } from 'zod';
import { ICAOAircraftCategory } from './stand-capabilities';

// ICAO Aircraft Category validation
export const icaoAircraftCategorySchema = z.nativeEnum(ICAOAircraftCategory);

// Stand dimensions validation
export const standDimensionsSchema = z
  .object({
    length: z.number().positive().describe('Stand length in meters'),
    width: z.number().positive().describe('Stand width in meters'),
    height: z.number().positive().optional().describe('Clearance height in meters'),
    slope: z.number().min(0).max(5).optional().describe('Slope percentage'),
    surfaceType: z.enum(['concrete', 'asphalt', 'gravel', 'other']).optional(),
    surfaceCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
    loadBearing: z.number().positive().optional().describe('Load bearing capacity in kg/m²'),
    icaoCategory: icaoAircraftCategorySchema.optional(),
  })
  .strict();

// Aircraft compatibility validation
export const aircraftCompatibilitySchema = z
  .object({
    maxWingspan: z.number().positive().max(100).optional().describe('Maximum wingspan in meters'),
    maxLength: z.number().positive().max(100).optional().describe('Maximum length in meters'),
    maxHeight: z.number().positive().max(30).optional().describe('Maximum height in meters'),
    maxWeight: z.number().positive().optional().describe('Maximum takeoff weight in kg'),
    compatibleCategories: z.array(icaoAircraftCategorySchema).optional(),
    specificAircraft: z.array(z.string()).optional().describe('List of specific aircraft types'),
    restrictions: z.array(z.string()).optional().describe('Operational restrictions'),
  })
  .strict();

// Ground support capabilities validation
export const groundSupportCapabilitiesSchema = z
  .object({
    hasPowerSupply: z.boolean().optional(),
    powerSupplyType: z.array(z.enum(['400Hz', '28VDC'])).optional(),
    powerSupplyCapacity: z.number().positive().optional().describe('Power capacity in kVA'),
    hasGroundAir: z.boolean().optional(),
    groundAirCapacity: z.number().positive().optional().describe('Ground air capacity in kg/min'),
    hasFuelHydrant: z.boolean().optional(),
    fuelTypes: z.array(z.enum(['JetA', 'JetA1', 'AVGAS'])).optional(),
    hasWaterService: z.boolean().optional(),
    hasLavatoryService: z.boolean().optional(),
    hasDeicing: z.boolean().optional(),
    deicingType: z.array(z.enum(['Type1', 'Type2', 'Type3', 'Type4'])).optional(),
    pushbackRequired: z.boolean().optional(),
    towingRequired: z.boolean().optional(),
    gpuAvailable: z.boolean().optional(),
    acuAvailable: z.boolean().optional(),
  })
  .strict();

// Time validation helper
const timeSchema = z
  .string()
  .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)');

// Operational constraints validation
export const operationalConstraintsSchema = z
  .object({
    operatingHours: z
      .object({
        start: timeSchema,
        end: timeSchema,
        timezone: z.string(),
      })
      .optional(),
    nightRestrictions: z.boolean().optional(),
    weatherLimits: z
      .object({
        maxWindSpeed: z.number().positive().optional().describe('Maximum wind speed in knots'),
        maxCrosswind: z.number().positive().optional().describe('Maximum crosswind in knots'),
        minVisibility: z.number().positive().optional().describe('Minimum visibility in meters'),
        snowOperations: z.boolean().optional(),
        icingConditions: z.boolean().optional(),
      })
      .optional(),
    simultaneousOperations: z
      .object({
        allowed: z.boolean(),
        restrictions: z.array(z.string()).optional(),
      })
      .optional(),
    taxiRestrictions: z.array(z.string()).optional(),
    customProcedures: z.array(z.string()).optional(),
    requiredClearances: z.number().positive().optional().describe('Required clearances in meters'),
  })
  .strict();

// Environmental features validation
export const environmentalFeaturesSchema = z
  .object({
    noiseLevel: z.enum(['low', 'medium', 'high']).optional(),
    noiseRestrictions: z
      .object({
        hours: z.array(
          z.object({
            start: timeSchema,
            end: timeSchema,
          })
        ),
        maxDecibels: z.number().positive().optional(),
      })
      .optional(),
    emissionsLimit: z.number().positive().optional().describe('CO2 emissions limit in tons/year'),
    sustainabilityFeatures: z.array(z.string()).optional(),
    hasSolarPower: z.boolean().optional(),
    electricGSE: z.boolean().optional(),
    wasteManagement: z.array(z.enum(['recycling', 'composting', 'general'])).optional(),
  })
  .strict();

// Infrastructure capabilities validation
export const infrastructureCapabilitiesSchema = z
  .object({
    hasJetbridge: z.boolean().optional(),
    jetbridgeType: z.enum(['single', 'dual', 'triple']).optional(),
    jetbridgeModel: z.string().optional(),
    hasFixedPower: z.boolean().optional(),
    hasFixedAir: z.boolean().optional(),
    lightingType: z.array(z.enum(['LED', 'halogen', 'fluorescent'])).optional(),
    hasCCTV: z.boolean().optional(),
    hasVDGS: z.boolean().optional(),
    vdgsType: z.string().optional(),
    standMarkings: z.array(z.enum(['centerline', 'stopbar', 'leadIn', 'safety'])).optional(),
    pavementCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  })
  .strict();

// Combined stand capabilities validation
export const standCapabilitiesSchema = z
  .object({
    dimensions: standDimensionsSchema.optional(),
    aircraftCompatibility: aircraftCompatibilitySchema.optional(),
    groundSupport: groundSupportCapabilitiesSchema.optional(),
    operationalConstraints: operationalConstraintsSchema.optional(),
    environmentalFeatures: environmentalFeaturesSchema.optional(),
    infrastructure: infrastructureCapabilitiesSchema.optional(),
  })
  .strict();

// Maintenance validation schemas
export const maintenanceTypeSchema = z.enum(['routine', 'corrective', 'preventive', 'emergency']);
export const maintenanceStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);
export const impactLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const maintenanceRecordSchema = z.object({
  maintenanceType: maintenanceTypeSchema,
  status: maintenanceStatusSchema,
  scheduledStart: z.date(),
  scheduledEnd: z.date(),
  actualStart: z.date().optional(),
  actualEnd: z.date().optional(),
  description: z.string().optional(),
  workPerformed: z.string().optional(),
  cost: z.number().positive().optional(),
  impactLevel: impactLevelSchema,
  affectedCapabilities: standCapabilitiesSchema.partial().optional(),
});

// Adjacency validation schemas
export const adjacencyTypeSchema = z.enum(['physical', 'operational', 'taxiway_shared']);

export const standAdjacencySchema = z.object({
  adjacentStandId: z.string().uuid(),
  adjacencyType: adjacencyTypeSchema,
  impactLevel: impactLevelSchema,
  constraints: z
    .object({
      simultaneousUse: z.boolean().optional(),
      wingspanLimit: z.number().positive().optional(),
      operationalNotes: z.array(z.string()).optional(),
    })
    .optional(),
});

// Template validation schema
export const standCapabilityTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icaoCategory: icaoAircraftCategorySchema.optional(),
  dimensions: standDimensionsSchema.optional(),
  aircraftCompatibility: aircraftCompatibilitySchema.optional(),
  groundSupport: groundSupportCapabilitiesSchema.optional(),
  operationalConstraints: operationalConstraintsSchema.optional(),
  environmentalFeatures: environmentalFeaturesSchema.optional(),
  infrastructure: infrastructureCapabilitiesSchema.optional(),
});

// Helper function to validate stand capabilities
export function validateStandCapabilities(data: unknown) {
  return standCapabilitiesSchema.parse(data);
}

// Helper function to validate with safe parse
export function safeValidateStandCapabilities(data: unknown) {
  return standCapabilitiesSchema.safeParse(data);
}

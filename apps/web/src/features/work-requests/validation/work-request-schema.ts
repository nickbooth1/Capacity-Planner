import { z } from 'zod';

// Enum schemas
const workTypeSchema = z.enum(['maintenance', 'inspection', 'repair', 'modification', 'emergency']);
const workCategorySchema = z.enum(['routine', 'corrective', 'preventive', 'emergency']);
const prioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
const urgencySchema = z.enum(['immediate', 'scheduled', 'routine']);
const impactLevelSchema = z.enum(['full_closure', 'partial_restriction', 'no_impact']);
const assetTypeSchema = z.enum([
  'stand',
  'airfield',
  'baggage',
  'terminal',
  'gate',
  'runway',
  'taxiway',
]);

// Complex object schemas
const timeWindowSchema = z
  .object({
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in HH:MM format'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in HH:MM format'),
    daysOfWeek: z.array(z.number().min(0).max(6)).min(1, 'At least one day must be selected'),
  })
  .refine(
    (data) => {
      const start = data.startTime.split(':').map(Number);
      const end = data.endTime.split(':').map(Number);
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];
      return endMinutes > startMinutes;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  );

const blackoutPeriodSchema = z
  .object({
    startDate: z.string().datetime('Must be a valid ISO date'),
    endDate: z.string().datetime('Must be a valid ISO date'),
    reason: z.string().min(1, 'Reason is required').max(200, 'Reason cannot exceed 200 characters'),
  })
  .refine(
    (data) => {
      return new Date(data.endDate) > new Date(data.startDate);
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  );

const seasonalConstraintsSchema = z
  .object({
    winterRestrictions: z.boolean().optional(),
    summerRestrictions: z.boolean().optional(),
    weatherDependencies: z.array(z.string()).optional(),
    temperatureRange: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
  })
  .optional();

const vendorInformationSchema = z
  .object({
    name: z.string().max(100, 'Name cannot exceed 100 characters').optional(),
    contactEmail: z.string().email('Must be a valid email').optional(),
    contactPhone: z.string().max(50, 'Phone cannot exceed 50 characters').optional(),
    contractNumber: z.string().max(50, 'Contract number cannot exceed 50 characters').optional(),
  })
  .optional();

// Main work request schema
export const workRequestSchema = z
  .object({
    // Asset Information
    assetId: z.string().uuid('Please select a valid asset'),
    assetType: assetTypeSchema.optional(),

    // Request Classification
    workType: workTypeSchema,
    category: workCategorySchema,
    priority: prioritySchema,
    urgency: urgencySchema,
    impactLevel: impactLevelSchema,

    // Request Details
    title: z
      .string()
      .min(5, 'Title must be at least 5 characters')
      .max(200, 'Title cannot exceed 200 characters')
      .trim(),
    description: z
      .string()
      .min(20, 'Description must be at least 20 characters')
      .max(5000, 'Description cannot exceed 5000 characters')
      .trim(),
    locationDetails: z
      .string()
      .max(2000, 'Location details cannot exceed 2000 characters')
      .optional(),
    safetyConsiderations: z
      .string()
      .max(2000, 'Safety considerations cannot exceed 2000 characters')
      .optional(),

    // Scheduling
    requestedStartDate: z
      .string()
      .datetime('Please select a valid start date')
      .refine((date) => new Date(date) > new Date(), {
        message: 'Start date must be in the future',
      }),
    requestedEndDate: z.string().datetime('Please select a valid end date').optional(),
    estimatedDurationMinutes: z
      .number()
      .min(15, 'Minimum duration is 15 minutes')
      .max(10080, 'Maximum duration is 7 days (10,080 minutes)')
      .optional(),
    deadline: z.string().datetime('Please select a valid deadline').optional(),
    preferredTimeWindows: z.array(timeWindowSchema).optional(),
    blackoutPeriods: z.array(blackoutPeriodSchema).optional(),
    seasonalConstraints: seasonalConstraintsSchema,

    // Resource Requirements
    estimatedPersonnelCount: z
      .number()
      .min(0, 'Personnel count cannot be negative')
      .max(100, 'Personnel count cannot exceed 100')
      .optional(),
    requiredSkills: z.array(z.string().min(1).max(100)).optional(),
    requiredEquipment: z.array(z.string().min(1).max(100)).optional(),
    estimatedMaterialsCost: z
      .number()
      .min(0, 'Materials cost cannot be negative')
      .max(1000000, 'Materials cost cannot exceed $1,000,000')
      .optional(),

    // Budget and Cost
    budgetCode: z
      .string()
      .regex(
        /^[A-Z0-9-]+$/,
        'Budget code must contain only uppercase letters, numbers, and hyphens'
      )
      .max(50, 'Budget code cannot exceed 50 characters')
      .optional(),
    estimatedTotalCost: z
      .number()
      .min(0, 'Total cost cannot be negative')
      .max(10000000, 'Total cost cannot exceed $10,000,000')
      .optional(),
    costCenter: z.string().max(50, 'Cost center cannot exceed 50 characters').optional(),
    purchaseOrderNumber: z
      .string()
      .max(50, 'Purchase order number cannot exceed 50 characters')
      .optional(),
    vendorInformation: vendorInformationSchema,

    // Stakeholder Information
    primaryContactId: z.string().uuid('Please select a valid primary contact').optional(),
    secondaryContactId: z.string().uuid('Please select a valid secondary contact').optional(),

    // Regulatory and Compliance
    regulatoryApprovalRequired: z.boolean().optional(),
    regulatoryReference: z
      .string()
      .max(100, 'Regulatory reference cannot exceed 100 characters')
      .optional(),
    complianceNotes: z
      .string()
      .max(2000, 'Compliance notes cannot exceed 2000 characters')
      .optional(),

    // Template
    templateId: z.string().uuid('Please select a valid template').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  // Cross-field validation rules
  .refine(
    (data) => {
      if (data.requestedEndDate) {
        return new Date(data.requestedEndDate) > new Date(data.requestedStartDate);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['requestedEndDate'],
    }
  )
  .refine(
    (data) => {
      if (data.deadline) {
        return new Date(data.deadline) >= new Date(data.requestedStartDate);
      }
      return true;
    },
    {
      message: 'Deadline must be on or after the requested start date',
      path: ['deadline'],
    }
  )
  .refine(
    (data) => {
      // Critical priority requests cannot have routine urgency
      if (data.priority === 'critical' && data.urgency === 'routine') {
        return false;
      }
      return true;
    },
    {
      message: 'Critical priority requests cannot have routine urgency',
      path: ['urgency'],
    }
  )
  .refine(
    (data) => {
      // Emergency work type should have high or critical priority
      if (data.workType === 'emergency' && !['critical', 'high'].includes(data.priority)) {
        return false;
      }
      return true;
    },
    {
      message: 'Emergency work requests must have critical or high priority',
      path: ['priority'],
    }
  )
  .refine(
    (data) => {
      // Emergency category should have immediate urgency
      if (data.category === 'emergency' && data.urgency !== 'immediate') {
        return false;
      }
      return true;
    },
    {
      message: 'Emergency category requires immediate urgency',
      path: ['urgency'],
    }
  )
  .refine(
    (data) => {
      // If materials cost is provided, total cost should include it
      if (data.estimatedMaterialsCost && data.estimatedTotalCost) {
        return data.estimatedTotalCost >= data.estimatedMaterialsCost;
      }
      return true;
    },
    {
      message: 'Total cost must be greater than or equal to materials cost',
      path: ['estimatedTotalCost'],
    }
  )
  .refine(
    (data) => {
      // If regulatory approval is required, reference should be provided
      if (data.regulatoryApprovalRequired && !data.regulatoryReference) {
        return false;
      }
      return true;
    },
    {
      message: 'Regulatory reference is required when regulatory approval is needed',
      path: ['regulatoryReference'],
    }
  )
  .refine(
    (data) => {
      // Safety considerations should be provided for critical priority
      if (data.priority === 'critical' && !data.safetyConsiderations) {
        return false;
      }
      return true;
    },
    {
      message: 'Safety considerations are required for critical priority work',
      path: ['safetyConsiderations'],
    }
  );

// Step-specific validation schemas for progressive disclosure
export const stepOneSchema = z.object({
  assetId: workRequestSchema.shape.assetId,
});

export const stepTwoSchema = z.object({
  workType: workRequestSchema.shape.workType,
  category: workRequestSchema.shape.category,
  priority: workRequestSchema.shape.priority,
  urgency: workRequestSchema.shape.urgency,
  impactLevel: workRequestSchema.shape.impactLevel,
  title: workRequestSchema.shape.title,
  description: workRequestSchema.shape.description,
  locationDetails: workRequestSchema.shape.locationDetails,
  safetyConsiderations: workRequestSchema.shape.safetyConsiderations,
});

export const stepThreeSchema = z.object({
  requestedStartDate: workRequestSchema.shape.requestedStartDate,
  requestedEndDate: workRequestSchema.shape.requestedEndDate,
  estimatedDurationMinutes: workRequestSchema.shape.estimatedDurationMinutes,
  deadline: workRequestSchema.shape.deadline,
  preferredTimeWindows: workRequestSchema.shape.preferredTimeWindows,
  blackoutPeriods: workRequestSchema.shape.blackoutPeriods,
  seasonalConstraints: workRequestSchema.shape.seasonalConstraints,
});

export const stepFourSchema = z.object({
  estimatedPersonnelCount: workRequestSchema.shape.estimatedPersonnelCount,
  requiredSkills: workRequestSchema.shape.requiredSkills,
  requiredEquipment: workRequestSchema.shape.requiredEquipment,
  estimatedMaterialsCost: workRequestSchema.shape.estimatedMaterialsCost,
  budgetCode: workRequestSchema.shape.budgetCode,
  estimatedTotalCost: workRequestSchema.shape.estimatedTotalCost,
  costCenter: workRequestSchema.shape.costCenter,
  purchaseOrderNumber: workRequestSchema.shape.purchaseOrderNumber,
  vendorInformation: workRequestSchema.shape.vendorInformation,
});

export const stepFiveSchema = z.object({
  primaryContactId: workRequestSchema.shape.primaryContactId,
  secondaryContactId: workRequestSchema.shape.secondaryContactId,
  regulatoryApprovalRequired: workRequestSchema.shape.regulatoryApprovalRequired,
  regulatoryReference: workRequestSchema.shape.regulatoryReference,
  complianceNotes: workRequestSchema.shape.complianceNotes,
});

// Type inference
export type WorkRequestFormData = z.infer<typeof workRequestSchema>;
export type StepOneData = z.infer<typeof stepOneSchema>;
export type StepTwoData = z.infer<typeof stepTwoSchema>;
export type StepThreeData = z.infer<typeof stepThreeSchema>;
export type StepFourData = z.infer<typeof stepFourSchema>;
export type StepFiveData = z.infer<typeof stepFiveSchema>;

// Validation helper functions
export const validateStep = (step: number, data: Partial<WorkRequestFormData>) => {
  try {
    switch (step) {
      case 1:
        stepOneSchema.parse(data);
        return { isValid: true, errors: [] };
      case 2:
        stepTwoSchema.parse(data);
        return { isValid: true, errors: [] };
      case 3:
        stepThreeSchema.parse(data);
        return { isValid: true, errors: [] };
      case 4:
        stepFourSchema.parse(data);
        return { isValid: true, errors: [] };
      case 5:
        stepFiveSchema.parse(data);
        return { isValid: true, errors: [] };
      default:
        return { isValid: false, errors: ['Invalid step number'] };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      };
    }
    return { isValid: false, errors: ['Validation failed'] };
  }
};

export const validateFullForm = (data: WorkRequestFormData) => {
  try {
    workRequestSchema.parse(data);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      };
    }
    return { isValid: false, errors: ['Validation failed'] };
  }
};

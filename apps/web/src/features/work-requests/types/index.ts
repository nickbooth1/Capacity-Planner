// Work Request Types and Interfaces

export type WorkRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'in_progress'
  | 'completed';

export type WorkType = 'maintenance' | 'inspection' | 'repair' | 'modification' | 'emergency';

export type WorkCategory = 'routine' | 'corrective' | 'preventive' | 'emergency';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type Urgency = 'immediate' | 'scheduled' | 'routine';

export type ImpactLevel = 'full_closure' | 'partial_restriction' | 'no_impact';

export type AssetType =
  | 'stand'
  | 'airfield'
  | 'baggage'
  | 'terminal'
  | 'gate'
  | 'runway'
  | 'taxiway';

export interface TimeWindow {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  daysOfWeek: number[]; // 0-6, Sunday=0
}

export interface BlackoutPeriod {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  reason: string;
}

export interface SeasonalConstraints {
  winterRestrictions?: boolean;
  summerRestrictions?: boolean;
  weatherDependencies?: string[];
  temperatureRange?: {
    min?: number;
    max?: number;
  };
}

export interface VendorInformation {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  contractNumber?: string;
}

export interface WorkRequestFormData {
  // Asset Information
  assetId: string;
  assetType: AssetType;

  // Request Classification
  workType: WorkType;
  category: WorkCategory;
  priority: Priority;
  urgency: Urgency;
  impactLevel: ImpactLevel;

  // Request Details
  title: string;
  description: string;
  locationDetails?: string;
  safetyConsiderations?: string;

  // Scheduling
  requestedStartDate: string; // ISO datetime string
  requestedEndDate?: string; // ISO datetime string
  estimatedDurationMinutes?: number;
  deadline?: string; // ISO datetime string
  preferredTimeWindows?: TimeWindow[];
  blackoutPeriods?: BlackoutPeriod[];
  seasonalConstraints?: SeasonalConstraints;

  // Resource Requirements
  estimatedPersonnelCount?: number;
  requiredSkills?: string[];
  requiredEquipment?: string[];
  estimatedMaterialsCost?: number;

  // Budget and Cost
  budgetCode?: string;
  estimatedTotalCost?: number;
  costCenter?: string;
  purchaseOrderNumber?: string;
  vendorInformation?: VendorInformation;

  // Stakeholder Information
  primaryContactId?: string;
  secondaryContactId?: string;

  // Regulatory and Compliance
  regulatoryApprovalRequired?: boolean;
  regulatoryReference?: string;
  complianceNotes?: string;

  // Template
  templateId?: string;
  metadata?: Record<string, any>;
}

export interface WorkRequestSummary {
  id: string;
  title: string;
  status: WorkRequestStatus;
  priority: Priority;
  urgency: Urgency;
  workType: WorkType;
  assetType: AssetType;
  assetCode: string;
  assetName: string;
  assetLocation?: string;
  requestedStartDate: string;
  estimatedTotalCost?: number;
  requestorName: string;
  department?: string;
  submissionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkRequestDetail extends WorkRequestSummary {
  category: WorkCategory;
  impactLevel: ImpactLevel;
  description: string;
  locationDetails?: string;
  safetyConsiderations?: string;
  requestedEndDate?: string;
  estimatedDurationMinutes?: number;
  deadline?: string;
  preferredTimeWindows?: TimeWindow[];
  blackoutPeriods?: BlackoutPeriod[];
  seasonalConstraints?: SeasonalConstraints;
  estimatedPersonnelCount?: number;
  requiredSkills?: string[];
  requiredEquipment?: string[];
  estimatedMaterialsCost?: number;
  budgetCode?: string;
  costCenter?: string;
  purchaseOrderNumber?: string;
  vendorInformation?: VendorInformation;
  primaryContactId?: string;
  secondaryContactId?: string;
  regulatoryApprovalRequired?: boolean;
  regulatoryReference?: string;
  complianceNotes?: string;
  templateId?: string;
  metadata?: Record<string, any>;
  version: number;
}

export interface ValidationResult {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  field: string;
  suggestion: string;
  value?: any;
}

export interface CreateWorkRequestRequest extends Omit<WorkRequestFormData, 'assetType'> {
  assetType?: AssetType; // Optional in request, derived from asset
}

export interface CreateWorkRequestResponse {
  success: boolean;
  data: {
    workRequest: WorkRequestDetail;
    validationResults: ValidationResult[];
  };
}

export interface UpdateWorkRequestRequest extends Partial<CreateWorkRequestRequest> {
  version: number;
  statusReason?: string;
}

export interface StandSummaryForWorkRequest {
  id: string;
  code: string;
  name: string;
  terminal?: string;
  pier?: string;
  status: 'operational' | 'maintenance' | 'closed';
  capabilities: {
    aircraftSize?: string;
    hasPowerSupply?: boolean;
    hasGroundSupport?: boolean;
    maxWeight?: number;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  currentWorkRequests?: number; // Count of active work requests
}

export interface WorkRequestFilters {
  status?: WorkRequestStatus[];
  priority?: Priority[];
  workType?: WorkType[];
  assetType?: AssetType[];
  assetId?: string;
  requestedBy?: string;
  department?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// Form step types for progressive disclosure
export type FormStep = 1 | 2 | 3 | 4 | 5;

export interface FormStepConfig {
  number: FormStep;
  title: string;
  description: string;
  isValid: boolean;
  isRequired: boolean;
}

// Validation schema types
export interface ValidationSchema {
  [key: string]: any;
}

// Error types
export interface FormErrors {
  [key: string]: string | undefined;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: ValidationResult[];
}

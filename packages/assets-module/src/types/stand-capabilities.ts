// ICAO Aircraft Categories (Annex 14)
export enum ICAOAircraftCategory {
  A = 'A', // Wingspan < 15m
  B = 'B', // Wingspan 15m to < 24m
  C = 'C', // Wingspan 24m to < 36m
  D = 'D', // Wingspan 36m to < 52m
  E = 'E', // Wingspan 52m to < 65m
  F = 'F', // Wingspan 65m to < 80m
}

// CRUD-specific types
export interface CreateStandRequest {
  code: string;
  name: string;
  terminal?: string;
  status?: 'operational' | 'maintenance' | 'closed';
  dimensions?: StandDimensions;
  aircraftCompatibility?: AircraftCompatibility;
  groundSupport?: GroundSupportCapabilities;
  operationalConstraints?: OperationalConstraints;
  environmentalFeatures?: EnvironmentalFeatures;
  infrastructure?: InfrastructureCapabilities;
  geometry?: any; // GeoJSON
  latitude?: number;
  longitude?: number;
  metadata?: any;
}

export interface UpdateStandRequest extends Partial<CreateStandRequest> {
  version: number; // For optimistic locking
}

export interface StandFilters {
  status?: 'operational' | 'maintenance' | 'closed';
  terminal?: string;
  aircraftCategory?: ICAOAircraftCategory;
  search?: string;
  includeDeleted?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StandImportJob {
  id: string;
  organizationId: string;
  filename: string;
  fileUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  errors: any[];
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface StandImportRow {
  rowNumber: number;
  data: CreateStandRequest;
  errors: string[];
  isValid: boolean;
}

// Stand dimensions
export interface StandDimensions {
  length: number; // meters
  width: number; // meters
  height?: number; // clearance height in meters
  slope?: number; // percentage
  surfaceType?: 'concrete' | 'asphalt' | 'gravel' | 'other';
  surfaceCondition?: 'excellent' | 'good' | 'fair' | 'poor';
  loadBearing?: number; // kg/m²
  icaoCategory?: ICAOAircraftCategory;
}

// Aircraft compatibility
export interface AircraftCompatibility {
  maxWingspan?: number; // meters
  maxLength?: number; // meters
  maxHeight?: number; // meters
  maxWeight?: number; // MTOW in kg
  compatibleCategories?: ICAOAircraftCategory[];
  specificAircraft?: string[]; // e.g., ['A320', 'B737-800', 'A350']
  restrictions?: string[]; // specific restrictions
}

// Ground support capabilities
export interface GroundSupportCapabilities {
  hasPowerSupply?: boolean;
  powerSupplyType?: ('400Hz' | '28VDC')[];
  powerSupplyCapacity?: number; // kVA
  hasGroundAir?: boolean;
  groundAirCapacity?: number; // kg/min
  hasFuelHydrant?: boolean;
  fuelTypes?: ('JetA' | 'JetA1' | 'AVGAS')[];
  hasWaterService?: boolean;
  hasLavatoryService?: boolean;
  hasDeicing?: boolean;
  deicingType?: ('Type1' | 'Type2' | 'Type3' | 'Type4')[];
  pushbackRequired?: boolean;
  towingRequired?: boolean;
  gpuAvailable?: boolean;
  acuAvailable?: boolean;
}

// Operational constraints
export interface OperationalConstraints {
  operatingHours?: {
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
  nightRestrictions?: boolean;
  weatherLimits?: {
    maxWindSpeed?: number; // knots
    maxCrosswind?: number; // knots
    minVisibility?: number; // meters
    snowOperations?: boolean;
    icingConditions?: boolean;
  };
  simultaneousOperations?: {
    allowed: boolean;
    restrictions?: string[];
  };
  taxiRestrictions?: string[];
  customProcedures?: string[];
  requiredClearances?: number; // meters
}

// Environmental features
export interface EnvironmentalFeatures {
  noiseLevel?: 'low' | 'medium' | 'high';
  noiseRestrictions?: {
    hours: { start: string; end: string }[];
    maxDecibels?: number;
  };
  emissionsLimit?: number; // CO2 tons/year
  sustainabilityFeatures?: string[];
  hasSolarPower?: boolean;
  electricGSE?: boolean;
  wasteManagement?: ('recycling' | 'composting' | 'general')[];
}

// Infrastructure capabilities
export interface InfrastructureCapabilities {
  hasJetbridge?: boolean;
  jetbridgeType?: 'single' | 'dual' | 'triple';
  jetbridgeModel?: string;
  hasFixedPower?: boolean;
  hasFixedAir?: boolean;
  lightingType?: ('LED' | 'halogen' | 'fluorescent')[];
  hasCCTV?: boolean;
  hasVDGS?: boolean; // Visual Docking Guidance System
  vdgsType?: string;
  standMarkings?: ('centerline' | 'stopbar' | 'leadIn' | 'safety')[];
  pavementCondition?: 'excellent' | 'good' | 'fair' | 'poor';
}

// Combined stand capabilities
export interface StandCapabilities {
  dimensions?: StandDimensions;
  aircraftCompatibility?: AircraftCompatibility;
  groundSupport?: GroundSupportCapabilities;
  operationalConstraints?: OperationalConstraints;
  environmentalFeatures?: EnvironmentalFeatures;
  infrastructure?: InfrastructureCapabilities;
}

// Maintenance record types
export type MaintenanceType = 'routine' | 'corrective' | 'preventive' | 'emergency';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export interface MaintenanceRecord {
  id: string;
  standId: string;
  organizationId: string;
  maintenanceType: MaintenanceType;
  status: MaintenanceStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  description?: string;
  workPerformed?: string;
  cost?: number;
  impactLevel: ImpactLevel;
  affectedCapabilities?: Partial<StandCapabilities>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Adjacency types
export type AdjacencyType = 'physical' | 'operational' | 'taxiway_shared';

export interface StandAdjacency {
  id: string;
  standId: string;
  adjacentStandId: string;
  adjacencyType: AdjacencyType;
  impactLevel: ImpactLevel;
  constraints?: {
    simultaneousUse?: boolean;
    wingspanLimit?: number;
    operationalNotes?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Capability template
export interface StandCapabilityTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  icaoCategory?: ICAOAircraftCategory;
  capabilities: StandCapabilities;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Capability snapshot for audit
export interface StandCapabilitySnapshot {
  id: string;
  standId: string;
  organizationId: string;
  snapshotType: 'manual' | 'automated' | 'migration';
  previousCapabilities: StandCapabilities;
  newCapabilities: StandCapabilities;
  changedFields: string[];
  validationResults?: ValidationResult;
  reason?: string;
  templateId?: string;
  createdAt: Date;
  createdBy?: string;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  icaoCompliant: boolean;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

// Stand with full capabilities
export interface StandWithCapabilities {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  terminal?: string;
  status: string;
  capabilities: StandCapabilities;
  geometry?: any;
  latitude?: number;
  longitude?: number;
  metadata: Record<string, any>;
  maintenanceRecords?: MaintenanceRecord[];
  adjacencies?: StandAdjacency[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

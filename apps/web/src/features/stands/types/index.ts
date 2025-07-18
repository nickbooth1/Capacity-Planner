export interface Stand {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  terminal?: string;
  pier?: string;
  status: 'operational' | 'maintenance' | 'closed';
  capabilities?: any; // DEPRECATED: Old capabilities field - to be migrated
  dimensions?: StandDimensions;
  aircraftCompatibility?: AircraftCompatibility;
  groundSupport?: GroundSupport;
  geometry?: any;
  latitude?: number;
  longitude?: number;
  metadata?: any;
  version: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface StandDimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface AircraftCompatibility {
  maxWingspan?: number;
  maxLength?: number;
  maxWeight?: number;
  compatibleCategories?: ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[];
}

export interface GroundSupport {
  hasPowerSupply?: boolean;
  hasGroundAir?: boolean;
  hasFuelHydrant?: boolean;
}

export interface CreateStandRequest {
  code: string;
  name: string;
  terminal?: string;
  pier?: string;
  status?: 'operational' | 'maintenance' | 'closed';
  capabilities?: any; // DEPRECATED: Old capabilities field - to be migrated
  dimensions?: StandDimensions;
  aircraftCompatibility?: AircraftCompatibility;
  groundSupport?: GroundSupport;
  geometry?: any;
  latitude?: number;
  longitude?: number;
  metadata?: any;
}

export interface UpdateStandRequest extends Partial<CreateStandRequest> {
  version: number;
}

export interface StandFilters {
  status?: 'operational' | 'maintenance' | 'closed';
  terminal?: string;
  pier?: string;
  aircraftCategory?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export interface StandListResponse {
  data: Stand[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
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

export interface StandStats {
  total: number;
  operational: number;
  maintenance: number;
  closed: number;
  byTerminal: Record<string, number>;
  byAircraftCategory: Record<string, number>;
}

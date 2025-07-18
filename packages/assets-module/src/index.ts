import { BaseEntity } from '@capacity-planner/shared-kernel';

export interface Stand extends BaseEntity {
  organizationId: string;
  code: string; // e.g., "A1", "B15"
  name: string; // e.g., "Alpha 1"
  status: StandStatus;
  capabilities: StandCapabilities;
  geometry?: any; // For map display - GeoJSON.Geometry
}

export enum StandStatus {
  OPERATIONAL = 'operational',
  MAINTENANCE = 'maintenance',
  CLOSED = 'closed',
}

export interface StandCapabilities {
  aircraftSize: AircraftSizeCategory; // ICAO codes
  hasPowerSupply: boolean;
  hasGroundSupport: boolean;
  maxWeight: number; // in tonnes
}

export enum AircraftSizeCategory {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

export interface AssetService {
  // Stand operations
  createStand(stand: Omit<Stand, 'id' | 'createdAt' | 'updatedAt'>): Promise<Stand>;
  updateStand(id: string, updates: Partial<Stand>): Promise<Stand>;
  deleteStand(id: string): Promise<void>;
  getStand(id: string): Promise<Stand | null>;
  listStands(organizationId: string, filters?: StandFilters): Promise<Stand[]>;
  bulkImportStands(organizationId: string, stands: Partial<Stand>[]): Promise<Stand[]>;
}

export interface StandFilters {
  status?: StandStatus;
  aircraftSize?: AircraftSizeCategory;
  search?: string;
}

// Export services and validators
export { CapabilityValidationEngine } from './validation/capability-validation.engine';
export { MetricsService } from './monitoring/metrics.service';
export { HealthService } from './monitoring/health.service';
export { EncryptionService } from './security/encryption.service';
export { TimelineService } from './services/timeline.service';
export type {
  TimelineDataPoint,
  TimelineEvent,
  TimelineQuery,
  BulkTimelineQuery,
} from './services/timeline.service';

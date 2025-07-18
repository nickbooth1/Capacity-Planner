export interface StandSummaryForWorkRequest {
  id: string;
  code: string;
  name: string;
  terminal?: string;
  pier?: string;
  status: string;
  capabilities: any;
  dimensions?: any;
  aircraftCompatibility?: any;
  groundSupport?: any;
  operationalConstraints?: any;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  maintenanceSchedule?: any[];
}

export interface StandDetailForWorkRequest extends StandSummaryForWorkRequest {
  environmentalFeatures?: any;
  infrastructure?: any;
  geometry?: any;
  metadata?: any;
  currentStatus: string;
  adjacentStands?: any[];
}

export interface StandFiltersForWorkRequest {
  search?: string;
  terminal?: string;
  status?: string[];
  includeMaintenanceSchedule?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  conflicts: any[];
  restrictions: any[];
}

export interface AvailabilityRecommendation {
  type: string;
  message: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface StandAvailabilityResponse {
  availability: AvailabilitySlot[];
  conflicts: any[];
  recommendations: AvailabilityRecommendation[];
}

export class StandIntegrationService {
  private assetsApiUrl: string;

  constructor(assetsApiUrl?: string) {
    this.assetsApiUrl = assetsApiUrl || process.env.ASSETS_API_URL || 'http://localhost:3001';
  }

  async getStandsForWorkRequest(
    organizationId: string,
    filters: StandFiltersForWorkRequest,
    authorization?: string
  ): Promise<{
    success: boolean;
    data?: { stands: StandSummaryForWorkRequest[]; pagination: any };
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.assetsApiUrl}/api/assets/stands`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization || '',
          'X-Organization-ID': organizationId,
        },
      });

      if (!response.ok) {
        throw new Error(`Assets API error: ${response.status}`);
      }

      const data = await response.json();

      // Transform stands data for work request context
      const transformedStands: StandSummaryForWorkRequest[] =
        data.data?.map((stand: any) => ({
          id: stand.id,
          code: stand.code,
          name: stand.name,
          terminal: stand.terminal,
          pier: stand.pier,
          status: stand.status,
          capabilities: stand.capabilities,
          dimensions: stand.dimensions,
          aircraftCompatibility: stand.aircraftCompatibility,
          groundSupport: stand.groundSupport,
          operationalConstraints: stand.operationalConstraints,
          location: {
            latitude: stand.latitude,
            longitude: stand.longitude,
          },
          maintenanceSchedule: stand.maintenanceSchedule || [],
        })) || [];

      return {
        success: true,
        data: {
          stands: transformedStands,
          pagination: data.meta || {
            page: filters.page || 1,
            pageSize: filters.pageSize || 50,
            total: transformedStands.length,
            totalPages: Math.ceil(transformedStands.length / (filters.pageSize || 50)),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stands',
      };
    }
  }

  async getStandDetailsForWorkRequest(
    standId: string,
    organizationId: string,
    authorization?: string
  ): Promise<{ success: boolean; data?: { stand: StandDetailForWorkRequest }; error?: string }> {
    try {
      const response = await fetch(`${this.assetsApiUrl}/api/assets/stands/${standId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization || '',
          'X-Organization-ID': organizationId,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Stand not found',
          };
        }
        throw new Error(`Assets API error: ${response.status}`);
      }

      const data = await response.json();
      const stand = data.data;

      // Transform stand data for work request context
      const transformedStand: StandDetailForWorkRequest = {
        id: stand.id,
        code: stand.code,
        name: stand.name,
        terminal: stand.terminal,
        pier: stand.pier,
        status: stand.status,
        capabilities: stand.capabilities,
        dimensions: stand.dimensions,
        aircraftCompatibility: stand.aircraftCompatibility,
        groundSupport: stand.groundSupport,
        operationalConstraints: stand.operationalConstraints,
        environmentalFeatures: stand.environmentalFeatures,
        infrastructure: stand.infrastructure,
        location: {
          latitude: stand.latitude,
          longitude: stand.longitude,
        },
        geometry: stand.geometry,
        metadata: stand.metadata,
        currentStatus: stand.status,
        maintenanceSchedule: [], // TODO: Fetch from maintenance system
        adjacentStands: [], // TODO: Fetch adjacent stands
      };

      return {
        success: true,
        data: {
          stand: transformedStand,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stand details',
      };
    }
  }

  async checkStandAvailability(
    standId: string,
    organizationId: string,
    startDate: string,
    endDate: string,
    granularity: string = 'hour'
  ): Promise<{ success: boolean; data?: StandAvailabilityResponse; error?: string }> {
    try {
      // TODO: Implement availability checking logic
      // This would involve:
      // 1. Checking existing work requests for the stand
      // 2. Checking maintenance schedules
      // 3. Checking operational constraints
      // 4. Checking aircraft schedules (if integrated)

      // For now, return mock availability data
      const mockAvailability: StandAvailabilityResponse = {
        availability: [
          {
            start: startDate,
            end: endDate,
            available: true,
            conflicts: [],
            restrictions: [],
          },
        ],
        conflicts: [],
        recommendations: [
          {
            type: 'optimal_time',
            message: 'Best time window for maintenance work',
            startTime: '06:00',
            endTime: '10:00',
            reason: 'Low aircraft traffic period',
          },
        ],
      };

      return {
        success: true,
        data: mockAvailability,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check stand availability',
      };
    }
  }
}

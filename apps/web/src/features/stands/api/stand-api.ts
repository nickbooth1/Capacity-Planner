import type {
  Stand,
  StandListResponse,
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
  StandImportJob,
  StandStats,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class StandApi {
  private getHeaders(organizationId: string) {
    return {
      'Content-Type': 'application/json',
      'X-Organization-Id': organizationId,
      'X-User-Id': 'current-user-id', // TODO: Get from auth context
    };
  }

  async getStands(organizationId: string, filters?: StandFilters): Promise<StandListResponse> {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.terminal) params.append('terminal', filters.terminal);
    if (filters?.aircraftCategory) params.append('aircraftCategory', filters.aircraftCategory);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.includeDeleted) params.append('includeDeleted', String(filters.includeDeleted));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

    const response = await fetch(`${API_BASE_URL}/api/stands?${params}`, {
      headers: this.getHeaders(organizationId),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stands');
    }

    const result = await response.json();
    return result.data;
  }

  async getStandById(id: string, organizationId: string, includeDeleted = false): Promise<Stand> {
    const params = new URLSearchParams();
    if (includeDeleted) params.append('includeDeleted', 'true');

    const response = await fetch(`${API_BASE_URL}/api/stands/${id}?${params}`, {
      headers: this.getHeaders(organizationId),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stand');
    }

    const result = await response.json();
    return result.data;
  }

  async createStand(organizationId: string, data: CreateStandRequest): Promise<Stand> {
    const response = await fetch(`${API_BASE_URL}/api/stands`, {
      method: 'POST',
      headers: this.getHeaders(organizationId),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create stand');
    }

    const result = await response.json();
    return result.data;
  }

  async updateStand(id: string, organizationId: string, data: UpdateStandRequest): Promise<Stand> {
    const response = await fetch(`${API_BASE_URL}/api/stands/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(organizationId),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update stand');
    }

    const result = await response.json();
    return result.data;
  }

  async deleteStand(id: string, organizationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/stands/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(organizationId),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete stand');
    }
  }

  async getStandStats(organizationId: string): Promise<StandStats> {
    const response = await fetch(`${API_BASE_URL}/api/stands/stats`, {
      headers: this.getHeaders(organizationId),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stand statistics');
    }

    const result = await response.json();
    return result.data;
  }

  async startImport(
    organizationId: string,
    filename: string,
    fileUrl: string
  ): Promise<StandImportJob> {
    const response = await fetch(`${API_BASE_URL}/api/stands/import`, {
      method: 'POST',
      headers: this.getHeaders(organizationId),
      body: JSON.stringify({ filename, fileUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start import');
    }

    const result = await response.json();
    return result.data;
  }

  async getImportStatus(jobId: string): Promise<StandImportJob> {
    const response = await fetch(`${API_BASE_URL}/api/stands/import/${jobId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch import status');
    }

    const result = await response.json();
    return result.data;
  }

  async getImportJobs(
    organizationId: string,
    page = 1,
    pageSize = 20
  ): Promise<{ data: StandImportJob[]; meta: any }> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    const response = await fetch(`${API_BASE_URL}/api/stands/import?${params}`, {
      headers: this.getHeaders(organizationId),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch import jobs');
    }

    const result = await response.json();
    return result.data;
  }
}

export const standApi = new StandApi();

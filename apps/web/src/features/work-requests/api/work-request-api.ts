import { API_BASE_URL } from '@/config/api';
import { mockApiHandler } from './mock-api-handler';

export interface WorkRequestSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  urgency: string;
  workType: string;
  assetType: string;
  assetCode: string;
  assetName: string;
  assetLocation?: string;
  requestedStartDate: string;
  requestedEndDate?: string;
  estimatedTotalCost?: number;
  requestorName: string;
  department?: string;
  submissionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkRequestData {
  assetId: string;
  assetType?: string;
  assetCode?: string;
  assetName?: string;
  workType: string;
  category: string;
  priority: string;
  urgency: string;
  impactLevel: string;
  title: string;
  description: string;
  locationDetails?: string;
  safetyConsiderations?: string;
  requestedStartDate: string;
  requestedEndDate?: string;
  estimatedDurationMinutes?: number;
  deadline?: string;
  estimatedPersonnelCount?: number;
  requiredSkills?: string[];
  requiredEquipment?: string[];
  estimatedMaterialsCost?: number;
  budgetCode?: string;
  estimatedTotalCost?: number;
}

// Helper function to check if backend is available
async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export const workRequestApi = {
  // Get work requests
  async getWorkRequests(organizationId: string, params?: any) {
    try {
      // Check if backend is available
      const backendAvailable = await isBackendAvailable();

      if (!backendAvailable) {
        console.log('Backend unavailable, using mock data');
        return mockApiHandler.getWorkRequests(organizationId, params);
      }

      const queryParams = new URLSearchParams(params);
      const response = await fetch(`${API_BASE_URL}/work-requests?${queryParams}`, {
        headers: {
          'x-organization-id': organizationId,
          'x-user-id': 'test-user-id', // TODO: Get from auth
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch work requests');
      }

      return response.json();
    } catch (error) {
      console.log('Error fetching work requests, falling back to mock data:', error);
      return mockApiHandler.getWorkRequests(organizationId, params);
    }
  },

  // Create work request
  async createWorkRequest(organizationId: string, userId: string, data: CreateWorkRequestData) {
    try {
      // Check if backend is available
      const backendAvailable = await isBackendAvailable();

      if (!backendAvailable) {
        console.log('Backend unavailable, using mock data');
        return mockApiHandler.createWorkRequest(organizationId, userId, data);
      }

      const response = await fetch(`${API_BASE_URL}/work-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': organizationId,
          'x-user-id': userId,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create work request');
      }

      return response.json();
    } catch (error) {
      console.log('Error creating work request, falling back to mock data:', error);
      return mockApiHandler.createWorkRequest(organizationId, userId, data);
    }
  },

  // Get single work request
  async getWorkRequest(organizationId: string, workRequestId: string) {
    try {
      // Check if backend is available
      const backendAvailable = await isBackendAvailable();

      if (!backendAvailable) {
        console.log('Backend unavailable, using mock data');
        return mockApiHandler.getWorkRequest(organizationId, workRequestId);
      }

      const response = await fetch(`${API_BASE_URL}/work-requests/${workRequestId}`, {
        headers: {
          'x-organization-id': organizationId,
          'x-user-id': 'test-user-id',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch work request');
      }

      return response.json();
    } catch (error) {
      console.log('Error fetching work request, falling back to mock data:', error);
      return mockApiHandler.getWorkRequest(organizationId, workRequestId);
    }
  },
};

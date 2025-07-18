// Mock API handler for development
// This simulates backend responses when no server is running

interface MockWorkRequest {
  id: string;
  organizationId: string;
  assetId: string;
  assetType: string;
  assetCode: string;
  assetName: string;
  title: string;
  description: string;
  workType: string;
  category: string;
  priority: string;
  urgency: string;
  impactLevel: string;
  status: string;
  requestedStartDate: string;
  requestedEndDate?: string;
  estimatedPersonnelCount: number;
  locationDetails?: string;
  safetyConsiderations?: string;
  requestorName: string;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory storage for mock data
let mockWorkRequests: MockWorkRequest[] = [];

// Helper to get stand info from localStorage or query cache
function getStandInfo(standId: string) {
  try {
    // First, try to get from the current query cache in the global window object
    if (typeof window !== 'undefined') {
      // Check if there's a React Query cache with stands data
      const queryClient = (window as any).__REACT_QUERY_CLIENT__;
      if (queryClient) {
        const cacheData = queryClient.getQueryData(['stands-dropdown', 'example-org-id']);
        if (cacheData?.data) {
          const stand = cacheData.data.find((s: any) => s.id === standId);
          if (stand) {
            return {
              assetCode: stand.code,
              assetName: stand.name,
            };
          }
        }
      }
    }

    // Fallback to localStorage with different cache keys
    const possibleCacheKeys = [
      'stands-cache',
      'stands-dropdown-example-org-id',
      'react-query-cache-stands',
    ];

    for (const cacheKey of possibleCacheKeys) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);

          // Try different data structures
          let standsArray = data;
          if (data.data) standsArray = data.data;
          if (data.state?.data?.data) standsArray = data.state.data.data;

          if (Array.isArray(standsArray)) {
            const stand = standsArray.find((s: any) => s.id === standId);
            if (stand) {
              return {
                assetCode: stand.code,
                assetName: stand.name,
              };
            }
          }
        }
      } catch (e) {
        // Continue to next cache key
      }
    }

    // Try to get from session storage as well
    const sessionStands = sessionStorage.getItem('stands-data');
    if (sessionStands) {
      const data = JSON.parse(sessionStands);
      if (Array.isArray(data)) {
        const stand = data.find((s: any) => s.id === standId);
        if (stand) {
          return {
            assetCode: stand.code,
            assetName: stand.name,
          };
        }
      }
    }
  } catch (e) {
    console.error('Error getting stand info:', e);
  }

  // Default fallback - create more realistic placeholder names
  const shortId = standId.slice(-4);
  return {
    assetCode: `A${shortId.toUpperCase()}`,
    assetName: `Stand A${shortId.toUpperCase()}`,
  };
}

export const mockApiHandler = {
  // Create a new work request
  createWorkRequest: async (organizationId: string, userId: string, data: any) => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

    // Prioritize stand info from request data if available
    let standInfo;
    if (data.assetCode && data.assetName) {
      standInfo = {
        assetCode: data.assetCode,
        assetName: data.assetName,
      };
    } else {
      // Fall back to getting stand info from cache or URL parameters
      standInfo = getStandInfo(data.assetId);

      // If we still have generic info, try to get it from URL parameters (when coming from stands page)
      if (standInfo.assetCode.startsWith('A') && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const assetCode = urlParams.get('assetCode');
        const assetName = urlParams.get('assetName');

        if (assetCode && assetName) {
          standInfo = {
            assetCode: assetCode,
            assetName: decodeURIComponent(assetName),
          };
        }
      }
    }

    const newRequest: MockWorkRequest = {
      id: `wr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      ...data,
      ...standInfo,
      status: 'submitted',
      requestorName: 'Test User',
      requestedBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Ensure we have all required fields for the detail view
      requestedEndDate: data.requestedEndDate || undefined,
      locationDetails: data.locationDetails || undefined,
      safetyConsiderations: data.safetyConsiderations || undefined,
      estimatedPersonnelCount: data.estimatedPersonnelCount || 1,
    };

    mockWorkRequests.push(newRequest);

    // Store in localStorage for persistence
    localStorage.setItem('mock-work-requests', JSON.stringify(mockWorkRequests));

    return {
      success: true,
      data: newRequest,
    };
  },

  // Get work requests
  getWorkRequests: async (organizationId: string, params?: any) => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay

    // Load from localStorage if available
    const stored = localStorage.getItem('mock-work-requests');
    if (stored) {
      mockWorkRequests = JSON.parse(stored);
    }

    // Filter by organization
    let requests = mockWorkRequests.filter((r) => r.organizationId === organizationId);

    // Apply search filter if provided
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      requests = requests.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.assetCode.toLowerCase().includes(searchLower) ||
          r.assetName.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRequests = requests.slice(startIndex, endIndex);

    return {
      success: true,
      data: {
        requests: paginatedRequests,
        pagination: {
          page,
          pageSize,
          total: requests.length,
          totalPages: Math.ceil(requests.length / pageSize),
        },
      },
    };
  },

  // Get single work request
  getWorkRequest: async (organizationId: string, workRequestId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate network delay

    // Load from localStorage if available
    const stored = localStorage.getItem('mock-work-requests');
    if (stored) {
      mockWorkRequests = JSON.parse(stored);
    }

    const request = mockWorkRequests.find(
      (r) => r.id === workRequestId && r.organizationId === organizationId
    );

    if (!request) {
      throw new Error('Work request not found');
    }

    return {
      success: true,
      data: request,
    };
  },
};

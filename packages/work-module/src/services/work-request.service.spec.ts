import { WorkRequestService } from './work-request.service';
import {
  WorkType,
  WorkCategory,
  Priority,
  Urgency,
  ImpactLevel,
  AssetType,
  WorkRequestStatus,
} from '../index';

// Mock Prisma client
const mockPrisma = {
  workRequest: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  workRequestStatusHistory: {
    create: jest.fn(),
  },
  workRequestStandAssociation: {
    create: jest.fn(),
  },
};

describe('WorkRequestService', () => {
  let service: WorkRequestService;
  const mockOrganizationId = 'test-org-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    service = new WorkRequestService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('createWorkRequest', () => {
    const validRequestData = {
      assetId: 'test-asset-id',
      assetType: AssetType.STAND,
      workType: WorkType.MAINTENANCE,
      category: WorkCategory.ROUTINE,
      priority: Priority.MEDIUM,
      urgency: Urgency.SCHEDULED,
      impactLevel: ImpactLevel.PARTIAL_RESTRICTION,
      title: 'Test maintenance request',
      description: 'This is a test maintenance request for stand A01',
      requestedStartDate: new Date('2024-02-15T08:00:00Z'),
    };

    it('should create a work request with valid data', async () => {
      const mockCreatedRequest = {
        id: 'test-request-id',
        ...validRequestData,
        organizationId: mockOrganizationId,
        requestedBy: mockUserId,
        status: WorkRequestStatus.DRAFT,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusHistory: [],
        comments: [],
        approvals: [],
        attachmentFiles: [],
        standAssociations: [],
        assetAssociations: [],
      };

      mockPrisma.workRequest.create.mockResolvedValue(mockCreatedRequest);
      mockPrisma.workRequestStatusHistory.create.mockResolvedValue({});
      mockPrisma.workRequestStandAssociation.create.mockResolvedValue({});

      const result = await service.createWorkRequest(
        mockOrganizationId,
        mockUserId,
        validRequestData
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe(validRequestData.title);
      expect(result.data?.status).toBe(WorkRequestStatus.DRAFT);
      expect(mockPrisma.workRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrganizationId,
          assetId: validRequestData.assetId,
          title: validRequestData.title,
          description: validRequestData.description,
          workType: validRequestData.workType,
          status: WorkRequestStatus.DRAFT,
          requestedBy: mockUserId,
        }),
        include: expect.any(Object),
      });
    });

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        ...validRequestData,
        title: 'x', // Too short
        description: 'y', // Too short
        requestedStartDate: new Date('2020-01-01T00:00:00Z'), // Past date
      };

      const result = await service.createWorkRequest(mockOrganizationId, mockUserId, invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.validationResults).toHaveLength(3);
      expect(result.validationResults?.[0].field).toBe('title');
      expect(result.validationResults?.[1].field).toBe('description');
      expect(result.validationResults?.[2].field).toBe('requestedStartDate');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.workRequest.create.mockRejectedValue(new Error('Database error'));

      const result = await service.createWorkRequest(
        mockOrganizationId,
        mockUserId,
        validRequestData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should create status history entry', async () => {
      const mockCreatedRequest = {
        id: 'test-request-id',
        ...validRequestData,
        statusHistory: [],
        comments: [],
        approvals: [],
        attachmentFiles: [],
        standAssociations: [],
        assetAssociations: [],
      };

      mockPrisma.workRequest.create.mockResolvedValue(mockCreatedRequest);
      mockPrisma.workRequestStatusHistory.create.mockResolvedValue({});
      mockPrisma.workRequestStandAssociation.create.mockResolvedValue({});

      await service.createWorkRequest(mockOrganizationId, mockUserId, validRequestData);

      expect(mockPrisma.workRequestStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workRequestId: 'test-request-id',
          fromStatus: null,
          toStatus: WorkRequestStatus.DRAFT,
          reason: 'Work request created',
          changedBy: mockUserId,
        }),
      });
    });
  });

  describe('updateWorkRequest', () => {
    const mockExistingRequest = {
      id: 'test-request-id',
      version: 1,
      status: WorkRequestStatus.DRAFT,
      statusHistory: [],
    };

    const updateData = {
      title: 'Updated title',
      description: 'Updated description for the work request',
      priority: Priority.HIGH,
      version: 1,
    };

    it('should update a work request with valid data', async () => {
      const mockUpdatedRequest = {
        ...mockExistingRequest,
        ...updateData,
        version: 2,
        statusHistory: [],
        comments: [],
        approvals: [],
        attachmentFiles: [],
        standAssociations: [],
        assetAssociations: [],
      };

      mockPrisma.workRequest.findUnique.mockResolvedValue(mockExistingRequest);
      mockPrisma.workRequest.update.mockResolvedValue(mockUpdatedRequest);

      const result = await service.updateWorkRequest('test-request-id', mockUserId, updateData);

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe(updateData.title);
      expect(result.data?.version).toBe(2);
      expect(mockPrisma.workRequest.update).toHaveBeenCalledWith({
        where: { id: 'test-request-id' },
        data: expect.objectContaining({
          ...updateData,
          version: { increment: 1 },
          updatedBy: mockUserId,
        }),
        include: expect.any(Object),
      });
    });

    it('should return error for non-existent work request', async () => {
      mockPrisma.workRequest.findUnique.mockResolvedValue(null);

      const result = await service.updateWorkRequest('non-existent-id', mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Work request not found');
    });

    it('should handle version conflicts', async () => {
      const conflictingRequest = {
        ...mockExistingRequest,
        version: 2, // Different version
      };

      mockPrisma.workRequest.findUnique.mockResolvedValue(conflictingRequest);

      const result = await service.updateWorkRequest('test-request-id', mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('modified by another user');
    });
  });

  describe('getWorkRequest', () => {
    it('should return work request details', async () => {
      const mockRequest = {
        id: 'test-request-id',
        title: 'Test request',
        status: WorkRequestStatus.DRAFT,
        statusHistory: [],
        comments: [],
        approvals: [],
        attachmentFiles: [],
        standAssociations: [],
        assetAssociations: [],
      };

      mockPrisma.workRequest.findUnique.mockResolvedValue(mockRequest);

      const result = await service.getWorkRequest('test-request-id', mockUserId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-request-id');
      expect(result.data?.title).toBe('Test request');
      expect(mockPrisma.workRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-request-id' },
        include: expect.objectContaining({
          statusHistory: { orderBy: { changedAt: 'desc' } },
          comments: { orderBy: { commentedAt: 'desc' } },
          approvals: { orderBy: { sequenceOrder: 'asc' } },
        }),
      });
    });

    it('should return error for non-existent work request', async () => {
      mockPrisma.workRequest.findUnique.mockResolvedValue(null);

      const result = await service.getWorkRequest('non-existent-id', mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Work request not found');
    });
  });

  describe('getWorkRequests', () => {
    it('should return paginated work requests', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          title: 'Request 1',
          status: WorkRequestStatus.DRAFT,
          priority: Priority.MEDIUM,
          urgency: Urgency.SCHEDULED,
          workType: WorkType.MAINTENANCE,
          assetType: AssetType.STAND,
          assetCode: 'A01',
          assetName: 'Stand A01',
          requestedStartDate: new Date(),
          requestorName: 'Test User',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);
      mockPrisma.workRequest.count.mockResolvedValue(1);

      const result = await service.getWorkRequests(mockOrganizationId, mockUserId, {}, 1, 25);

      expect(result.success).toBe(true);
      expect(result.data.requests).toHaveLength(1);
      expect(result.data.pagination.total).toBe(1);
      expect(result.data.pagination.page).toBe(1);
      expect(result.data.pagination.pageSize).toBe(25);
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: [WorkRequestStatus.DRAFT],
        priority: [Priority.HIGH],
        search: 'test',
      };

      mockPrisma.workRequest.findMany.mockResolvedValue([]);
      mockPrisma.workRequest.count.mockResolvedValue(0);

      await service.getWorkRequests(mockOrganizationId, mockUserId, filters, 1, 25);

      expect(mockPrisma.workRequest.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organizationId: mockOrganizationId,
          status: { in: [WorkRequestStatus.DRAFT] },
          priority: { in: [Priority.HIGH] },
          OR: expect.arrayContaining([
            { title: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
            { assetCode: { contains: 'test', mode: 'insensitive' } },
          ]),
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 25,
        select: expect.any(Object),
      });
    });
  });

  describe('validateWorkRequest', () => {
    it('should validate required fields', async () => {
      const invalidData = {
        title: '', // Empty title
        description: 'short', // Too short
        requestedStartDate: new Date('2020-01-01T00:00:00Z'), // Past date
      };

      const result = await service.validateWorkRequest(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.validationResults).toHaveLength(3);
      expect(result.validationResults[0].field).toBe('title');
      expect(result.validationResults[1].field).toBe('description');
      expect(result.validationResults[2].field).toBe('requestedStartDate');
    });

    it('should validate business rules', async () => {
      const invalidData = {
        title: 'Valid title',
        description: 'This is a valid description with enough characters',
        requestedStartDate: new Date('2024-02-15T08:00:00Z'),
        requestedEndDate: new Date('2024-02-14T08:00:00Z'), // End before start
        priority: Priority.CRITICAL,
        urgency: Urgency.ROUTINE, // Invalid combination
        estimatedTotalCost: -100, // Negative cost
      };

      const result = await service.validateWorkRequest(invalidData);

      expect(result.isValid).toBe(false);
      expect(
        result.validationResults.some((r) =>
          r.message.includes('End date must be after start date')
        )
      ).toBe(true);
      expect(
        result.validationResults.some((r) =>
          r.message.includes('Critical priority requests cannot have routine urgency')
        )
      ).toBe(true);
      expect(
        result.validationResults.some((r) =>
          r.message.includes('Estimated total cost cannot be negative')
        )
      ).toBe(true);
    });

    it('should return valid for correct data', async () => {
      const validData = {
        title: 'Valid work request title',
        description: 'This is a valid description with enough characters to pass validation',
        requestedStartDate: new Date('2024-02-15T08:00:00Z'),
        requestedEndDate: new Date('2024-02-15T12:00:00Z'),
        priority: Priority.MEDIUM,
        urgency: Urgency.SCHEDULED,
        estimatedTotalCost: 1000,
      };

      const result = await service.validateWorkRequest(validData);

      expect(result.isValid).toBe(true);
      expect(result.validationResults.filter((r) => r.severity === 'error')).toHaveLength(0);
    });
  });
});

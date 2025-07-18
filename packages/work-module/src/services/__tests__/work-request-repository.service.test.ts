import { PrismaClient } from '@prisma/client';
import { WorkRequestRepositoryService } from '../work-request-repository.service';
import { WorkRequestStatus, Priority, WorkType, AssetType } from '../../index';

// Mock PrismaClient
jest.mock('@prisma/client');

describe('WorkRequestRepositoryService', () => {
  let service: WorkRequestRepositoryService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workRequest: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      savedView: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditTrail: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    service = new WorkRequestRepositoryService(mockPrisma);
  });

  describe('searchWorkRequests', () => {
    it('should search work requests with filters', async () => {
      const mockRequests = [
        {
          id: '1',
          title: 'Test Request',
          status: WorkRequestStatus.SUBMITTED,
          priority: Priority.HIGH,
          createdAt: new Date(),
        },
      ];

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);
      mockPrisma.workRequest.count.mockResolvedValue(1);

      const result = await service.searchWorkRequests(
        'org-123',
        {
          status: [WorkRequestStatus.SUBMITTED],
          priority: [Priority.HIGH],
        },
        [],
        1,
        20
      );

      expect(result.success).toBe(true);
      expect(result.data?.requests).toHaveLength(1);
      expect(result.data?.totalCount).toBe(1);
      expect(mockPrisma.workRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-123',
            status: { in: [WorkRequestStatus.SUBMITTED] },
            priority: { in: [Priority.HIGH] },
          }),
        })
      );
    });

    it('should handle search errors gracefully', async () => {
      mockPrisma.workRequest.findMany.mockRejectedValue(new Error('Database error'));

      const result = await service.searchWorkRequests('org-123', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should apply sorting correctly', async () => {
      mockPrisma.workRequest.findMany.mockResolvedValue([]);
      mockPrisma.workRequest.count.mockResolvedValue(0);

      await service.searchWorkRequests('org-123', {}, [
        { field: 'priority', direction: 'desc' },
        { field: 'createdAt', direction: 'asc' },
      ]);

      expect(mockPrisma.workRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        })
      );
    });
  });

  describe('performBulkOperation', () => {
    it('should approve multiple requests', async () => {
      const requestIds = ['1', '2', '3'];
      const userId = 'user-123';

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrisma);
      });

      mockPrisma.workRequest.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.performBulkOperation(
        'org-123',
        requestIds,
        'approve',
        {},
        userId
      );

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(mockPrisma.workRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: requestIds },
          organizationId: 'org-123',
        },
        data: {
          status: WorkRequestStatus.APPROVED,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle bulk operation errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await service.performBulkOperation(
        'org-123',
        ['1'],
        'approve',
        {},
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
    });

    it('should validate bulk operations', async () => {
      const result = await service.performBulkOperation('org-123', [], 'approve', {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
    });
  });

  describe('getDashboardStats', () => {
    it('should calculate dashboard statistics', async () => {
      const mockStats = {
        _count: { _all: 100 },
        _sum: { estimatedTotalCost: 50000 },
        _avg: { estimatedDurationMinutes: 120 },
      };

      mockPrisma.workRequest.aggregate.mockResolvedValue(mockStats);
      mockPrisma.workRequest.groupBy.mockResolvedValue([
        { status: WorkRequestStatus.SUBMITTED, _count: 30 },
        { status: WorkRequestStatus.APPROVED, _count: 20 },
        { status: WorkRequestStatus.COMPLETED, _count: 50 },
      ]);

      const result = await service.getDashboardStats('org-123');

      expect(result.success).toBe(true);
      expect(result.data?.totalRequests).toBe(100);
      expect(result.data?.totalEstimatedCost).toBe(50000);
      expect(result.data?.avgDuration).toBe(120);
      expect(result.data?.byStatus).toHaveProperty(WorkRequestStatus.SUBMITTED, 30);
    });
  });

  describe('exportWorkRequests', () => {
    it('should export work requests to Excel', async () => {
      const mockRequests = [
        {
          id: '1',
          title: 'Test Request',
          status: WorkRequestStatus.SUBMITTED,
          priority: Priority.HIGH,
          assetCode: 'ASSET-001',
          requestorName: 'John Doe',
          createdAt: new Date(),
          estimatedTotalCost: 1000,
        },
      ];

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.exportWorkRequests('org-123', {}, { format: 'excel' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('should export work requests to CSV', async () => {
      const mockRequests = [
        {
          id: '1',
          title: 'Test Request',
          status: WorkRequestStatus.SUBMITTED,
        },
      ];

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.exportWorkRequests('org-123', {}, { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.data).toContain('ID,Title,Status');
      expect(result.contentType).toBe('text/csv');
    });
  });

  describe('savedViews', () => {
    it('should create a saved view', async () => {
      const mockView = {
        id: 'view-123',
        name: 'My View',
        filters: { status: [WorkRequestStatus.SUBMITTED] },
        isDefault: false,
        isShared: true,
      };

      mockPrisma.savedView.create.mockResolvedValue(mockView as any);

      const result = await service.createSavedView('org-123', 'user-123', {
        name: 'My View',
        filters: { status: [WorkRequestStatus.SUBMITTED] },
        isShared: true,
      });

      expect(result.success).toBe(true);
      expect(result.viewId).toBe('view-123');
    });

    it('should get saved views for user', async () => {
      const mockViews = [
        { id: '1', name: 'View 1', createdBy: 'user-123' },
        { id: '2', name: 'View 2', createdBy: 'other-user', isShared: true },
      ];

      mockPrisma.savedView.findMany.mockResolvedValue(mockViews as any);

      const result = await service.getSavedViews('org-123', 'user-123');

      expect(result.success).toBe(true);
      expect(result.views).toHaveLength(2);
    });

    it('should update a saved view', async () => {
      mockPrisma.savedView.update.mockResolvedValue({ id: 'view-123' } as any);

      const result = await service.updateSavedView('view-123', { name: 'Updated View' });

      expect(result.success).toBe(true);
      expect(mockPrisma.savedView.update).toHaveBeenCalledWith({
        where: { id: 'view-123' },
        data: expect.objectContaining({
          name: 'Updated View',
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should delete a saved view', async () => {
      mockPrisma.savedView.delete.mockResolvedValue({ id: 'view-123' } as any);

      const result = await service.deleteSavedView('view-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.savedView.delete).toHaveBeenCalledWith({
        where: { id: 'view-123' },
      });
    });
  });
});

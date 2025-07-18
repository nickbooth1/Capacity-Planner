import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StandCRUDOptimizedService } from './stand-crud-optimized.service';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import { StandCache } from '../cache/stand-cache';
import { Stand } from '@prisma/client';
import { CreateStandRequest, UpdateStandRequest, StandFilters } from '../types';

// Mock dependencies
vi.mock('../validation/capability-validation.engine');
vi.mock('../cache/stand-cache');
vi.mock('../config/database.config', () => ({
  getPrismaClient: vi.fn(() => mockPrisma),
}));

const mockPrisma = {
  stand: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    createMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

describe('StandCRUDOptimizedService', () => {
  let service: StandCRUDOptimizedService;
  let mockValidationEngine: any;
  let mockCache: any;

  const mockOrganizationId = 'org-123';
  const mockUserId = 'user-123';
  const mockStandId = 'stand-123';

  const mockStand: Stand = {
    id: mockStandId,
    organizationId: mockOrganizationId,
    code: 'A1',
    name: 'Alpha 1',
    terminal: 'Terminal A',
    status: 'operational',
    capabilities: {},
    dimensions: { length: 50, width: 40 },
    aircraftCompatibility: { compatibleCategories: ['C', 'D'] },
    groundSupport: { hasPowerSupply: true, hasJetbridge: true },
    operationalConstraints: {},
    environmentalFeatures: {},
    infrastructure: {},
    geometry: null,
    latitude: null,
    longitude: null,
    metadata: {},
    version: 1,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUserId,
    updatedBy: mockUserId,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockValidationEngine = {
      validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    };

    mockCache = {
      getStand: vi.fn(),
      setStand: vi.fn(),
      getStandList: vi.fn(),
      setStandList: vi.fn(),
      getStats: vi.fn(),
      setStats: vi.fn(),
      invalidateStand: vi.fn(),
      invalidateListCaches: vi.fn(),
      invalidateStats: vi.fn(),
      clearOrganizationCache: vi.fn(),
      warmCache: vi.fn(),
      getCacheInfo: vi.fn(),
      getMetrics: vi.fn(),
    };

    // Mock cache constructor
    vi.mocked(StandCache).mockImplementation(() => mockCache);

    service = new StandCRUDOptimizedService(mockValidationEngine);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createStand', () => {
    it('should create a stand and update cache', async () => {
      const createRequest: CreateStandRequest = {
        code: 'B2',
        name: 'Bravo 2',
        terminal: 'Terminal B',
        status: 'operational',
        dimensions: { length: 60, width: 50 },
      };

      mockPrisma.stand.findFirst.mockResolvedValue(null); // No existing stand
      mockPrisma.stand.create.mockResolvedValue({ ...mockStand, ...createRequest });

      const result = await service.createStand(mockOrganizationId, createRequest, mockUserId);

      expect(mockPrisma.stand.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrganizationId,
          code: createRequest.code,
          name: createRequest.name,
          createdBy: mockUserId,
        }),
      });

      expect(mockCache.setStand).toHaveBeenCalled();
      expect(mockCache.invalidateListCaches).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockCache.invalidateStats).toHaveBeenCalledWith(mockOrganizationId);
    });

    it('should validate capabilities if provided', async () => {
      const createRequest: CreateStandRequest = {
        code: 'C3',
        name: 'Charlie 3',
        dimensions: { length: 70 },
        aircraftCompatibility: { maxWingspan: 65 },
      };

      mockPrisma.stand.findFirst.mockResolvedValue(null);
      mockPrisma.stand.create.mockResolvedValue(mockStand);

      await service.createStand(mockOrganizationId, createRequest, mockUserId);

      expect(mockValidationEngine.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions: createRequest.dimensions,
          aircraftCompatibility: createRequest.aircraftCompatibility,
        })
      );
    });
  });

  describe('getStandById', () => {
    it('should return cached stand if available', async () => {
      mockCache.getStand.mockResolvedValue(mockStand);

      const result = await service.getStandById(mockStandId, mockOrganizationId);

      expect(result).toEqual(mockStand);
      expect(mockCache.getStand).toHaveBeenCalledWith(mockStandId, mockOrganizationId);
      expect(mockPrisma.stand.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockCache.getStand.mockResolvedValue(null);
      mockPrisma.stand.findFirst.mockResolvedValue(mockStand);

      const result = await service.getStandById(mockStandId, mockOrganizationId);

      expect(result).toEqual(mockStand);
      expect(mockPrisma.stand.findFirst).toHaveBeenCalled();
      expect(mockCache.setStand).toHaveBeenCalledWith(mockStand, mockOrganizationId);
    });
  });

  describe('getStands', () => {
    it('should return cached list if available', async () => {
      const cachedResult = {
        data: [mockStand],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      };

      mockCache.getStandList.mockResolvedValue(cachedResult);

      const filters: StandFilters = { status: 'operational' };
      const result = await service.getStands(mockOrganizationId, filters, 1, 50);

      expect(result).toEqual(cachedResult);
      expect(mockCache.getStandList).toHaveBeenCalledWith(mockOrganizationId, filters, 1, 50);
      expect(mockPrisma.stand.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      const dbResult = {
        data: [mockStand],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      };

      mockCache.getStandList.mockResolvedValue(null);
      mockPrisma.stand.count.mockResolvedValue(1);
      mockPrisma.stand.findMany.mockResolvedValue([mockStand]);

      const filters: StandFilters = { terminal: 'Terminal A' };
      const result = await service.getStands(mockOrganizationId, filters, 1, 50);

      expect(mockPrisma.stand.findMany).toHaveBeenCalled();
      expect(mockCache.setStandList).toHaveBeenCalledWith(
        expect.objectContaining({ data: [mockStand] }),
        mockOrganizationId,
        filters,
        1,
        50
      );
    });
  });

  describe('updateStand', () => {
    it('should update stand and invalidate caches', async () => {
      const updateRequest: UpdateStandRequest = {
        name: 'Updated Alpha 1',
        version: 1,
      };

      mockCache.getStand.mockResolvedValue(mockStand);
      mockPrisma.stand.update.mockResolvedValue({ ...mockStand, ...updateRequest, version: 2 });

      const result = await service.updateStand(
        mockStandId,
        mockOrganizationId,
        updateRequest,
        mockUserId
      );

      expect(mockPrisma.stand.update).toHaveBeenCalledWith({
        where: {
          id: mockStandId,
          organizationId: mockOrganizationId,
          version: updateRequest.version,
        },
        data: expect.objectContaining({
          updatedBy: mockUserId,
          version: { increment: 1 },
        }),
      });

      expect(mockCache.setStand).toHaveBeenCalled();
      expect(mockCache.invalidateListCaches).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockCache.invalidateStats).toHaveBeenCalledWith(mockOrganizationId);
    });

    it('should handle optimistic locking conflicts', async () => {
      const updateRequest: UpdateStandRequest = {
        name: 'Updated Alpha 1',
        version: 1,
      };

      mockCache.getStand.mockResolvedValue(mockStand);
      mockPrisma.stand.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.updateStand(mockStandId, mockOrganizationId, updateRequest, mockUserId)
      ).rejects.toThrow('Stand was modified by another user');
    });
  });

  describe('getStandStats', () => {
    it('should return cached stats if available', async () => {
      const cachedStats = {
        total: 10,
        operational: 7,
        maintenance: 2,
        closed: 1,
        byTerminal: { 'Terminal A': 5, 'Terminal B': 5 },
      };

      mockCache.getStats.mockResolvedValue(cachedStats);

      const result = await service.getStandStats(mockOrganizationId);

      expect(result).toEqual(cachedStats);
      expect(mockCache.getStats).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockPrisma.stand.groupBy).not.toHaveBeenCalled();
    });

    it('should calculate stats from database if not cached', async () => {
      mockCache.getStats.mockResolvedValue(null);

      mockPrisma.stand.groupBy
        .mockResolvedValueOnce([
          { status: 'operational', _count: { status: 7 } },
          { status: 'maintenance', _count: { status: 2 } },
        ])
        .mockResolvedValueOnce([
          { terminal: 'Terminal A', _count: { terminal: 5 } },
          { terminal: 'Terminal B', _count: { terminal: 5 } },
        ]);

      mockPrisma.stand.count.mockResolvedValue(10);

      const result = await service.getStandStats(mockOrganizationId);

      expect(result).toEqual({
        total: 10,
        operational: 7,
        maintenance: 2,
        closed: 0,
        byTerminal: { 'Terminal A': 5, 'Terminal B': 5 },
      });

      expect(mockCache.setStats).toHaveBeenCalled();
    });
  });

  describe('bulkCreateStands', () => {
    it('should create stands in batches', async () => {
      const stands: CreateStandRequest[] = Array(150)
        .fill(null)
        .map((_, i) => ({
          code: `TEST${i}`,
          name: `Test Stand ${i}`,
        }));

      mockPrisma.stand.findFirst.mockResolvedValue(null);
      mockPrisma.stand.createMany.mockResolvedValue({ count: 100 });

      const result = await service.bulkCreateStands(mockOrganizationId, stands, mockUserId);

      // Should be called twice (100 + 50)
      expect(mockPrisma.stand.createMany).toHaveBeenCalledTimes(2);
      expect(mockCache.clearOrganizationCache).toHaveBeenCalledWith(mockOrganizationId);
    });
  });

  describe('warmCache', () => {
    it('should warm cache with recent stands', async () => {
      const recentStands = [mockStand];
      mockPrisma.stand.findMany.mockResolvedValue(recentStands);

      await service.warmCache(mockOrganizationId, 100);

      expect(mockPrisma.stand.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          isDeleted: false,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 100,
      });

      expect(mockCache.warmCache).toHaveBeenCalledWith(recentStands, mockOrganizationId);
    });
  });
});

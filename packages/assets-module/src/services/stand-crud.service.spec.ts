import { StandCRUDService } from './stand-crud.service';
import { PrismaClient } from '@prisma/client';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import type {
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
} from '../types/stand-capabilities';

// Mock PrismaClient
const mockPrisma = {
  stand: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  standAuditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient;

// Mock CapabilityValidationEngine
const mockValidationEngine = {
  validate: jest.fn(),
  invalidateCache: jest.fn(),
} as unknown as CapabilityValidationEngine;

// Mock StandCapabilityRepository
jest.mock('../repositories/stand-capability.repository', () => ({
  StandCapabilityRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    existsByCode: jest.fn(),
  })),
}));

describe('StandCRUDService', () => {
  let service: StandCRUDService;
  let mockRepository: any;

  const organizationId = 'test-org-id';
  const userId = 'test-user-id';
  const standId = 'test-stand-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StandCRUDService(mockPrisma, mockValidationEngine);
    mockRepository = (service as any).repository;
  });

  describe('createStand', () => {
    const createRequest: CreateStandRequest = {
      code: 'A1',
      name: 'Stand A1',
      terminal: 'Terminal 1',
      status: 'operational',
      dimensions: {
        length: 60,
        width: 30,
        height: 15,
      },
    };

    it('should create a stand successfully', async () => {
      const mockStand = {
        id: standId,
        ...createRequest,
        organizationId,
        createdBy: userId,
        version: 1,
      };

      mockRepository.existsByCode.mockResolvedValue(false);
      mockValidationEngine.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockRepository.create.mockResolvedValue(mockStand);

      const result = await service.createStand(organizationId, createRequest, userId);

      expect(mockRepository.existsByCode).toHaveBeenCalledWith(createRequest.code, organizationId);
      expect(mockValidationEngine.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions: createRequest.dimensions,
        })
      );
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createRequest,
        organizationId,
        createdBy: userId,
        updatedBy: userId,
      });
      expect(result).toEqual(mockStand);
    });

    it('should throw error if stand code already exists', async () => {
      mockRepository.existsByCode.mockResolvedValue(true);

      await expect(service.createStand(organizationId, createRequest, userId)).rejects.toThrow(
        `Stand with code ${createRequest.code} already exists`
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if validation fails', async () => {
      mockRepository.existsByCode.mockResolvedValue(false);
      mockValidationEngine.validate.mockResolvedValue({
        isValid: false,
        errors: ['Invalid dimensions'],
        warnings: [],
      });

      await expect(service.createStand(organizationId, createRequest, userId)).rejects.toThrow(
        'Validation failed: Invalid dimensions'
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStand', () => {
    const updateRequest: UpdateStandRequest = {
      name: 'Updated Stand A1',
      status: 'maintenance',
      version: 1,
    };

    it('should update a stand successfully', async () => {
      const existingStand = {
        id: standId,
        code: 'A1',
        name: 'Stand A1',
        version: 1,
        organizationId,
      };

      const updatedStand = {
        ...existingStand,
        ...updateRequest,
        version: 2,
        updatedBy: userId,
      };

      mockRepository.findById.mockResolvedValue(existingStand);
      mockValidationEngine.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      mockRepository.update.mockResolvedValue(updatedStand);

      const result = await service.updateStand(standId, organizationId, updateRequest, userId);

      expect(mockRepository.findById).toHaveBeenCalledWith(standId, organizationId);
      expect(mockRepository.update).toHaveBeenCalledWith(
        standId,
        organizationId,
        expect.objectContaining({
          name: updateRequest.name,
          status: updateRequest.status,
          updatedBy: userId,
        }),
        updateRequest.version
      );
      expect(result).toEqual(updatedStand);
    });

    it('should throw error if stand not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStand(standId, organizationId, updateRequest, userId)
      ).rejects.toThrow('Stand not found');

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle optimistic locking conflict', async () => {
      const existingStand = {
        id: standId,
        version: 2,
        organizationId,
      };

      mockRepository.findById.mockResolvedValue(existingStand);

      await expect(
        service.updateStand(standId, organizationId, updateRequest, userId)
      ).rejects.toThrow('Stand has been modified by another user');
    });
  });

  describe('deleteStand', () => {
    it('should soft delete a stand successfully', async () => {
      const existingStand = {
        id: standId,
        code: 'A1',
        organizationId,
        isDeleted: false,
      };

      mockRepository.findById.mockResolvedValue(existingStand);
      mockRepository.softDelete.mockResolvedValue(undefined);

      await service.deleteStand(standId, organizationId, userId);

      expect(mockRepository.findById).toHaveBeenCalledWith(standId, organizationId);
      expect(mockRepository.softDelete).toHaveBeenCalledWith(standId, organizationId, userId);
      expect(mockValidationEngine.invalidateCache).toHaveBeenCalledWith(standId);
    });

    it('should throw error if stand already deleted', async () => {
      const existingStand = {
        id: standId,
        isDeleted: true,
      };

      mockRepository.findById.mockResolvedValue(existingStand);

      await expect(service.deleteStand(standId, organizationId, userId)).rejects.toThrow(
        'Stand is already deleted'
      );

      expect(mockRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('getStands', () => {
    const filters: StandFilters = {
      status: 'operational',
      terminal: 'Terminal 1',
      page: 1,
      pageSize: 20,
    };

    it('should retrieve stands with filters and pagination', async () => {
      const mockStands = [
        { id: 'stand-1', code: 'A1', status: 'operational' },
        { id: 'stand-2', code: 'A2', status: 'operational' },
      ];

      const mockResult = {
        data: mockStands,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };

      mockRepository.findAll.mockResolvedValue(mockResult);

      const result = await service.getStands(organizationId, filters, 1, 20);

      expect(mockRepository.findAll).toHaveBeenCalledWith(organizationId, filters, {
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle empty results', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };

      mockRepository.findAll.mockResolvedValue(mockResult);

      const result = await service.getStands(organizationId, {}, 1, 20);

      expect(result).toEqual(mockResult);
    });
  });

  describe('getStandById', () => {
    it('should retrieve a stand by id', async () => {
      const mockStand = {
        id: standId,
        code: 'A1',
        organizationId,
      };

      mockRepository.findById.mockResolvedValue(mockStand);

      const result = await service.getStandById(standId, organizationId);

      expect(mockRepository.findById).toHaveBeenCalledWith(standId, organizationId, false);
      expect(result).toEqual(mockStand);
    });

    it('should include deleted stands when requested', async () => {
      const mockStand = {
        id: standId,
        code: 'A1',
        organizationId,
        isDeleted: true,
      };

      mockRepository.findById.mockResolvedValue(mockStand);

      const result = await service.getStandById(standId, organizationId, true);

      expect(mockRepository.findById).toHaveBeenCalledWith(standId, organizationId, true);
      expect(result).toEqual(mockStand);
    });
  });

  describe('getStandStats', () => {
    it('should calculate stand statistics', async () => {
      mockPrisma.stand.count.mockImplementation((params: any) => {
        if (params.where.status === 'operational') return Promise.resolve(10);
        if (params.where.status === 'maintenance') return Promise.resolve(3);
        if (params.where.status === 'closed') return Promise.resolve(2);
        return Promise.resolve(15);
      });

      mockPrisma.stand.findMany.mockResolvedValue([
        { terminal: 'Terminal 1', _count: { id: 5 } },
        { terminal: 'Terminal 2', _count: { id: 10 } },
      ]);

      const result = await service.getStandStats(organizationId);

      expect(result).toEqual({
        total: 15,
        operational: 10,
        maintenance: 3,
        closed: 2,
        byTerminal: {
          'Terminal 1': 5,
          'Terminal 2': 10,
        },
        byAircraftCategory: {},
      });
    });
  });
});

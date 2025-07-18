import { StandCapabilityService } from './stand-capability.service';
import { PrismaClient } from '@prisma/client';
import { StandCapabilities, ICAOAircraftCategory } from '../types';

// Mock PrismaClient
const mockPrisma = {
  standCapabilitySnapshot: {
    create: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock StandCapabilityRepository
jest.mock('../repositories/stand-capability.repository', () => ({
  StandCapabilityRepository: jest.fn().mockImplementation(() => ({
    findByIdWithCapabilities: jest.fn(),
    updateCapabilities: jest.fn(),
    bulkUpdateCapabilities: jest.fn(),
    queryByCapabilities: jest.fn(),
    getCapabilityStatistics: jest.fn(),
    getCapabilityHistory: jest.fn(),
  })),
}));

// Mock CapabilityValidationEngine
jest.mock('../validation/capability-validation.engine', () => ({
  CapabilityValidationEngine: jest.fn().mockImplementation(() => ({
    validate: jest.fn(),
    invalidateCache: jest.fn(),
    getCacheMetrics: jest.fn(),
    clearCache: jest.fn(),
  })),
}));

describe('StandCapabilityService', () => {
  let service: StandCapabilityService;
  let mockRepository: any;
  let mockValidationEngine: any;

  const organizationId = 'test-org-id';
  const standId = 'test-stand-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StandCapabilityService(mockPrisma);
    mockRepository = (service as any).repository;
    mockValidationEngine = (service as any).validationEngine;
  });

  describe('getCapabilities', () => {
    it('should return stand capabilities', async () => {
      const mockStand = {
        id: standId,
        identifier: 'A01',
        organizationId,
        capabilities: {
          dimensions: {
            length: 60,
            width: 45,
            icaoCategory: ICAOAircraftCategory.C,
          },
        },
      };

      mockRepository.findByIdWithCapabilities.mockResolvedValue(mockStand);

      const result = await service.getCapabilities(standId, organizationId);

      expect(result).toEqual({
        stand: mockStand,
        capabilities: mockStand.capabilities,
      });
      expect(mockRepository.findByIdWithCapabilities).toHaveBeenCalledWith(standId, organizationId);
    });

    it('should throw error if stand not found', async () => {
      mockRepository.findByIdWithCapabilities.mockResolvedValue(null);

      await expect(service.getCapabilities(standId, organizationId)).rejects.toThrow(
        `Stand with ID ${standId} not found`
      );
    });
  });

  describe('updateCapabilities', () => {
    it('should update capabilities with validation', async () => {
      const currentStand = {
        id: standId,
        capabilities: {
          dimensions: {
            length: 50,
            width: 40,
            icaoCategory: ICAOAircraftCategory.B,
          },
        },
      };

      const newCapabilities: Partial<StandCapabilities> = {
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: ICAOAircraftCategory.C,
        },
      };

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
        timestamp: new Date(),
      };

      const updatedStand = {
        ...currentStand,
        capabilities: {
          ...currentStand.capabilities,
          ...newCapabilities,
        },
      };

      mockRepository.findByIdWithCapabilities.mockResolvedValue(currentStand);
      mockValidationEngine.validate.mockResolvedValue({ result: validationResult });
      mockRepository.updateCapabilities.mockResolvedValue(updatedStand);
      mockValidationEngine.invalidateCache.mockResolvedValue(undefined);

      const result = await service.updateCapabilities(
        standId,
        organizationId,
        newCapabilities,
        userId
      );

      expect(result).toEqual({
        stand: updatedStand,
        validationResult,
      });

      expect(mockValidationEngine.validate).toHaveBeenCalledWith(
        {
          ...currentStand.capabilities,
          ...newCapabilities,
        },
        { useCache: true }
      );

      expect(mockRepository.updateCapabilities).toHaveBeenCalledWith(
        standId,
        organizationId,
        newCapabilities,
        userId
      );

      expect(mockValidationEngine.invalidateCache).toHaveBeenCalledWith(updatedStand.capabilities);
    });

    it('should throw error if validation fails', async () => {
      const currentStand = {
        id: standId,
        capabilities: {
          dimensions: {
            length: 50,
            width: 40,
          },
        },
      };

      const newCapabilities: Partial<StandCapabilities> = {
        dimensions: {
          length: 0, // Invalid length
          width: 45,
        },
      };

      const validationResult = {
        isValid: false,
        errors: [
          {
            field: 'dimensions.length',
            message: 'Length must be greater than 0',
            code: 'INVALID_LENGTH',
            severity: 'error' as const,
          },
        ],
        warnings: [],
        icaoCompliant: false,
        timestamp: new Date(),
      };

      mockRepository.findByIdWithCapabilities.mockResolvedValue(currentStand);
      mockValidationEngine.validate.mockResolvedValue({ result: validationResult });

      await expect(
        service.updateCapabilities(standId, organizationId, newCapabilities, userId)
      ).rejects.toThrow('Capability validation failed: Length must be greater than 0');
    });

    it('should skip validation when option is set', async () => {
      const currentStand = {
        id: standId,
        capabilities: {
          dimensions: {
            length: 50,
            width: 40,
          },
        },
      };

      const newCapabilities: Partial<StandCapabilities> = {
        dimensions: {
          length: 60,
          width: 45,
        },
      };

      const updatedStand = {
        ...currentStand,
        capabilities: {
          ...currentStand.capabilities,
          ...newCapabilities,
        },
      };

      mockRepository.findByIdWithCapabilities.mockResolvedValue(currentStand);
      mockRepository.updateCapabilities.mockResolvedValue(updatedStand);
      mockValidationEngine.invalidateCache.mockResolvedValue(undefined);

      const result = await service.updateCapabilities(
        standId,
        organizationId,
        newCapabilities,
        userId,
        { validateBeforeUpdate: false }
      );

      expect(result).toEqual({
        stand: updatedStand,
        validationResult: null,
      });

      expect(mockValidationEngine.validate).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdateCapabilities', () => {
    it('should perform bulk update with validation', async () => {
      const operations = [
        {
          standId: 'stand-1',
          capabilities: {
            dimensions: {
              length: 60,
              width: 45,
            },
          },
        },
        {
          standId: 'stand-2',
          capabilities: {
            groundSupport: {
              hasPowerSupply: true,
            },
          },
        },
      ];

      const mockStands = [
        {
          id: 'stand-1',
          capabilities: {
            dimensions: {
              length: 50,
              width: 40,
            },
          },
        },
        {
          id: 'stand-2',
          capabilities: {
            groundSupport: {
              hasPowerSupply: false,
            },
          },
        },
      ];

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
        timestamp: new Date(),
      };

      mockRepository.findByIdWithCapabilities
        .mockResolvedValueOnce(mockStands[0])
        .mockResolvedValueOnce(mockStands[1]);

      mockValidationEngine.validate.mockResolvedValue({ result: validationResult });

      mockRepository.bulkUpdateCapabilities.mockResolvedValue({
        updated: 2,
        failed: 0,
        errors: [],
      });

      mockRepository.findByIdWithCapabilities
        .mockResolvedValueOnce({ ...mockStands[0], capabilities: operations[0].capabilities })
        .mockResolvedValueOnce({ ...mockStands[1], capabilities: operations[1].capabilities });

      const result = await service.bulkUpdateCapabilities(operations, organizationId, userId);

      expect(result).toEqual({
        totalOperations: 2,
        successful: 2,
        failed: 0,
        results: [],
      });

      expect(mockValidationEngine.validate).toHaveBeenCalledTimes(2);
      expect(mockRepository.bulkUpdateCapabilities).toHaveBeenCalledWith(
        operations,
        organizationId,
        userId
      );
    });

    it('should handle validation failures in bulk update', async () => {
      const operations = [
        {
          standId: 'stand-1',
          capabilities: {
            dimensions: {
              length: 0, // Invalid
              width: 45,
            },
          },
        },
      ];

      const mockStand = {
        id: 'stand-1',
        capabilities: {
          dimensions: {
            length: 50,
            width: 40,
          },
        },
      };

      const validationResult = {
        isValid: false,
        errors: [
          {
            field: 'dimensions.length',
            message: 'Length must be greater than 0',
            code: 'INVALID_LENGTH',
            severity: 'error' as const,
          },
        ],
        warnings: [],
        icaoCompliant: false,
        timestamp: new Date(),
      };

      mockRepository.findByIdWithCapabilities.mockResolvedValue(mockStand);
      mockValidationEngine.validate.mockResolvedValue({ result: validationResult });

      const result = await service.bulkUpdateCapabilities(operations, organizationId, userId);

      expect(result).toEqual({
        totalOperations: 1,
        successful: 0,
        failed: 1,
        results: [
          {
            standId: 'stand-1',
            success: false,
            error: 'Validation failed: Length must be greater than 0',
            validationResult,
          },
        ],
      });

      expect(mockRepository.bulkUpdateCapabilities).not.toHaveBeenCalled();
    });
  });

  describe('validateCapabilities', () => {
    it('should validate capabilities using validation engine', async () => {
      const capabilities: StandCapabilities = {
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: ICAOAircraftCategory.C,
        },
      };

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
        timestamp: new Date(),
      };

      mockValidationEngine.validate.mockResolvedValue({ result: validationResult });

      const result = await service.validateCapabilities(capabilities);

      expect(result).toEqual({ result: validationResult });
      expect(mockValidationEngine.validate).toHaveBeenCalledWith(capabilities, {
        useCache: true,
        performanceTracking: false,
      });
    });
  });

  describe('event handling', () => {
    it('should publish events when capabilities are updated', async () => {
      const mockListener = jest.fn();
      service.addEventListener(mockListener);

      const currentStand = {
        id: standId,
        capabilities: {
          dimensions: {
            length: 50,
            width: 40,
          },
        },
      };

      const newCapabilities: Partial<StandCapabilities> = {
        dimensions: {
          length: 60,
          width: 45,
        },
      };

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
        timestamp: new Date(),
      };

      const updatedStand = {
        ...currentStand,
        capabilities: {
          ...currentStand.capabilities,
          ...newCapabilities,
        },
      };

      mockRepository.findByIdWithCapabilities.mockResolvedValue(currentStand);
      mockValidationEngine.validate.mockResolvedValue({ result: validationResult });
      mockRepository.updateCapabilities.mockResolvedValue(updatedStand);
      mockValidationEngine.invalidateCache.mockResolvedValue(undefined);

      await service.updateCapabilities(standId, organizationId, newCapabilities, userId);

      expect(mockListener).toHaveBeenCalledWith({
        standId,
        organizationId,
        capabilities: newCapabilities,
        userId,
        timestamp: expect.any(Date),
        validationResult,
      });
    });
  });
});

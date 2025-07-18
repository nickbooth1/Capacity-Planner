import { PrismaClient } from '@prisma/client';
import { SecureStandCRUDService } from './secure-stand-crud.service';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import { SecurityContext } from '../security/stand-security.service';
import { AuditEventType } from '../security/audit.service';
import { CreateStandRequest, UpdateStandRequest } from '../types';

// Mock Prisma
jest.mock('@prisma/client');

// Mock validation engine
jest.mock('../validation/capability-validation.engine');

describe('SecureStandCRUDService', () => {
  let service: SecureStandCRUDService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockValidationEngine: jest.Mocked<CapabilityValidationEngine>;
  let testContext: SecurityContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockValidationEngine =
      new CapabilityValidationEngine() as jest.Mocked<CapabilityValidationEngine>;

    // Set up transaction mock
    mockPrisma.$transaction = jest.fn().mockImplementation((callback) => callback(mockPrisma));
    mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
    mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);

    // Mock audit event creation
    mockPrisma.auditEvent = {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    } as any;

    // Create service
    service = new SecureStandCRUDService(
      mockPrisma,
      mockValidationEngine,
      'test-encryption-key-32-characters-hex-value-here'
    );

    // Test security context
    testContext = {
      userId: 'test-user',
      organizationId: 'test-org',
      role: 'user',
      permissions: ['capability_management', 'capability_read'],
      accessLevel: 'write' as any,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      requestId: 'test-request',
      sessionId: 'test-session',
    };
  });

  describe('createStand', () => {
    const createRequest: CreateStandRequest = {
      code: 'A1',
      name: 'Alpha 1',
      terminal: 'Terminal A',
      status: 'operational',
      dimensions: {
        length: 50,
        width: 40,
        height: 15,
      },
    };

    it('should create a stand with security validation', async () => {
      // Mock repository responses
      const mockStand = {
        id: 'stand-1',
        ...createRequest,
        organizationId: testContext.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock repository methods
      const mockRepository = {
        existsByCode: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue(mockStand),
      };
      (service as any).repository = mockRepository;

      // Mock validation
      mockValidationEngine.validate.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: {},
      });

      const result = await service.createStand(testContext, createRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStand);
      expect(mockRepository.existsByCode).toHaveBeenCalledWith('A1', testContext.organizationId);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should reject creation without proper permissions', async () => {
      // Remove permissions
      const unauthorizedContext = {
        ...testContext,
        permissions: [],
        accessLevel: 'read' as any,
      };

      const result = await service.createStand(unauthorizedContext, createRequest);

      expect(result.success).toBe(false);
      expect(result.securityViolations).toContain('User lacks capability_management permission');
    });

    it('should reject duplicate stand codes', async () => {
      // Mock existing stand
      const mockRepository = {
        existsByCode: jest.fn().mockResolvedValue(true),
      };
      (service as any).repository = mockRepository;

      const result = await service.createStand(testContext, createRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should encrypt sensitive fields', async () => {
      const sensitiveRequest: CreateStandRequest = {
        ...createRequest,
        operationalConstraints: {
          securityRequirements: {
            level: 'high',
            protocols: ['TSA', 'CBP'],
          },
        },
      };

      // Mock repository
      const mockRepository = {
        existsByCode: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockImplementation((orgId, data) => ({
          id: 'stand-1',
          ...data,
          organizationId: orgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      };
      (service as any).repository = mockRepository;

      // Mock validation
      mockValidationEngine.validate.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: {},
      });

      const result = await service.createStand(testContext, sensitiveRequest);

      expect(result.success).toBe(true);

      // Check that sensitive data was encrypted
      const createdData = mockRepository.create.mock.calls[0][1];
      expect(createdData.operationalConstraints.securityRequirements).toHaveProperty('encrypted');
      expect(createdData.operationalConstraints.securityRequirements).toHaveProperty('iv');
      expect(createdData.operationalConstraints.securityRequirements).toHaveProperty('tag');
    });
  });

  describe('updateStand', () => {
    const updateRequest: UpdateStandRequest = {
      name: 'Alpha 1 Updated',
      status: 'maintenance',
    };

    const existingStand = {
      id: 'stand-1',
      code: 'A1',
      name: 'Alpha 1',
      terminal: 'Terminal A',
      status: 'operational',
      organizationId: testContext.organizationId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update a stand with security validation', async () => {
      // Mock repository
      const mockRepository = {
        findById: jest.fn().mockResolvedValue(existingStand),
        existsByCode: jest.fn().mockResolvedValue(false),
        update: jest.fn().mockResolvedValue({
          ...existingStand,
          ...updateRequest,
          version: 2,
          updatedAt: new Date(),
        }),
      };
      (service as any).repository = mockRepository;

      const result = await service.updateStand(testContext, 'stand-1', updateRequest);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Alpha 1 Updated');
      expect(result.data?.status).toBe('maintenance');
    });

    it('should handle optimistic locking conflicts', async () => {
      // Mock repository
      const mockRepository = {
        findById: jest.fn().mockResolvedValue(existingStand),
        existsByCode: jest.fn().mockResolvedValue(false),
        update: jest.fn().mockRejectedValue({ code: 'P2025' }),
      };
      (service as any).repository = mockRepository;

      const result = await service.updateStand(testContext, 'stand-1', updateRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('modified by another user');
    });

    it('should validate field-level access for updates', async () => {
      // Context without admin privileges
      const limitedContext = {
        ...testContext,
        role: 'user',
        permissions: ['capability_management'],
        accessLevel: 'write' as any,
      };

      // Try to update restricted fields
      const restrictedUpdate: UpdateStandRequest = {
        operationalConstraints: {
          securityRequirements: {
            level: 'critical',
          },
        },
      };

      // Mock repository
      const mockRepository = {
        findById: jest.fn().mockResolvedValue(existingStand),
      };
      (service as any).repository = mockRepository;

      // Mock field access service to deny access
      const mockFieldAccess = (service as any).fieldAccessService;
      mockFieldAccess.hasFieldAccess = jest.fn().mockReturnValue(false);

      const result = await service.updateStand(limitedContext, 'stand-1', restrictedUpdate);

      expect(result.success).toBe(false);
      expect(result.securityViolations).toContain(
        'Unauthorized attempt to modify operationalConstraints'
      );
    });
  });

  describe('deleteStand', () => {
    it('should only allow admins to delete stands', async () => {
      // Non-admin context
      const nonAdminContext = {
        ...testContext,
        role: 'user',
        accessLevel: 'write' as any,
      };

      const result = await service.deleteStand(nonAdminContext, 'stand-1');

      expect(result.success).toBe(false);
      expect(result.securityViolations).toContain('Only administrators can delete stands');
    });

    it('should soft delete stands', async () => {
      // Admin context
      const adminContext = {
        ...testContext,
        role: 'admin',
        accessLevel: 'admin' as any,
      };

      const existingStand = {
        id: 'stand-1',
        code: 'A1',
        name: 'Alpha 1',
        organizationId: testContext.organizationId,
      };

      // Mock repository
      const mockRepository = {
        findById: jest.fn().mockResolvedValue(existingStand),
        softDelete: jest.fn().mockResolvedValue(undefined),
      };
      (service as any).repository = mockRepository;

      // Mock adjacency check
      mockPrisma.standAdjacency = {
        count: jest.fn().mockResolvedValue(2),
      } as any;
      mockPrisma.standMaintenanceRecord = {
        count: jest.fn().mockResolvedValue(5),
      } as any;

      const result = await service.deleteStand(adminContext, 'stand-1');

      expect(result.success).toBe(true);
      expect(result.recommendations).toContain('Stand has 2 adjacency relationships');
      expect(result.recommendations).toContain('Stand has 5 maintenance records');
      expect(mockRepository.softDelete).toHaveBeenCalledWith(
        'stand-1',
        adminContext.organizationId,
        adminContext.userId
      );
    });
  });

  describe('getStandById', () => {
    it('should return secured stand data with field masking', async () => {
      // Context with limited permissions
      const limitedContext = {
        ...testContext,
        permissions: ['capability_read'],
        accessLevel: 'read' as any,
      };

      const fullStand = {
        id: 'stand-1',
        code: 'A1',
        name: 'Alpha 1',
        organizationId: testContext.organizationId,
        operationalConstraints: {
          operatingHours: '0600-2200',
          securityRequirements: {
            level: 'high',
            protocols: ['TSA'],
          },
        },
      };

      // Mock repository
      const mockRepository = {
        findById: jest.fn().mockResolvedValue(fullStand),
      };
      (service as any).repository = mockRepository;

      const result = await service.getStandById(limitedContext, 'stand-1', true);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Check that sensitive fields are masked/removed based on permissions
      const capabilities = result.data?.capabilities;
      if (capabilities?.operationalConstraints) {
        // Security requirements should be masked for non-privileged users
        expect(capabilities.operationalConstraints.securityRequirements).toBeUndefined();
      }
    });

    it('should decrypt encrypted fields for authorized users', async () => {
      // Admin context
      const adminContext = {
        ...testContext,
        role: 'admin',
        accessLevel: 'admin' as any,
        permissions: ['capability_read', 'security_data_access'],
      };

      const encryptedStand = {
        id: 'stand-1',
        code: 'A1',
        name: 'Alpha 1',
        organizationId: testContext.organizationId,
        operationalConstraints: {
          securityRequirements: {
            encrypted: 'encrypted-data',
            iv: 'initialization-vector',
            tag: 'auth-tag',
          },
        },
      };

      // Mock repository
      const mockRepository = {
        findById: jest.fn().mockResolvedValue(encryptedStand),
      };
      (service as any).repository = mockRepository;

      // Mock decryption
      const mockEncryption = (service as any).encryptionService;
      mockEncryption.decryptObject = jest.fn().mockReturnValue({
        level: 'high',
        protocols: ['TSA'],
      });

      const result = await service.getStandById(adminContext, 'stand-1', true);

      expect(result.success).toBe(true);
      expect(result.data?.capabilities?.operationalConstraints?.securityRequirements).toEqual({
        level: 'high',
        protocols: ['TSA'],
      });
    });
  });

  describe('getSecurityStatistics', () => {
    it('should only allow admins to view security statistics', async () => {
      // Non-admin context
      const nonAdminContext = {
        ...testContext,
        role: 'user',
        accessLevel: 'write' as any,
      };

      await expect(service.getSecurityStatistics(nonAdminContext)).rejects.toThrow(
        'Insufficient permissions'
      );
    });

    it('should return comprehensive security statistics for admins', async () => {
      // Admin context
      const adminContext = {
        ...testContext,
        role: 'admin',
        accessLevel: 'admin' as any,
      };

      // Mock audit service statistics
      const mockAuditStats = {
        totalEvents: 1000,
        eventsByType: {
          [AuditEventType.CAPABILITY_CREATED]: 100,
          [AuditEventType.CAPABILITY_UPDATED]: 200,
        },
        successRate: 95.5,
      };

      const mockAuditService = (service as any).auditService;
      mockAuditService.getStatistics = jest.fn().mockResolvedValue(mockAuditStats);

      const stats = await service.getSecurityStatistics(
        adminContext,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats).toBeDefined();
      expect(stats.audit).toEqual(mockAuditStats);
      expect(mockAuditService.getStatistics).toHaveBeenCalledWith(
        adminContext.organizationId,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('audit trail', () => {
    it('should create comprehensive audit logs for all operations', async () => {
      const mockAuditService = (service as any).auditService;
      mockAuditService.logEvent = jest.fn().mockResolvedValue(undefined);
      mockAuditService.flushBuffer = jest.fn().mockResolvedValue(undefined);

      // Create operation
      const createRequest: CreateStandRequest = {
        code: 'B1',
        name: 'Bravo 1',
      };

      const mockRepository = {
        existsByCode: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue({
          id: 'stand-2',
          ...createRequest,
          organizationId: testContext.organizationId,
        }),
      };
      (service as any).repository = mockRepository;

      await service.createStand(testContext, createRequest);

      // Verify audit logs were created
      const auditCalls = mockAuditService.logEvent.mock.calls;

      // Should log RLS context setup
      expect(
        auditCalls.some(
          (call: any[]) => call[0].action === 'setup' && call[0].resource === 'session'
        )
      ).toBe(true);

      // Should log data preparation
      expect(auditCalls.some((call: any[]) => call[0].action === 'prepare_create_data')).toBe(true);

      // Should log successful creation
      expect(
        auditCalls.some(
          (call: any[]) =>
            call[0].eventType === AuditEventType.CAPABILITY_CREATED && call[0].success === true
        )
      ).toBe(true);
    });
  });

  afterEach(async () => {
    await service.destroy();
  });
});

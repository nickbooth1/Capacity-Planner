import request from 'supertest';
import express from 'express';
import { createEntitlementRoutes } from '../routes/entitlements';
import { ExtendedEntitlementService } from '@capacity-planner/entitlement-service';
import { ModuleKey, HTTP_STATUS } from '@capacity-planner/shared-kernel';

// Mock entitlement service
const mockEntitlementService: jest.Mocked<ExtendedEntitlementService> = {
  hasAccess: jest.fn(),
  grantAccess: jest.fn(),
  revokeAccess: jest.fn(),
  listEntitlements: jest.fn(),
  getEntitlement: jest.fn(),
  getAllEntitlements: jest.fn(),
  getAuditHistory: jest.fn(),
  disconnect: jest.fn(),
};

describe('Entitlement Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/entitlements', createEntitlementRoutes(mockEntitlementService));
  });

  describe('GET /organizations/:orgId/modules/:moduleKey/access', () => {
    it('should return access status for valid module', async () => {
      mockEntitlementService.hasAccess.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/entitlements/organizations/org1/modules/assets/access')
        .expect(HTTP_STATUS.OK);

      expect(response.body).toEqual({
        organizationId: 'org1',
        moduleKey: 'assets',
        hasAccess: true,
        timestamp: expect.any(String),
      });
      expect(mockEntitlementService.hasAccess).toHaveBeenCalledWith('org1', ModuleKey.ASSETS);
    });

    it('should return 400 for invalid module key', async () => {
      const response = await request(app)
        .get('/api/entitlements/organizations/org1/modules/invalid/access')
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.error).toBe('Invalid module key');
      expect(response.body.validModules).toEqual(Object.values(ModuleKey));
    });

    it('should handle service errors', async () => {
      mockEntitlementService.hasAccess.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/entitlements/organizations/org1/modules/assets/access')
        .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      expect(response.body.error).toBe('Failed to check access');
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /organizations/:orgId/entitlements', () => {
    it('should return all entitlements for organization', async () => {
      const mockEntitlements = [
        {
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
          status: 'active' as const,
          updatedBy: 'user1',
          updatedAt: new Date(),
        },
        {
          organizationId: 'org1',
          moduleKey: ModuleKey.WORK,
          status: 'suspended' as const,
          updatedBy: 'user2',
          updatedAt: new Date(),
        },
      ];
      mockEntitlementService.listEntitlements.mockResolvedValue(mockEntitlements);

      const response = await request(app)
        .get('/api/entitlements/organizations/org1/entitlements')
        .expect(HTTP_STATUS.OK);

      expect(response.body.organizationId).toBe('org1');
      expect(response.body.count).toBe(2);
      expect(response.body.entitlements).toHaveLength(2);
    });
  });

  describe('GET /organizations/:orgId/entitlements/:moduleKey', () => {
    it('should return specific entitlement', async () => {
      const mockEntitlement = {
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active' as const,
        updatedBy: 'user1',
        updatedAt: new Date(),
      };
      mockEntitlementService.getEntitlement.mockResolvedValue(mockEntitlement);

      const response = await request(app)
        .get('/api/entitlements/organizations/org1/entitlements/assets')
        .expect(HTTP_STATUS.OK);

      expect(response.body.organizationId).toBe('org1');
      expect(response.body.moduleKey).toBe(ModuleKey.ASSETS);
    });

    it('should return 404 if entitlement not found', async () => {
      mockEntitlementService.getEntitlement.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/entitlements/organizations/org1/entitlements/assets')
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.error).toBe('Entitlement not found');
    });
  });

  describe('POST /organizations/:orgId/entitlements/:moduleKey', () => {
    it('should grant access successfully', async () => {
      const mockEntitlement = {
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active' as const,
        updatedBy: 'user1',
        updatedAt: new Date(),
      };
      mockEntitlementService.grantAccess.mockResolvedValue(undefined);
      mockEntitlementService.getEntitlement.mockResolvedValue(mockEntitlement);

      const response = await request(app)
        .post('/api/entitlements/organizations/org1/entitlements/assets')
        .send({ userId: 'user1' })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.message).toBe('Access granted successfully');
      expect(response.body.entitlement).toBeDefined();
    });

    it('should grant access with validUntil date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      mockEntitlementService.grantAccess.mockResolvedValue(undefined);
      mockEntitlementService.getEntitlement.mockResolvedValue({
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active' as const,
        validUntil: futureDate,
        updatedBy: 'user1',
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/entitlements/organizations/org1/entitlements/assets')
        .send({
          userId: 'user1',
          validUntil: futureDate.toISOString(),
        })
        .expect(HTTP_STATUS.CREATED);

      expect(mockEntitlementService.grantAccess).toHaveBeenCalledWith(
        'org1',
        ModuleKey.ASSETS,
        expect.any(Date),
        'user1'
      );
    });

    it('should reject invalid validUntil date', async () => {
      const response = await request(app)
        .post('/api/entitlements/organizations/org1/entitlements/assets')
        .send({
          userId: 'user1',
          validUntil: 'invalid-date',
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.error).toBe('Invalid validUntil date format');
    });

    it('should reject past validUntil date', async () => {
      const pastDate = new Date('2020-01-01');

      const response = await request(app)
        .post('/api/entitlements/organizations/org1/entitlements/assets')
        .send({
          userId: 'user1',
          validUntil: pastDate.toISOString(),
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.error).toBe('validUntil must be in the future');
    });
  });

  describe('DELETE /organizations/:orgId/entitlements/:moduleKey', () => {
    it('should revoke access successfully', async () => {
      mockEntitlementService.revokeAccess.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/entitlements/organizations/org1/entitlements/assets')
        .send({ userId: 'user1' })
        .expect(HTTP_STATUS.OK);

      expect(response.body.message).toBe('Access revoked successfully');
      expect(mockEntitlementService.revokeAccess).toHaveBeenCalledWith(
        'org1',
        ModuleKey.ASSETS,
        'user1'
      );
    });
  });

  describe('GET /entitlements', () => {
    it('should return all entitlements', async () => {
      const mockEntitlements = [
        {
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
          status: 'active' as const,
          updatedBy: 'user1',
          updatedAt: new Date(),
        },
        {
          organizationId: 'org2',
          moduleKey: ModuleKey.WORK,
          status: 'active' as const,
          updatedBy: 'user2',
          updatedAt: new Date(),
        },
      ];
      mockEntitlementService.getAllEntitlements.mockResolvedValue(mockEntitlements);

      const response = await request(app)
        .get('/api/entitlements/entitlements')
        .expect(HTTP_STATUS.OK);

      expect(response.body.count).toBe(2);
      expect(response.body.entitlements).toHaveLength(2);
    });
  });

  describe('GET /organizations/:orgId/entitlements/audit', () => {
    it('should return audit history', async () => {
      const mockAudits = [
        {
          id: 'audit1',
          entitlementId: 'ent1',
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
          action: 'created',
          performedBy: 'user1',
          performedAt: new Date(),
        },
      ];
      mockEntitlementService.getAuditHistory.mockResolvedValue(mockAudits);

      const response = await request(app)
        .get('/api/entitlements/organizations/org1/entitlements/audit')
        .expect(HTTP_STATUS.OK);

      expect(response.body.organizationId).toBe('org1');
      expect(response.body.count).toBe(1);
      expect(response.body.auditHistory).toHaveLength(1);
    });

    it('should filter by module key', async () => {
      mockEntitlementService.getAuditHistory.mockResolvedValue([]);

      await request(app)
        .get('/api/entitlements/organizations/org1/entitlements/audit?moduleKey=assets&limit=20')
        .expect(HTTP_STATUS.OK);

      expect(mockEntitlementService.getAuditHistory).toHaveBeenCalledWith(
        'org1',
        ModuleKey.ASSETS,
        20
      );
    });
  });

  describe('POST /entitlements/batch-grant', () => {
    it('should process batch grants successfully', async () => {
      mockEntitlementService.grantAccess.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/entitlements/entitlements/batch-grant')
        .send({
          userId: 'admin',
          grants: [
            { organizationId: 'org1', moduleKey: 'assets' },
            { organizationId: 'org2', moduleKey: 'work' },
          ],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.summary.total).toBe(2);
      expect(response.body.summary.successful).toBe(2);
      expect(response.body.summary.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      mockEntitlementService.grantAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/entitlements/entitlements/batch-grant')
        .send({
          userId: 'admin',
          grants: [
            { organizationId: 'org1', moduleKey: 'assets' },
            { organizationId: 'org2', moduleKey: 'work' },
          ],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.summary.successful).toBe(1);
      expect(response.body.summary.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });

    it('should validate grants array', async () => {
      const response = await request(app)
        .post('/api/entitlements/entitlements/batch-grant')
        .send({
          userId: 'admin',
          grants: 'not-an-array',
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.error).toBe('grants must be an array');
    });

    it('should validate individual grants', async () => {
      const response = await request(app)
        .post('/api/entitlements/entitlements/batch-grant')
        .send({
          userId: 'admin',
          grants: [
            { organizationId: 'org1' }, // Missing moduleKey
            { moduleKey: 'assets' }, // Missing organizationId
            { organizationId: 'org3', moduleKey: 'invalid' }, // Invalid module
          ],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.summary.successful).toBe(0);
      expect(response.body.summary.failed).toBe(3);
      expect(response.body.errors).toHaveLength(3);
    });
  });
});

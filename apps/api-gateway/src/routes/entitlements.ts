import { Router, Request, Response } from 'express';
import { ExtendedEntitlementService } from '@capacity-planner/entitlement-service';
import { HTTP_STATUS, ModuleKey } from '@capacity-planner/shared-kernel';

export function createEntitlementRoutes(entitlementService: ExtendedEntitlementService): Router {
  const router = Router();

  // Middleware to validate module key
  const validateModuleKey = (req: Request, res: Response, next: Function) => {
    const { moduleKey } = req.params;
    if (!Object.values(ModuleKey).includes(moduleKey as ModuleKey)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid module key',
        validModules: Object.values(ModuleKey),
      });
    }
    next();
  };

  // Check if organization has access to a module
  router.get(
    '/organizations/:orgId/modules/:moduleKey/access',
    validateModuleKey,
    async (req: Request, res: Response) => {
      try {
        const { orgId, moduleKey } = req.params;
        const hasAccess = await entitlementService.hasAccess(orgId, moduleKey as ModuleKey);

        res.json({
          organizationId: orgId,
          moduleKey,
          hasAccess,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error checking access:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to check access',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get all entitlements for an organization
  router.get('/organizations/:orgId/entitlements', async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const entitlements = await entitlementService.listEntitlements(orgId);

      res.json({
        organizationId: orgId,
        entitlements,
        count: entitlements.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error listing entitlements:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to list entitlements',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get specific entitlement for an organization
  router.get(
    '/organizations/:orgId/entitlements/:moduleKey',
    validateModuleKey,
    async (req: Request, res: Response) => {
      try {
        const { orgId, moduleKey } = req.params;
        const entitlement = await entitlementService.getEntitlement(orgId, moduleKey as ModuleKey);

        if (!entitlement) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            error: 'Entitlement not found',
            organizationId: orgId,
            moduleKey,
          });
        }

        res.json(entitlement);
      } catch (error) {
        console.error('Error getting entitlement:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to get entitlement',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Grant access to a module
  router.post(
    '/organizations/:orgId/entitlements/:moduleKey',
    validateModuleKey,
    async (req: Request, res: Response) => {
      try {
        const { orgId, moduleKey } = req.params;
        const { validUntil, userId } = req.body;

        // Validate validUntil if provided
        let validUntilDate: Date | undefined;
        if (validUntil) {
          validUntilDate = new Date(validUntil);
          if (isNaN(validUntilDate.getTime())) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              error: 'Invalid validUntil date format',
            });
          }
          if (validUntilDate <= new Date()) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              error: 'validUntil must be in the future',
            });
          }
        }

        await entitlementService.grantAccess(orgId, moduleKey as ModuleKey, validUntilDate, userId);

        // Get the updated entitlement
        const entitlement = await entitlementService.getEntitlement(orgId, moduleKey as ModuleKey);

        res.status(HTTP_STATUS.CREATED).json({
          message: 'Access granted successfully',
          entitlement,
        });
      } catch (error) {
        console.error('Error granting access:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to grant access',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Revoke access to a module
  router.delete(
    '/organizations/:orgId/entitlements/:moduleKey',
    validateModuleKey,
    async (req: Request, res: Response) => {
      try {
        const { orgId, moduleKey } = req.params;
        const { userId } = req.body;

        await entitlementService.revokeAccess(orgId, moduleKey as ModuleKey, userId);

        res.json({
          message: 'Access revoked successfully',
          organizationId: orgId,
          moduleKey,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error revoking access:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to revoke access',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get all entitlements (admin endpoint)
  router.get('/entitlements', async (req: Request, res: Response) => {
    try {
      const entitlements = await entitlementService.getAllEntitlements();

      res.json({
        entitlements,
        count: entitlements.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting all entitlements:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to get all entitlements',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get audit history for an organization
  router.get('/organizations/:orgId/entitlements/audit', async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { moduleKey, limit } = req.query;

      const auditHistory = await entitlementService.getAuditHistory(
        orgId,
        moduleKey as ModuleKey | undefined,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        organizationId: orgId,
        moduleKey: moduleKey || 'all',
        auditHistory,
        count: auditHistory.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting audit history:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to get audit history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Batch grant access (admin endpoint)
  router.post('/entitlements/batch-grant', async (req: Request, res: Response) => {
    try {
      const { grants, userId } = req.body;

      if (!Array.isArray(grants)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'grants must be an array',
        });
      }

      const results = [];
      const errors = [];

      for (const grant of grants) {
        try {
          const { organizationId, moduleKey, validUntil } = grant;

          if (!organizationId || !moduleKey) {
            errors.push({
              grant,
              error: 'Missing organizationId or moduleKey',
            });
            continue;
          }

          if (!Object.values(ModuleKey).includes(moduleKey)) {
            errors.push({
              grant,
              error: 'Invalid module key',
            });
            continue;
          }

          let validUntilDate: Date | undefined;
          if (validUntil) {
            validUntilDate = new Date(validUntil);
            if (isNaN(validUntilDate.getTime())) {
              errors.push({
                grant,
                error: 'Invalid validUntil date format',
              });
              continue;
            }
          }

          await entitlementService.grantAccess(organizationId, moduleKey, validUntilDate, userId);
          results.push({
            organizationId,
            moduleKey,
            status: 'granted',
          });
        } catch (error) {
          errors.push({
            grant,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.json({
        results,
        errors,
        summary: {
          total: grants.length,
          successful: results.length,
          failed: errors.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error in batch grant:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to process batch grant',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

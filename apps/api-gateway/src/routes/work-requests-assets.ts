import { Router, Request, Response } from 'express';
import { HTTP_STATUS } from '@capacity-planner/shared-kernel';
import { StandIntegrationService, StandFiltersForWorkRequest } from '@capacity-planner/work-module';

const router = Router();
const standIntegrationService = new StandIntegrationService();

// Middleware to extract user context (mock for now)
const getUserContext = (req: Request) => {
  return {
    userId: (req.headers['x-user-id'] as string) || 'test-user-id',
    organizationId: (req.headers['x-organization-id'] as string) || 'test-org-id',
    userRole: (req.headers['x-user-role'] as string) || 'user',
  };
};

// ===== ASSETS INTEGRATION ENDPOINTS =====

// Get stands for work request selection
router.get('/stands', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);

    // Query parameters for stand filtering
    const filters: StandFiltersForWorkRequest = {
      search: req.query.search as string,
      terminal: req.query.terminal as string,
      status: req.query.status
        ? ((Array.isArray(req.query.status) ? req.query.status : [req.query.status]) as string[])
        : undefined,
      includeMaintenanceSchedule: req.query.includeMaintenanceSchedule === 'true',
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 50,
    };

    const result = await standIntegrationService.getStandsForWorkRequest(
      organizationId,
      filters,
      req.headers.authorization
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(result);
    }
  } catch (error) {
    console.error('Error fetching stands:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch stands',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get specific stand details for work request
router.get('/stands/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { id } = req.params;

    const result = await standIntegrationService.getStandDetailsForWorkRequest(
      id,
      organizationId,
      req.headers.authorization
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode =
        result.error === 'Stand not found'
          ? HTTP_STATUS.NOT_FOUND
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json(result);
    }
  } catch (error) {
    console.error('Error fetching stand details:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch stand details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Check stand availability for work request
router.get('/stands/:id/availability', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { id } = req.params;

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const granularity = (req.query.granularity as string) || 'hour';

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Start date and end date are required',
      });
    }

    const result = await standIntegrationService.checkStandAvailability(
      id,
      organizationId,
      startDate,
      endDate,
      granularity
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(result);
    }
  } catch (error) {
    console.error('Error checking stand availability:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to check stand availability',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

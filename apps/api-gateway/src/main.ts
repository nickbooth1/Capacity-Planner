import express from 'express';
import { MockEntitlementService } from '@capacity-planner/entitlement-service';
import { HTTP_STATUS } from '@capacity-planner/shared-kernel';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(express.json());

// Initialize services (mock for now)
const entitlementService = new MockEntitlementService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API root
app.get('/', (req, res) => {
  res.json({ 
    message: 'CapaCity Planner API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      assets: '/api/assets',
      work: '/api/work',
    }
  });
});

app.listen(port, host, () => {
  console.log(`🚀 API Gateway ready at http://${host}:${port}`);
});

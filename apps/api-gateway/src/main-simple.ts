import express from 'express';
import standsRouter from './routes/assets/stands-simple';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(express.json());

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-organization-id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Development logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount assets routes
app.use('/api/assets/stands', standsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API root
app.get('/', (req, res) => {
  res.json({
    message: 'CapaCity Planner API Gateway (Simple)',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      stands: '/api/assets/stands',
    },
  });
});

const server = app.listen(port, host, () => {
  console.log(`🚀 API Gateway (Simple) ready at http://${host}:${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Starting graceful shutdown...');

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

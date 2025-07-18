// Simple API startup script with minimal dependencies
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-organization-id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Simple stands endpoint
app.get('/api/assets/stands', async (req, res) => {
  try {
    const stands = await prisma.stand.findMany({
      where: {
        isDeleted: false,
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: stands,
      pagination: {
        page: 1,
        limit: 20,
        total: stands.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error('Error fetching stands:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CapaCity Planner API (Simple)',
    endpoints: {
      health: '/health',
      stands: '/api/assets/stands',
    },
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Simple API running at http://0.0.0.0:${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  prisma.$disconnect();
  process.exit(0);
});

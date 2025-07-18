const express = require('express');
const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-organization-id, X-User-Id');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Mock stands data
const mockStands = [
  {
    id: '1',
    code: 'A1',
    name: 'Stand A1',
    terminal: 'Terminal 1',
    status: 'operational',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    code: 'A2',
    name: 'Stand A2',
    terminal: 'Terminal 1',
    status: 'maintenance',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    code: 'B1',
    name: 'Stand B1',
    terminal: 'Terminal 2',
    status: 'operational',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Stands endpoints - handle both paths
const standsHandler = (req, res) => {
  console.log(`GET ${req.path}`);
  
  // Add required fields to mock stands
  const enrichedStands = mockStands.map(stand => ({
    ...stand,
    organizationId: 'default-org',
    version: 1,
    isDeleted: false,
    createdBy: 'system',
    updatedBy: 'system',
  }));
  
  res.json({
    success: true,
    data: {
      data: enrichedStands,
      meta: {
        total: enrichedStands.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
    },
  });
};

app.get('/api/assets/stands', standsHandler);
app.get('/api/stands', standsHandler);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Simple API running at http://0.0.0.0:3000');
});
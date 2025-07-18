const express = require('express');
const { PrismaClient } = require('./node_modules/.prisma/assets-module');
const { PrismaClient: SharedPrismaClient } = require('./node_modules/.prisma/shared-kernel');

const app = express();
const prisma = new PrismaClient();
const sharedPrisma = new SharedPrismaClient();

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

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Get Manchester organization ID
let manchesterOrgId = null;
let airportConfig = null;

async function getManchesterOrgId() {
  if (!manchesterOrgId) {
    const org = await sharedPrisma.organization.findFirst({
      where: { code: 'MAN' }
    });
    manchesterOrgId = org.id;
  }
  return manchesterOrgId;
}

// Get airport configuration
async function getAirportConfig() {
  if (!airportConfig) {
    const orgId = await getManchesterOrgId();
    airportConfig = await sharedPrisma.airportConfiguration.findUnique({
      where: { organizationId: orgId }
    });
  }
  return airportConfig;
}

// Validate terminal assignment
async function validateTerminal(terminal) {
  if (!terminal || terminal === 'Remote' || terminal === '') {
    return { valid: true, terminal: null };
  }

  const config = await getAirportConfig();
  if (!config) {
    // If no config, allow any terminal
    return { valid: true, terminal };
  }

  const terminals = config.terminals;
  const validTerminal = terminals.find(t => 
    t.code === terminal || 
    t.name === terminal ||
    t.code === `T${terminal}` // Allow "1" to match "T1"
  );

  if (!validTerminal) {
    return { 
      valid: false, 
      error: `Invalid terminal. Valid terminals are: ${terminals.map(t => t.code).join(', ')}`
    };
  }

  return { valid: true, terminal: validTerminal.code };
}

// Stands endpoint
const standsHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const { page = 1, pageSize = 50, search, status } = req.query;
    const offset = (page - 1) * pageSize;

    // Build where clause
    const where = {
      organizationId: orgId,
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Get stands with pagination
    const [stands, total] = await Promise.all([
      prisma.stand.findMany({
        where,
        skip: offset,
        take: parseInt(pageSize),
        orderBy: { code: 'asc' },
      }),
      prisma.stand.count({ where }),
    ]);

    // Format response to match frontend expectations
    res.json({
      success: true,
      data: {
        data: stands,
        meta: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stands:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Get single stand
const getStandHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const { id } = req.params;

    const stand = await prisma.stand.findFirst({
      where: {
        id,
        organizationId: orgId,
        isDeleted: false,
      },
    });

    if (!stand) {
      return res.status(404).json({
        success: false,
        error: 'Stand not found',
      });
    }

    res.json({
      success: true,
      data: stand,
    });
  } catch (error) {
    console.error('Error fetching stand:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Create stand
const createStandHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const userId = req.headers['x-user-id'] || 'system';
    
    // Validate terminal assignment
    const terminalValidation = await validateTerminal(req.body.terminal);
    if (!terminalValidation.valid) {
      return res.status(400).json({
        success: false,
        error: terminalValidation.error,
      });
    }
    
    const standData = {
      ...req.body,
      terminal: terminalValidation.terminal,
      organizationId: orgId,
      createdBy: userId,
      updatedBy: userId,
    };
    
    const stand = await prisma.stand.create({
      data: standData,
    });

    res.status(201).json({
      success: true,
      data: stand,
    });
  } catch (error) {
    console.error('Error creating stand:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Update stand
const updateStandHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'system';
    const { version, ...updateData } = req.body;

    // Check version for optimistic locking
    const currentStand = await prisma.stand.findFirst({
      where: { id, organizationId: orgId, isDeleted: false },
    });

    if (!currentStand) {
      return res.status(404).json({
        success: false,
        error: 'Stand not found',
      });
    }

    if (currentStand.version !== version) {
      return res.status(409).json({
        success: false,
        error: 'Stand has been modified by another user',
      });
    }

    // Validate terminal if being updated
    if ('terminal' in updateData) {
      const terminalValidation = await validateTerminal(updateData.terminal);
      if (!terminalValidation.valid) {
        return res.status(400).json({
          success: false,
          error: terminalValidation.error,
        });
      }
      updateData.terminal = terminalValidation.terminal;
    }

    const stand = await prisma.stand.update({
      where: { id },
      data: {
        ...updateData,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    res.json({
      success: true,
      data: stand,
    });
  } catch (error) {
    console.error('Error updating stand:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Delete stand (soft delete)
const deleteStandHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'system';

    const stand = await prisma.stand.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    res.json({
      success: true,
      message: 'Stand deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting stand:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Timeline data endpoint
const getStandTimelineHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const { id: standId } = req.params;
    const { start, end, granularity = 'hour' } = req.query;
    
    // Validate date range
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date range' 
      });
    }

    // Verify stand belongs to organization
    const stand = await prisma.stand.findFirst({
      where: {
        id: standId,
        organizationId: orgId,
        isDeleted: false
      }
    });

    if (!stand) {
      return res.status(404).json({
        success: false,
        error: 'Stand not found'
      });
    }

    // Get status history
    const statusHistory = await prisma.standStatusHistory.findMany({
      where: {
        standId,
        organizationId: orgId,
        changedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { changedAt: 'asc' }
    });

    // Get maintenance records
    const maintenanceRecords = await prisma.standMaintenanceRecord.findMany({
      where: {
        standId,
        organizationId: orgId,
        OR: [
          {
            scheduledStartTime: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            scheduledEndTime: {
              gte: startDate,
              lte: endDate
            }
          }
        ]
      },
      orderBy: { scheduledStartTime: 'asc' }
    });

    // Generate timeline data
    const timelineData = generateTimelineData(
      statusHistory,
      maintenanceRecords,
      startDate,
      endDate,
      granularity
    );

    res.json({
      success: true,
      data: {
        standId,
        dateRange: { start: startDate, end: endDate },
        granularity,
        statusHistory,
        maintenanceRecords,
        timelineData
      }
    });
  } catch (error) {
    console.error('Timeline API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Helper function to generate timeline data points
function generateTimelineData(statusHistory, maintenanceRecords, startDate, endDate, granularity) {
  const dataPoints = [];
  const interval = getIntervalFromGranularity(granularity);
  
  let currentTime = new Date(startDate);
  let currentStatus = 'operational'; // Default status
  
  // Sort all events by time
  const allEvents = [
    ...statusHistory.map(s => ({ ...s, type: 'status_change', time: s.changedAt })),
    ...maintenanceRecords.map(m => ({ ...m, type: 'maintenance_start', time: m.scheduledStartTime })),
    ...maintenanceRecords.map(m => ({ ...m, type: 'maintenance_end', time: m.scheduledEndTime }))
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  while (currentTime <= endDate) {
    // Update status based on events at this time
    const eventsAtTime = allEvents.filter(e => 
      new Date(e.time) <= currentTime && 
      new Date(e.time) > new Date(currentTime.getTime() - interval)
    );
    
    eventsAtTime.forEach(event => {
      if (event.type === 'status_change') {
        currentStatus = event.status;
      }
    });

    dataPoints.push({
      timestamp: new Date(currentTime),
      status: currentStatus,
      events: eventsAtTime
    });

    currentTime = new Date(currentTime.getTime() + interval);
  }

  return dataPoints;
}

function getIntervalFromGranularity(granularity) {
  const intervals = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000
  };
  return intervals[granularity] || intervals.hour;
}

// Get stand details with history
const getStandDetailsHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    const { id } = req.params;

    const stand = await prisma.stand.findFirst({
      where: {
        id,
        organizationId: orgId,
        isDeleted: false,
      },
      include: {
        maintenanceRecords: {
          orderBy: { scheduledStartTime: 'desc' },
          take: 10
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20
        }
      }
    });

    if (!stand) {
      return res.status(404).json({
        success: false,
        error: 'Stand not found',
      });
    }

    res.json({
      success: true,
      data: stand,
    });
  } catch (error) {
    console.error('Error fetching stand details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Get airport configuration
const getAirportConfigHandler = async (req, res) => {
  try {
    const config = await getAirportConfig();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Airport configuration not found',
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching airport configuration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Map endpoint handler
const getStandsMapHandler = async (req, res) => {
  try {
    const orgId = await getManchesterOrgId();
    
    // Fetch all stands with coordinates
    const stands = await prisma.stand.findMany({
      where: {
        organizationId: orgId,
        isDeleted: false,
        latitude: { not: null },
        longitude: { not: null }
      },
      select: {
        id: true,
        code: true,
        name: true,
        latitude: true,
        longitude: true,
        status: true,
        terminal: true,
        pier: true,
        capabilities: true,
        groundSupport: true
      }
    });

    if (stands.length === 0) {
      return res.json({
        stands: [],
        bounds: null,
        center: null,
        zoom: 14
      });
    }

    // Calculate bounds
    const lats = stands.map(s => s.latitude);
    const lngs = stands.map(s => s.longitude);
    
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };

    // Calculate appropriate zoom level
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Zoom calculation - adjust based on bounds size
    let zoom = 14;
    if (maxDiff > 0.1) zoom = 12;
    else if (maxDiff > 0.05) zoom = 13;
    else if (maxDiff < 0.01) zoom = 16;

    // Transform data for frontend
    const transformedStands = stands.map(stand => {
      // Extract capabilities from JSON
      const capabilities = stand.capabilities || {};
      const groundSupport = stand.groundSupport || {};
      
      return {
        id: stand.id,
        code: stand.code,
        name: stand.name,
        latitude: stand.latitude,
        longitude: stand.longitude,
        status: stand.status,
        terminal_code: stand.terminal || '',
        pier_code: stand.pier || '',
        aircraft_size_category: capabilities.aircraftSize || 'Medium',
        max_weight_kg: capabilities.maxWeight || 75000,
        power_supply: capabilities.hasPowerSupply ? ['400Hz'] : [],
        ground_support: groundSupport.power ? ['GPU'] : []
      };
    });

    res.json({
      stands: transformedStands,
      bounds,
      center,
      zoom
    });

  } catch (error) {
    console.error('Error fetching stands map data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Mount routes
app.get('/api/assets/stands', standsHandler);
app.get('/api/stands', standsHandler);
app.get('/api/stands/map', getStandsMapHandler);
app.get('/api/stands/:id', getStandHandler);
app.get('/api/stands/:id/timeline', getStandTimelineHandler);
app.get('/api/stands/:id/details', getStandDetailsHandler);
app.post('/api/stands', createStandHandler);
app.put('/api/stands/:id', updateStandHandler);
app.delete('/api/stands/:id', deleteStandHandler);
app.get('/api/airport-config', getAirportConfigHandler);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CapaCity Planner API (Database Connected)',
    endpoints: {
      health: '/health',
      stands: '/api/stands',
    },
  });
});

const port = process.env.PORT || 3001;

app.listen(port, async () => {
  console.log(`🚀 Database API running at http://localhost:${port}`);
  console.log('📊 Connected to PostgreSQL database');
  
  // Test database connection
  try {
    await getManchesterOrgId();
    console.log('✅ Manchester Airport organization found');
    const count = await prisma.stand.count();
    console.log(`📍 Found ${count} stands in database`);
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
const request = require('supertest');
const express = require('express');

// Mock Prisma clients
jest.mock('../../node_modules/.prisma/assets-module', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    stand: {
      findMany: jest.fn()
    }
  }))
}));

jest.mock('../../node_modules/.prisma/shared-kernel', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    organization: {
      findFirst: jest.fn()
    },
    airportConfiguration: {
      findUnique: jest.fn()
    }
  }))
}));

describe('GET /api/stands/map', () => {
  let app;
  let prisma;
  let sharedPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get fresh instance of the app
    delete require.cache[require.resolve('../../simple-db-api.js')];
    app = require('../../simple-db-api.js');
    
    // Get mocked Prisma instances
    const { PrismaClient: AssetsPrismaClient } = require('../../node_modules/.prisma/assets-module');
    const { PrismaClient: SharedPrismaClient } = require('../../node_modules/.prisma/shared-kernel');
    
    prisma = new AssetsPrismaClient();
    sharedPrisma = new SharedPrismaClient();
  });

  test('returns stands with coordinates and calculated bounds', async () => {
    const mockStands = [
      {
        id: '1',
        code: 'A1',
        name: 'Stand A1',
        latitude: 53.3498,
        longitude: -2.2744,
        status: 'operational',
        terminalCode: 'T1',
        pierCode: 'North',
        aircraftSizeCategory: 'Medium',
        maxWeightKg: 75000,
        powerSupply: ['400Hz', '28V DC'],
        groundSupport: ['GPU', 'ASU']
      },
      {
        id: '2',
        code: 'B2',
        name: 'Stand B2',
        latitude: 53.3500,
        longitude: -2.2746,
        status: 'maintenance',
        terminalCode: 'T2',
        pierCode: null,
        aircraftSizeCategory: 'Large',
        maxWeightKg: 150000,
        powerSupply: ['400Hz'],
        groundSupport: ['GPU']
      }
    ];

    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });
    prisma.stand.findMany.mockResolvedValue(mockStands);

    const response = await request(app)
      .get('/api/stands/map')
      .expect(200);

    expect(response.body).toHaveProperty('stands');
    expect(response.body).toHaveProperty('bounds');
    expect(response.body).toHaveProperty('center');
    expect(response.body).toHaveProperty('zoom');

    // Check stands transformation
    expect(response.body.stands).toHaveLength(2);
    expect(response.body.stands[0]).toEqual({
      id: '1',
      code: 'A1',
      name: 'Stand A1',
      latitude: 53.3498,
      longitude: -2.2744,
      status: 'operational',
      terminal_code: 'T1',
      pier_code: 'North',
      aircraft_size_category: 'Medium',
      max_weight_kg: 75000,
      power_supply: ['400Hz', '28V DC'],
      ground_support: ['GPU', 'ASU']
    });

    // Check bounds calculation
    expect(response.body.bounds).toEqual({
      north: 53.3500,
      south: 53.3498,
      east: -2.2744,
      west: -2.2746
    });

    // Check center calculation
    expect(response.body.center).toEqual({
      lat: 53.3499,
      lng: -2.2745
    });

    // Check zoom level
    expect(response.body.zoom).toBe(16); // Small area, high zoom
  });

  test('returns empty state when no stands have coordinates', async () => {
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });
    prisma.stand.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/stands/map')
      .expect(200);

    expect(response.body).toEqual({
      stands: [],
      bounds: null,
      center: null,
      zoom: 14
    });
  });

  test('filters out stands without coordinates', async () => {
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });
    
    // Prisma query should already filter these out
    prisma.stand.findMany.mockResolvedValue([
      {
        id: '1',
        code: 'A1',
        name: 'Stand A1',
        latitude: 53.3498,
        longitude: -2.2744,
        status: 'operational',
        terminalCode: 'T1',
        pierCode: null,
        aircraftSizeCategory: 'Medium',
        maxWeightKg: 75000,
        powerSupply: [],
        groundSupport: []
      }
    ]);

    const response = await request(app)
      .get('/api/stands/map')
      .expect(200);

    expect(response.body.stands).toHaveLength(1);
    
    // Verify Prisma was called with correct filters
    expect(prisma.stand.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'manchester-org-id',
        isDeleted: false,
        latitude: { not: null },
        longitude: { not: null }
      },
      select: expect.any(Object)
    });
  });

  test('calculates correct zoom level based on bounds', async () => {
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });

    // Test different bound sizes
    const testCases = [
      {
        stands: [
          { id: '1', latitude: 53.3498, longitude: -2.2744 },
          { id: '2', latitude: 53.3500, longitude: -2.2746 }
        ],
        expectedZoom: 16 // Very small area
      },
      {
        stands: [
          { id: '1', latitude: 53.3000, longitude: -2.2000 },
          { id: '2', latitude: 53.3600, longitude: -2.2800 }
        ],
        expectedZoom: 13 // Medium area
      },
      {
        stands: [
          { id: '1', latitude: 53.0000, longitude: -2.0000 },
          { id: '2', latitude: 53.5000, longitude: -2.5000 }
        ],
        expectedZoom: 12 // Large area
      }
    ];

    for (const testCase of testCases) {
      prisma.stand.findMany.mockResolvedValue(
        testCase.stands.map(s => ({
          ...s,
          code: 'TEST',
          name: 'Test Stand',
          status: 'operational',
          terminalCode: 'T1',
          pierCode: null,
          aircraftSizeCategory: 'Medium',
          maxWeightKg: 75000,
          powerSupply: [],
          groundSupport: []
        }))
      );

      const response = await request(app)
        .get('/api/stands/map')
        .expect(200);

      expect(response.body.zoom).toBe(testCase.expectedZoom);
    }
  });

  test('handles database errors gracefully', async () => {
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });
    prisma.stand.findMany.mockRejectedValue(new Error('Database connection failed'));

    const response = await request(app)
      .get('/api/stands/map')
      .expect(500);

    expect(response.body).toEqual({
      success: false,
      error: 'Database connection failed'
    });
  });

  test('transforms snake_case to camelCase in response', async () => {
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });
    prisma.stand.findMany.mockResolvedValue([
      {
        id: '1',
        code: 'A1',
        name: 'Stand A1',
        latitude: 53.3498,
        longitude: -2.2744,
        status: 'operational',
        terminalCode: 'T1',
        pierCode: 'North',
        aircraftSizeCategory: 'Medium',
        maxWeightKg: 75000,
        powerSupply: ['400Hz'],
        groundSupport: ['GPU']
      }
    ]);

    const response = await request(app)
      .get('/api/stands/map')
      .expect(200);

    const stand = response.body.stands[0];
    
    // Check camelCase transformation
    expect(stand).toHaveProperty('terminal_code');
    expect(stand).toHaveProperty('pier_code');
    expect(stand).toHaveProperty('aircraft_size_category');
    expect(stand).toHaveProperty('max_weight_kg');
    expect(stand).toHaveProperty('power_supply');
    expect(stand).toHaveProperty('ground_support');
    
    // Should not have snake_case versions
    expect(stand).not.toHaveProperty('terminalCode');
    expect(stand).not.toHaveProperty('pierCode');
  });

  test('respects organization isolation', async () => {
    const orgId = 'test-org-id';
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: orgId });
    prisma.stand.findMany.mockResolvedValue([]);

    await request(app)
      .get('/api/stands/map')
      .expect(200);

    // Verify organization ID was used in query
    expect(prisma.stand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: orgId
        })
      })
    );
  });

  test('includes all required fields in selection', async () => {
    sharedPrisma.organization.findFirst.mockResolvedValue({ id: 'manchester-org-id' });
    prisma.stand.findMany.mockResolvedValue([]);

    await request(app)
      .get('/api/stands/map')
      .expect(200);

    // Verify all fields are selected
    expect(prisma.stand.findMany).toHaveBeenCalledWith({
      where: expect.any(Object),
      select: {
        id: true,
        code: true,
        name: true,
        latitude: true,
        longitude: true,
        status: true,
        terminalCode: true,
        pierCode: true,
        aircraftSizeCategory: true,
        maxWeightKg: true,
        powerSupply: true,
        groundSupport: true
      }
    });
  });
});
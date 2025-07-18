import { StandImportService } from './stand-import.service';
import { PrismaClient } from '@prisma/client';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

// Mock dependencies
jest.mock('fs');
jest.mock('csv-parser');

const mockPrisma = {
  standImportJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  stand: {
    create: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient;

const mockValidationEngine = {
  validate: jest.fn(),
} as unknown as CapabilityValidationEngine;

describe('StandImportService', () => {
  let service: StandImportService;

  const organizationId = 'test-org-id';
  const userId = 'test-user-id';
  const jobId = 'test-job-id';
  const filename = 'stands.csv';
  const fileUrl = '/tmp/stands.csv';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StandImportService(mockPrisma, mockValidationEngine);
  });

  describe('startImport', () => {
    it('should create an import job and start processing', async () => {
      const mockJob = {
        id: jobId,
        organizationId,
        filename,
        fileUrl,
        status: 'pending',
        totalRows: 0,
        processedRows: 0,
        successRows: 0,
        errorRows: 0,
        errors: [],
        createdBy: userId,
        createdAt: new Date(),
      };

      mockPrisma.standImportJob.create.mockResolvedValue(mockJob);

      const result = await service.startImport(organizationId, filename, fileUrl, userId);

      expect(mockPrisma.standImportJob.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          filename,
          fileUrl,
          status: 'pending',
          createdBy: userId,
        },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('processImport', () => {
    const mockJob = {
      id: jobId,
      organizationId,
      filename,
      fileUrl,
      status: 'pending',
      totalRows: 0,
      processedRows: 0,
      successRows: 0,
      errorRows: 0,
      errors: [],
      createdBy: userId,
    };

    const mockCsvData = [
      {
        code: 'A1',
        name: 'Stand A1',
        terminal: 'Terminal 1',
        status: 'operational',
        length: '60',
        width: '30',
        maxWingspan: '65',
      },
      {
        code: 'A2',
        name: 'Stand A2',
        terminal: 'Terminal 1',
        status: 'operational',
        length: '55',
        width: '28',
        maxWingspan: '60',
      },
    ];

    it('should process CSV file successfully', async () => {
      // Mock file stream
      const mockStream = new Readable();
      mockStream.push('code,name,terminal\n');
      mockStream.push('A1,Stand A1,Terminal 1\n');
      mockStream.push('A2,Stand A2,Terminal 1\n');
      mockStream.push(null);

      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);

      // Mock CSV parser
      const mockCsvParser = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            mockCsvData.forEach((row) => callback(row));
          } else if (event === 'end') {
            callback();
          }
          return mockCsvParser;
        }),
      };
      (csv as unknown as jest.Mock).mockReturnValue(mockCsvParser);

      // Mock validation
      mockValidationEngine.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      // Mock stand creation
      mockPrisma.stand.findFirst.mockResolvedValue(null);
      mockPrisma.stand.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `stand-${data.code}`, ...data })
      );

      await (service as any).processImport(mockJob);

      expect(mockPrisma.standImportJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: 'processing',
          startedAt: expect.any(Date),
        },
      });

      expect(mockPrisma.standImportJob.update).toHaveBeenLastCalledWith({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          totalRows: 2,
          processedRows: 2,
          successRows: 2,
          errorRows: 0,
        },
      });
    });

    it('should handle validation errors during import', async () => {
      const mockStream = new Readable();
      mockStream.push('code,name\n');
      mockStream.push('A1,Stand A1\n');
      mockStream.push(null);

      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);

      const mockCsvParser = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback({ code: 'A1', name: 'Stand A1' });
          } else if (event === 'end') {
            callback();
          }
          return mockCsvParser;
        }),
      };
      (csv as unknown as jest.Mock).mockReturnValue(mockCsvParser);

      mockValidationEngine.validate.mockResolvedValue({
        isValid: false,
        errors: ['Missing required dimensions'],
        warnings: [],
      });

      await (service as any).processImport(mockJob);

      expect(mockPrisma.standImportJob.update).toHaveBeenLastCalledWith({
        where: { id: jobId },
        data: expect.objectContaining({
          status: 'completed',
          errorRows: 1,
          errors: expect.arrayContaining([
            expect.objectContaining({
              row: 1,
              code: 'A1',
              errors: ['Missing required dimensions'],
            }),
          ]),
        }),
      });
    });

    it('should handle file read errors', async () => {
      (fs.createReadStream as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      await (service as any).processImport(mockJob);

      expect(mockPrisma.standImportJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'File not found',
            }),
          ]),
        },
      });
    });
  });

  describe('getImportStatus', () => {
    it('should retrieve import job status', async () => {
      const mockJob = {
        id: jobId,
        status: 'processing',
        totalRows: 100,
        processedRows: 50,
        successRows: 45,
        errorRows: 5,
      };

      mockPrisma.standImportJob.findUnique.mockResolvedValue(mockJob);

      const result = await service.getImportStatus(jobId);

      expect(mockPrisma.standImportJob.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
      });
      expect(result).toEqual(mockJob);
    });

    it('should return null for non-existent job', async () => {
      mockPrisma.standImportJob.findUnique.mockResolvedValue(null);

      const result = await service.getImportStatus(jobId);

      expect(result).toBeNull();
    });
  });

  describe('getImportJobs', () => {
    it('should retrieve paginated import jobs', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'completed' },
        { id: 'job-2', status: 'processing' },
      ];

      mockPrisma.standImportJob.findMany.mockResolvedValue(mockJobs);
      mockPrisma.standImportJob.count = jest.fn().mockResolvedValue(2);

      const result = await service.getImportJobs(organizationId, 1, 10);

      expect(mockPrisma.standImportJob.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: mockJobs,
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
    });
  });

  describe('parseCSVRow', () => {
    it('should parse CSV row with all fields', () => {
      const row = {
        code: 'A1',
        name: 'Stand A1',
        terminal: 'Terminal 1',
        status: 'operational',
        length: '60',
        width: '30',
        height: '15',
        maxWingspan: '65',
        maxLength: '70',
        maxWeight: '560000',
        compatibleCategories: 'A,B,C,D',
        hasPowerSupply: 'true',
        hasGroundAir: 'false',
        hasFuelHydrant: 'true',
        latitude: '51.4700',
        longitude: '-0.4543',
      };

      const result = (service as any).parseCSVRow(row);

      expect(result).toEqual({
        code: 'A1',
        name: 'Stand A1',
        terminal: 'Terminal 1',
        status: 'operational',
        dimensions: {
          length: 60,
          width: 30,
          height: 15,
        },
        aircraftCompatibility: {
          maxWingspan: 65,
          maxLength: 70,
          maxWeight: 560000,
          compatibleCategories: ['A', 'B', 'C', 'D'],
        },
        groundSupport: {
          hasPowerSupply: true,
          hasGroundAir: false,
          hasFuelHydrant: true,
        },
        latitude: 51.47,
        longitude: -0.4543,
      });
    });

    it('should handle missing optional fields', () => {
      const row = {
        code: 'A1',
        name: 'Stand A1',
      };

      const result = (service as any).parseCSVRow(row);

      expect(result).toEqual({
        code: 'A1',
        name: 'Stand A1',
        dimensions: {},
        aircraftCompatibility: {},
        groundSupport: {},
      });
    });

    it('should handle invalid numeric values', () => {
      const row = {
        code: 'A1',
        name: 'Stand A1',
        length: 'invalid',
        width: '30',
      };

      const result = (service as any).parseCSVRow(row);

      expect(result.dimensions).toEqual({
        width: 30,
      });
    });
  });
});

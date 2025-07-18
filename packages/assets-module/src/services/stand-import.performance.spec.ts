import { StandImportService } from './stand-import.service';
import { PrismaClient } from '@prisma/client';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import * as fs from 'fs';
import { performance } from 'perf_hooks';

// Mock dependencies
const mockPrisma = {
  standImportJob: {
    create: jest.fn(),
    update: jest.fn(),
  },
  stand: {
    createMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient;

const mockValidationEngine = {
  validate: jest.fn(),
} as unknown as CapabilityValidationEngine;

describe('StandImportService Performance Tests', () => {
  let service: StandImportService;
  const organizationId = 'test-org-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StandImportService(mockPrisma, mockValidationEngine);

    // Mock validation to always pass
    mockValidationEngine.validate.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });

    // Mock database operations
    mockPrisma.stand.findFirst.mockResolvedValue(null);
    mockPrisma.stand.createMany.mockImplementation(({ data }) =>
      Promise.resolve({ count: data.length })
    );
  });

  describe('Bulk Import Performance', () => {
    const generateCSVData = (rows: number): string => {
      let csv = 'code,name,terminal,status,length,width,height,maxWingspan\n';
      for (let i = 1; i <= rows; i++) {
        csv += `PERF-${i},Performance Stand ${i},Terminal ${Math.ceil(i / 100)},operational,${60 + (i % 10)},${30 + (i % 5)},15,${65 + (i % 15)}\n`;
      }
      return csv;
    };

    test('should process 100 rows within 2 seconds', async () => {
      const csvData = generateCSVData(100);
      const startTime = performance.now();

      await (service as any).processCSVData(csvData, organizationId, userId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // 2 seconds
      expect(mockValidationEngine.validate).toHaveBeenCalledTimes(100);
    });

    test('should process 1000 rows within 10 seconds', async () => {
      const csvData = generateCSVData(1000);
      const startTime = performance.now();

      await (service as any).processCSVData(csvData, organizationId, userId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(mockValidationEngine.validate).toHaveBeenCalledTimes(1000);
    });

    test('should batch database operations efficiently', async () => {
      const csvData = generateCSVData(500);
      const batchSize = 100; // Expected batch size

      await (service as any).processCSVData(csvData, organizationId, userId);

      // Should batch inserts instead of individual creates
      expect(mockPrisma.stand.createMany).toHaveBeenCalledTimes(Math.ceil(500 / batchSize));
    });

    test('should handle validation efficiently with caching', async () => {
      // Mock validation with caching simulation
      const validationCache = new Map();
      mockValidationEngine.validate.mockImplementation(async (data) => {
        const key = JSON.stringify(data);
        if (validationCache.has(key)) {
          return validationCache.get(key);
        }
        const result = { isValid: true, errors: [], warnings: [] };
        validationCache.set(key, result);
        return result;
      });

      const csvData = generateCSVData(200);
      const startTime = performance.now();

      await (service as any).processCSVData(csvData, organizationId, userId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // Should be faster with caching
    });
  });

  describe('Memory Usage', () => {
    test('should not exceed memory limits for large imports', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process large dataset
      const csvData = generateCSVData(5000);
      await (service as any).processCSVData(csvData, organizationId, userId);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (less than 100MB for 5000 rows)
      expect(memoryIncrease).toBeLessThan(100);
    });

    test('should stream process large files without loading all into memory', async () => {
      const filename = '/tmp/large-test.csv';
      const csvData = generateCSVData(10000);

      // Mock file stream
      const mockStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate streaming chunks
            const lines = csvData.split('\n');
            for (let i = 1; i < lines.length; i += 100) {
              const chunk = lines.slice(i, i + 100).join('\n');
              callback(chunk);
            }
          } else if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      jest.spyOn(fs, 'createReadStream').mockReturnValue(mockStream as any);

      const startMemory = process.memoryUsage().heapUsed;
      await (service as any).processImportFile(filename, organizationId, userId);
      const endMemory = process.memoryUsage().heapUsed;

      const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB

      // Should use less memory with streaming
      expect(memoryUsed).toBeLessThan(50);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple concurrent imports efficiently', async () => {
      const imports = [];
      const importCount = 5;
      const rowsPerImport = 200;

      const startTime = performance.now();

      // Start multiple imports concurrently
      for (let i = 0; i < importCount; i++) {
        const csvData = generateCSVData(rowsPerImport);
        imports.push((service as any).processCSVData(csvData, `org-${i}`, `user-${i}`));
      }

      await Promise.all(imports);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete all imports within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 5 concurrent imports

      // Verify all imports were processed
      expect(mockValidationEngine.validate).toHaveBeenCalledTimes(importCount * rowsPerImport);
    });
  });

  describe('Error Recovery Performance', () => {
    test('should maintain performance with validation errors', async () => {
      // Mock 20% validation failures
      let callCount = 0;
      mockValidationEngine.validate.mockImplementation(async () => {
        callCount++;
        if (callCount % 5 === 0) {
          return { isValid: false, errors: ['Validation error'], warnings: [] };
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      const csvData = generateCSVData(500);
      const startTime = performance.now();

      const result = await (service as any).processCSVData(csvData, organizationId, userId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should still complete within 5 seconds
      expect(result.errorRows).toBeGreaterThan(0);
      expect(result.successRows).toBeGreaterThan(0);
    });

    test('should handle database errors without significant performance impact', async () => {
      // Mock occasional database errors
      let callCount = 0;
      mockPrisma.stand.createMany.mockImplementation(async ({ data }) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Database connection error');
        }
        return { count: data.length };
      });

      const csvData = generateCSVData(300);
      const startTime = performance.now();

      await (service as any).processCSVData(csvData, organizationId, userId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle errors and retry within reasonable time
      expect(duration).toBeLessThan(6000); // 6 seconds with retries
    });
  });

  describe('Optimization Strategies', () => {
    test('should use database transactions for batch operations', async () => {
      const csvData = generateCSVData(200);

      await (service as any).processCSVData(csvData, organizationId, userId);

      // Should use transactions for batch operations
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    test('should optimize duplicate checking with indexing', async () => {
      // Mock indexed lookups
      const codeIndex = new Set<string>();
      mockPrisma.stand.findFirst.mockImplementation(async ({ where }) => {
        if (codeIndex.has(where.code)) {
          return { id: 'existing', code: where.code };
        }
        return null;
      });

      const csvData = generateCSVData(1000);
      const startTime = performance.now();

      await (service as any).processCSVData(csvData, organizationId, userId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Indexed lookups should be fast
      expect(duration).toBeLessThan(5000);
    });
  });
});

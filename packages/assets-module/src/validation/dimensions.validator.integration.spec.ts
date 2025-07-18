import { DimensionsValidator } from './dimensions.validator';
import { StandDimensions, ICAOAircraftCategory } from '../types/stand-capabilities';

// This is an example integration test that would test with real external dependencies
// For now, it's a simple example to demonstrate the test separation

describe('DimensionsValidator Integration Tests', () => {
  let validator: DimensionsValidator;

  beforeEach(() => {
    validator = new DimensionsValidator();
  });

  describe('Performance Testing', () => {
    it('should validate 1000 stands in under 2 seconds', () => {
      const stands: StandDimensions[] = [];

      // Generate 1000 test stands
      for (let i = 0; i < 1000; i++) {
        stands.push({
          length: 40 + Math.random() * 60,
          width: 35 + Math.random() * 50,
          icaoCategory: Object.values(ICAOAircraftCategory)[i % 6] as ICAOAircraftCategory,
          clearances: {
            wingtipClearance: 3 + Math.random() * 5,
            taxilaneClearance: 12 + Math.random() * 25,
          },
          slope: {
            longitudinal: Math.random() * 2,
            transverse: Math.random() * 2,
          },
        });
      }

      const startTime = Date.now();
      const results = validator.validateBulk(stands);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.size).toBe(1000);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds

      // Log performance metrics
      console.log(`Validated 1000 stands in ${duration}ms (${duration / 1000}ms per stand)`);
    });
  });

  describe('Concurrent Validation', () => {
    it('should handle concurrent validation requests', async () => {
      const testStand: StandDimensions = {
        length: 60,
        width: 45,
        icaoCategory: ICAOAircraftCategory.C,
      };

      // Simulate concurrent validation requests
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(validator.validate(testStand))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach((result) => {
        expect(result.isValid).toBe(true);
      });
    });
  });
});

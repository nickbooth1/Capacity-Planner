import { PrismaClient } from '@prisma/client';
import { StandCapabilities, ICAOAircraftCategory } from '../../types';

export interface MigrationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ standCode: string; error: string }>;
}

export class CapabilityMigrationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Migrate legacy capabilities to new structure
   */
  async migrateLegacyCapabilities(
    organizationId: string,
    options: {
      batchSize?: number;
      dryRun?: boolean;
      onProgress?: (progress: MigrationProgress) => void;
    } = {}
  ): Promise<MigrationProgress> {
    const { batchSize = 50, dryRun = false, onProgress } = options;

    const progress: MigrationProgress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Count total stands to migrate
      const totalStands = await this.prisma.stand.count({
        where: {
          organizationId,
          capabilities: { not: {} },
          dimensions: null, // Not yet migrated
        },
      });

      progress.total = totalStands;

      // Process in batches
      let cursor: string | undefined;

      while (progress.processed < progress.total) {
        const stands = await this.prisma.stand.findMany({
          where: {
            organizationId,
            capabilities: { not: {} },
            dimensions: null,
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          take: batchSize,
          orderBy: { id: 'asc' },
        });

        if (stands.length === 0) break;

        for (const stand of stands) {
          try {
            const migratedCapabilities = this.mapLegacyCapabilities(stand.capabilities as any);

            if (!dryRun) {
              await this.prisma.$transaction(async (tx) => {
                // Update stand with new capabilities
                await tx.stand.update({
                  where: { id: stand.id },
                  data: {
                    dimensions: migratedCapabilities.dimensions || undefined,
                    aircraftCompatibility: migratedCapabilities.aircraftCompatibility || undefined,
                    groundSupport: migratedCapabilities.groundSupport || undefined,
                    operationalConstraints:
                      migratedCapabilities.operationalConstraints || undefined,
                    environmentalFeatures: migratedCapabilities.environmentalFeatures || undefined,
                    infrastructure: migratedCapabilities.infrastructure || undefined,
                  },
                });

                // Create snapshot for audit trail
                await tx.standCapabilitySnapshot.create({
                  data: {
                    standId: stand.id,
                    organizationId,
                    snapshotType: 'migration',
                    previousCapabilities: stand.capabilities as any,
                    newCapabilities: migratedCapabilities as any,
                    changedFields: Object.keys(migratedCapabilities),
                    reason: 'Legacy capability migration',
                  },
                });
              });
            }

            progress.successful++;
          } catch (error) {
            progress.failed++;
            progress.errors.push({
              standCode: stand.code,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          progress.processed++;
          if (onProgress) {
            onProgress(progress);
          }
        }

        cursor = stands[stands.length - 1].id;
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }

    return progress;
  }

  /**
   * Map legacy capabilities to new structure
   */
  private mapLegacyCapabilities(legacy: any): StandCapabilities {
    const capabilities: StandCapabilities = {};

    // Map dimensions
    if (legacy.dimensions || legacy.size) {
      capabilities.dimensions = {
        length: legacy.dimensions?.length || this.estimateLengthFromSize(legacy.size),
        width: legacy.dimensions?.width || this.estimateWidthFromSize(legacy.size),
        icaoCategory: this.mapAircraftSizeToICAO(legacy.aircraftSize),
      };
    }

    // Map aircraft compatibility
    if (legacy.aircraftSize || legacy.maxWeight) {
      capabilities.aircraftCompatibility = {
        maxWeight: legacy.maxWeight,
        compatibleCategories: this.getCompatibleCategories(legacy.aircraftSize),
        specificAircraft: legacy.compatibleAircraft || [],
      };

      // Estimate wingspan based on ICAO category
      if (capabilities.dimensions?.icaoCategory) {
        capabilities.aircraftCompatibility.maxWingspan = this.getMaxWingspanForCategory(
          capabilities.dimensions.icaoCategory
        );
      }
    }

    // Map ground support
    if (legacy.hasPowerSupply !== undefined || legacy.hasGroundSupport !== undefined) {
      capabilities.groundSupport = {
        hasPowerSupply: legacy.hasPowerSupply,
        powerSupplyType: legacy.powerType ? [legacy.powerType] : ['400Hz'],
        hasGroundAir: legacy.hasGroundAir,
        hasFuelHydrant: legacy.hasFuelHydrant,
        hasDeicing: legacy.hasDeicing,
        pushbackRequired: legacy.pushbackRequired ?? true,
      };
    }

    // Map infrastructure
    if (legacy.hasJetbridge !== undefined || legacy.infrastructure) {
      capabilities.infrastructure = {
        hasJetbridge: legacy.hasJetbridge,
        jetbridgeType: legacy.jetbridgeType || 'single',
        hasVDGS: legacy.hasVDGS,
        lightingType: ['LED'], // Default to LED
      };
    }

    return capabilities;
  }

  /**
   * Map legacy aircraft size to ICAO category
   */
  private mapAircraftSizeToICAO(aircraftSize?: string): ICAOAircraftCategory | undefined {
    if (!aircraftSize) return undefined;

    const mapping: Record<string, ICAOAircraftCategory> = {
      small: ICAOAircraftCategory.A,
      medium: ICAOAircraftCategory.C,
      large: ICAOAircraftCategory.D,
      'extra-large': ICAOAircraftCategory.E,
      jumbo: ICAOAircraftCategory.F,
    };

    return mapping[aircraftSize.toLowerCase()];
  }

  /**
   * Get compatible ICAO categories based on aircraft size
   */
  private getCompatibleCategories(aircraftSize?: string): ICAOAircraftCategory[] {
    if (!aircraftSize) return [];

    const category = this.mapAircraftSizeToICAO(aircraftSize);
    if (!category) return [];

    // Include all categories up to and including the mapped category
    const allCategories = Object.values(ICAOAircraftCategory);
    const categoryIndex = allCategories.indexOf(category);
    return allCategories.slice(0, categoryIndex + 1);
  }

  /**
   * Estimate stand length based on size category
   */
  private estimateLengthFromSize(size?: string): number {
    const sizeMap: Record<string, number> = {
      small: 35,
      medium: 50,
      large: 65,
      'extra-large': 75,
      jumbo: 85,
    };
    return sizeMap[size?.toLowerCase() || 'medium'] || 50;
  }

  /**
   * Estimate stand width based on size category
   */
  private estimateWidthFromSize(size?: string): number {
    const sizeMap: Record<string, number> = {
      small: 25,
      medium: 40,
      large: 50,
      'extra-large': 60,
      jumbo: 65,
    };
    return sizeMap[size?.toLowerCase() || 'medium'] || 40;
  }

  /**
   * Get maximum wingspan for ICAO category
   */
  private getMaxWingspanForCategory(category: ICAOAircraftCategory): number {
    const wingspanMap: Record<ICAOAircraftCategory, number> = {
      [ICAOAircraftCategory.A]: 15,
      [ICAOAircraftCategory.B]: 24,
      [ICAOAircraftCategory.C]: 36,
      [ICAOAircraftCategory.D]: 52,
      [ICAOAircraftCategory.E]: 65,
      [ICAOAircraftCategory.F]: 80,
    };
    return wingspanMap[category];
  }

  /**
   * Validate migration results
   */
  async validateMigration(organizationId: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check for stands with both old and new capabilities
    const standsWithBoth = await this.prisma.stand.count({
      where: {
        organizationId,
        capabilities: { not: {} },
        dimensions: { not: null },
      },
    });

    if (standsWithBoth > 0) {
      issues.push(`${standsWithBoth} stands have both legacy and new capabilities`);
    }

    // Check for stands without any capabilities
    const standsWithoutCapabilities = await this.prisma.stand.count({
      where: {
        organizationId,
        capabilities: {},
        dimensions: null,
      },
    });

    if (standsWithoutCapabilities > 0) {
      issues.push(`${standsWithoutCapabilities} stands have no capabilities`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

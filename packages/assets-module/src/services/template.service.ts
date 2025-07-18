import { PrismaClient, StandCapabilityTemplate } from '@prisma/client';
import { StandCapabilities, ICAOAircraftCategory } from '../types';
import { z } from 'zod';

export interface TemplateCreateRequest {
  name: string;
  description?: string;
  category: 'AIRCRAFT_SIZE' | 'GROUND_SUPPORT' | 'OPERATIONAL' | 'INFRASTRUCTURE' | 'CUSTOM';
  isDefault?: boolean;
  isActive?: boolean;
  applicableAircraftCategories?: ICAOAircraftCategory[];
  capabilities: Partial<StandCapabilities>;
  tags?: string[];
}

export interface TemplateUpdateRequest {
  name?: string;
  description?: string;
  category?: 'AIRCRAFT_SIZE' | 'GROUND_SUPPORT' | 'OPERATIONAL' | 'INFRASTRUCTURE' | 'CUSTOM';
  isDefault?: boolean;
  isActive?: boolean;
  applicableAircraftCategories?: ICAOAircraftCategory[];
  capabilities?: Partial<StandCapabilities>;
  tags?: string[];
}

export interface TemplateSearchFilters {
  category?: string;
  aircraftCategory?: ICAOAircraftCategory;
  tags?: string[];
  isActive?: boolean;
  isDefault?: boolean;
  limit?: number;
  offset?: number;
}

export interface TemplateApplicationRequest {
  templateId: string;
  standIds: string[];
  overrideMode: 'MERGE' | 'REPLACE' | 'ADDITIVE';
  conflictResolution: 'SKIP' | 'OVERWRITE' | 'PROMPT';
  previewOnly?: boolean;
}

export interface TemplateApplicationResult {
  templateId: string;
  totalStands: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    standId: string;
    standIdentifier: string;
    success: boolean;
    error?: string;
    conflicts?: Array<{
      field: string;
      templateValue: any;
      currentValue: any;
      resolution: 'SKIPPED' | 'OVERWRITTEN' | 'MERGED';
    }>;
    preview?: Partial<StandCapabilities>;
  }>;
}

export interface TemplateInheritanceChain {
  templateId: string;
  parentTemplateId?: string;
  children: TemplateInheritanceChain[];
  capabilities: Partial<StandCapabilities>;
  overrides: string[];
}

export class TemplateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new capability template
   */
  async createTemplate(
    organizationId: string,
    request: TemplateCreateRequest,
    userId: string
  ): Promise<StandCapabilityTemplate> {
    // Validate template capabilities
    await this.validateTemplateCapabilities(request.capabilities);

    // If setting as default, unset other defaults in the same category
    if (request.isDefault) {
      await this.prisma.standCapabilityTemplate.updateMany({
        where: {
          organizationId,
          category: request.category,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await this.prisma.standCapabilityTemplate.create({
      data: {
        organizationId,
        name: request.name,
        description: request.description,
        category: request.category,
        isDefault: request.isDefault || false,
        isActive: request.isActive !== false,
        applicableAircraftCategories: request.applicableAircraftCategories || [],
        capabilities: request.capabilities,
        tags: request.tags || [],
        version: 1,
        createdBy: userId,
      },
    });

    return template;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    organizationId: string,
    updates: TemplateUpdateRequest,
    userId: string
  ): Promise<StandCapabilityTemplate> {
    const template = await this.prisma.standCapabilityTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Validate updated capabilities if provided
    if (updates.capabilities) {
      await this.validateTemplateCapabilities(updates.capabilities);
    }

    // Handle default template logic
    if (updates.isDefault && updates.category) {
      await this.prisma.standCapabilityTemplate.updateMany({
        where: {
          organizationId,
          category: updates.category,
          isDefault: true,
          id: { not: templateId },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updatedTemplate = await this.prisma.standCapabilityTemplate.update({
      where: { id: templateId },
      data: {
        ...updates,
        version: template.version + 1,
        updatedBy: userId,
      },
    });

    return updatedTemplate;
  }

  /**
   * Get template by ID
   */
  async getTemplate(
    templateId: string,
    organizationId: string
  ): Promise<StandCapabilityTemplate | null> {
    return await this.prisma.standCapabilityTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });
  }

  /**
   * Search templates with filters
   */
  async searchTemplates(
    organizationId: string,
    filters: TemplateSearchFilters = {}
  ): Promise<{
    templates: StandCapabilityTemplate[];
    totalCount: number;
  }> {
    const {
      category,
      aircraftCategory,
      tags,
      isActive,
      isDefault,
      limit = 50,
      offset = 0,
    } = filters;

    const where: any = {
      organizationId,
    };

    if (category) {
      where.category = category;
    }

    if (aircraftCategory) {
      where.applicableAircraftCategories = {
        has: aircraftCategory,
      };
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isDefault !== undefined) {
      where.isDefault = isDefault;
    }

    const [templates, totalCount] = await Promise.all([
      this.prisma.standCapabilityTemplate.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.standCapabilityTemplate.count({ where }),
    ]);

    return {
      templates,
      totalCount,
    };
  }

  /**
   * Get default template for category
   */
  async getDefaultTemplate(
    organizationId: string,
    category: string
  ): Promise<StandCapabilityTemplate | null> {
    return await this.prisma.standCapabilityTemplate.findFirst({
      where: {
        organizationId,
        category,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Apply template to stands
   */
  async applyTemplate(
    organizationId: string,
    request: TemplateApplicationRequest,
    userId: string
  ): Promise<TemplateApplicationResult> {
    const template = await this.getTemplate(request.templateId, organizationId);
    if (!template) {
      throw new Error(`Template with ID ${request.templateId} not found`);
    }

    const stands = await this.prisma.stand.findMany({
      where: {
        id: { in: request.standIds },
        organizationId,
      },
      select: {
        id: true,
        identifier: true,
        capabilities: true,
      },
    });

    const results: TemplateApplicationResult['results'] = [];

    for (const stand of stands) {
      try {
        const result = await this.applyTemplateToStand(
          stand,
          template,
          request.overrideMode,
          request.conflictResolution,
          request.previewOnly || false,
          userId
        );

        results.push(result);
      } catch (error) {
        results.push({
          standId: stand.id,
          standIdentifier: stand.identifier,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const skipped = results.filter((r) =>
      r.conflicts?.some((c) => c.resolution === 'SKIPPED')
    ).length;

    return {
      templateId: request.templateId,
      totalStands: request.standIds.length,
      successful,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Create template inheritance chain
   */
  async createInheritanceChain(
    templateId: string,
    parentTemplateId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const [template, parentTemplate] = await Promise.all([
      this.getTemplate(templateId, organizationId),
      this.getTemplate(parentTemplateId, organizationId),
    ]);

    if (!template || !parentTemplate) {
      throw new Error('Template or parent template not found');
    }

    // Check for circular inheritance
    if (await this.hasCircularInheritance(templateId, parentTemplateId, organizationId)) {
      throw new Error('Circular inheritance detected');
    }

    await this.prisma.standCapabilityTemplate.update({
      where: { id: templateId },
      data: {
        parentTemplateId,
        updatedBy: userId,
      },
    });
  }

  /**
   * Get template inheritance chain
   */
  async getInheritanceChain(
    templateId: string,
    organizationId: string
  ): Promise<TemplateInheritanceChain> {
    const template = await this.prisma.standCapabilityTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    const children = await this.prisma.standCapabilityTemplate.findMany({
      where: {
        parentTemplateId: templateId,
        organizationId,
      },
    });

    const childChains = await Promise.all(
      children.map((child) => this.getInheritanceChain(child.id, organizationId))
    );

    return {
      templateId: template.id,
      parentTemplateId: template.parentTemplateId || undefined,
      children: childChains,
      capabilities: template.capabilities as Partial<StandCapabilities>,
      overrides: this.getOverriddenFields(template),
    };
  }

  /**
   * Get merged capabilities from inheritance chain
   */
  async getMergedCapabilities(
    templateId: string,
    organizationId: string
  ): Promise<Partial<StandCapabilities>> {
    const template = await this.getTemplate(templateId, organizationId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    let mergedCapabilities: Partial<StandCapabilities> = {};

    // If template has parent, get parent capabilities first
    if (template.parentTemplateId) {
      const parentCapabilities = await this.getMergedCapabilities(
        template.parentTemplateId,
        organizationId
      );
      mergedCapabilities = this.mergeCapabilities(mergedCapabilities, parentCapabilities);
    }

    // Apply current template capabilities
    const templateCapabilities = template.capabilities as Partial<StandCapabilities>;
    mergedCapabilities = this.mergeCapabilities(mergedCapabilities, templateCapabilities);

    return mergedCapabilities;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, organizationId: string): Promise<void> {
    const template = await this.getTemplate(templateId, organizationId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Check if template has children
    const childrenCount = await this.prisma.standCapabilityTemplate.count({
      where: {
        parentTemplateId: templateId,
        organizationId,
      },
    });

    if (childrenCount > 0) {
      throw new Error('Cannot delete template with child templates');
    }

    await this.prisma.standCapabilityTemplate.delete({
      where: { id: templateId },
    });
  }

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStatistics(
    templateId: string,
    organizationId: string
  ): Promise<{
    totalApplications: number;
    successfulApplications: number;
    failedApplications: number;
    lastUsed?: Date;
    topStands: Array<{
      standId: string;
      standIdentifier: string;
      applicationCount: number;
    }>;
  }> {
    // This would require tracking template applications in the database
    // For now, return placeholder data
    return {
      totalApplications: 0,
      successfulApplications: 0,
      failedApplications: 0,
      topStands: [],
    };
  }

  /**
   * Private helper methods
   */

  private async validateTemplateCapabilities(
    capabilities: Partial<StandCapabilities>
  ): Promise<void> {
    // Implement capability validation logic
    // This could use the existing validation engine
    if (capabilities.dimensions) {
      if (capabilities.dimensions.length && capabilities.dimensions.length <= 0) {
        throw new Error('Invalid dimensions: length must be positive');
      }
      if (capabilities.dimensions.width && capabilities.dimensions.width <= 0) {
        throw new Error('Invalid dimensions: width must be positive');
      }
    }
  }

  private async applyTemplateToStand(
    stand: any,
    template: StandCapabilityTemplate,
    overrideMode: 'MERGE' | 'REPLACE' | 'ADDITIVE',
    conflictResolution: 'SKIP' | 'OVERWRITE' | 'PROMPT',
    previewOnly: boolean,
    userId: string
  ): Promise<TemplateApplicationResult['results'][0]> {
    const currentCapabilities = (stand.capabilities as Partial<StandCapabilities>) || {};
    const templateCapabilities = template.capabilities as Partial<StandCapabilities>;

    // Get merged capabilities from inheritance chain
    const mergedTemplateCapabilities = await this.getMergedCapabilities(
      template.id,
      stand.organizationId
    );

    // Detect conflicts
    const conflicts = this.detectConflicts(currentCapabilities, mergedTemplateCapabilities);

    // Apply conflict resolution
    const resolvedCapabilities = this.resolveConflicts(
      currentCapabilities,
      mergedTemplateCapabilities,
      conflicts,
      overrideMode,
      conflictResolution
    );

    if (previewOnly) {
      return {
        standId: stand.id,
        standIdentifier: stand.identifier,
        success: true,
        conflicts,
        preview: resolvedCapabilities,
      };
    }

    // Apply to database
    await this.prisma.stand.update({
      where: { id: stand.id },
      data: {
        capabilities: resolvedCapabilities,
        // Could also create a snapshot here
      },
    });

    return {
      standId: stand.id,
      standIdentifier: stand.identifier,
      success: true,
      conflicts,
    };
  }

  private detectConflicts(
    current: Partial<StandCapabilities>,
    template: Partial<StandCapabilities>
  ): Array<{
    field: string;
    templateValue: any;
    currentValue: any;
    resolution: 'SKIPPED' | 'OVERWRITTEN' | 'MERGED';
  }> {
    const conflicts: Array<{
      field: string;
      templateValue: any;
      currentValue: any;
      resolution: 'SKIPPED' | 'OVERWRITTEN' | 'MERGED';
    }> = [];

    const checkConflicts = (obj1: any, obj2: any, prefix = '') => {
      for (const key in obj2) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (obj1[key] !== undefined && obj1[key] !== obj2[key]) {
          conflicts.push({
            field: fullKey,
            templateValue: obj2[key],
            currentValue: obj1[key],
            resolution: 'OVERWRITTEN', // Default resolution
          });
        } else if (typeof obj2[key] === 'object' && obj2[key] !== null) {
          checkConflicts(obj1[key] || {}, obj2[key], fullKey);
        }
      }
    };

    checkConflicts(current, template);
    return conflicts;
  }

  private resolveConflicts(
    current: Partial<StandCapabilities>,
    template: Partial<StandCapabilities>,
    conflicts: Array<{
      field: string;
      templateValue: any;
      currentValue: any;
      resolution: 'SKIPPED' | 'OVERWRITTEN' | 'MERGED';
    }>,
    overrideMode: 'MERGE' | 'REPLACE' | 'ADDITIVE',
    conflictResolution: 'SKIP' | 'OVERWRITE' | 'PROMPT'
  ): Partial<StandCapabilities> {
    switch (overrideMode) {
      case 'REPLACE':
        return template;
      case 'MERGE':
        return this.mergeCapabilities(current, template);
      case 'ADDITIVE':
        return this.additiveCapabilities(current, template);
      default:
        return current;
    }
  }

  private mergeCapabilities(
    base: Partial<StandCapabilities>,
    override: Partial<StandCapabilities>
  ): Partial<StandCapabilities> {
    const merged = { ...base };

    for (const key in override) {
      const value = override[key as keyof StandCapabilities];
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          merged[key as keyof StandCapabilities] = {
            ...merged[key as keyof StandCapabilities],
            ...value,
          } as any;
        } else {
          merged[key as keyof StandCapabilities] = value;
        }
      }
    }

    return merged;
  }

  private additiveCapabilities(
    base: Partial<StandCapabilities>,
    addition: Partial<StandCapabilities>
  ): Partial<StandCapabilities> {
    const result = { ...base };

    // Only add fields that don't exist in base
    for (const key in addition) {
      if (!(key in base)) {
        result[key as keyof StandCapabilities] = addition[key as keyof StandCapabilities];
      }
    }

    return result;
  }

  private async hasCircularInheritance(
    templateId: string,
    parentTemplateId: string,
    organizationId: string
  ): Promise<boolean> {
    const visited = new Set<string>();

    const checkCircular = async (currentId: string): Promise<boolean> => {
      if (visited.has(currentId)) {
        return true;
      }

      visited.add(currentId);

      const template = await this.getTemplate(currentId, organizationId);
      if (template?.parentTemplateId) {
        return await checkCircular(template.parentTemplateId);
      }

      return false;
    };

    return await checkCircular(parentTemplateId);
  }

  private getOverriddenFields(template: StandCapabilityTemplate): string[] {
    // This would compare with parent template to find overridden fields
    // For now, return empty array
    return [];
  }
}

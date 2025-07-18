import { PrismaClient, StandCapabilityTemplate } from '@prisma/client';
import { StandCapabilities } from '../types';

export interface TemplateQueryOptions {
  organizationId: string;
  category?: string;
  isActive?: boolean;
  isDefault?: boolean;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'category' | 'created' | 'updated';
  orderDirection?: 'asc' | 'desc';
}

export interface TemplateWithUsage extends StandCapabilityTemplate {
  usageCount?: number;
  lastUsed?: Date;
}

export class TemplateRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find template by ID
   */
  async findById(
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
   * Find templates with query options
   */
  async findMany(options: TemplateQueryOptions): Promise<{
    templates: StandCapabilityTemplate[];
    totalCount: number;
  }> {
    const {
      organizationId,
      category,
      isActive,
      isDefault,
      tags,
      search,
      limit = 50,
      offset = 0,
      orderBy = 'name',
      orderDirection = 'asc',
    } = options;

    const where: any = {
      organizationId,
    };

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isDefault !== undefined) {
      where.isDefault = isDefault;
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderByClause = this.buildOrderByClause(orderBy, orderDirection);

    const [templates, totalCount] = await Promise.all([
      this.prisma.standCapabilityTemplate.findMany({
        where,
        orderBy: orderByClause,
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
   * Create new template
   */
  async create(
    data: Omit<StandCapabilityTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StandCapabilityTemplate> {
    return await this.prisma.standCapabilityTemplate.create({
      data,
    });
  }

  /**
   * Update template
   */
  async update(
    templateId: string,
    organizationId: string,
    data: Partial<StandCapabilityTemplate>
  ): Promise<StandCapabilityTemplate> {
    return await this.prisma.standCapabilityTemplate.update({
      where: {
        id: templateId,
        organizationId,
      },
      data,
    });
  }

  /**
   * Delete template
   */
  async delete(templateId: string, organizationId: string): Promise<void> {
    await this.prisma.standCapabilityTemplate.delete({
      where: {
        id: templateId,
        organizationId,
      },
    });
  }

  /**
   * Find default template for category
   */
  async findDefaultByCategory(
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
   * Find templates by parent
   */
  async findByParent(
    parentTemplateId: string,
    organizationId: string
  ): Promise<StandCapabilityTemplate[]> {
    return await this.prisma.standCapabilityTemplate.findMany({
      where: {
        parentTemplateId,
        organizationId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Unset default templates in category
   */
  async unsetDefaultsInCategory(
    organizationId: string,
    category: string,
    excludeTemplateId?: string
  ): Promise<void> {
    const where: any = {
      organizationId,
      category,
      isDefault: true,
    };

    if (excludeTemplateId) {
      where.id = { not: excludeTemplateId };
    }

    await this.prisma.standCapabilityTemplate.updateMany({
      where,
      data: {
        isDefault: false,
      },
    });
  }

  /**
   * Get template statistics
   */
  async getStatistics(organizationId: string): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    defaultTemplates: number;
    byCategory: Record<string, number>;
    byAircraftCategory: Record<string, number>;
  }> {
    const [
      totalTemplates,
      activeTemplates,
      defaultTemplates,
      categoryStats,
      aircraftCategoryStats,
    ] = await Promise.all([
      this.prisma.standCapabilityTemplate.count({
        where: { organizationId },
      }),
      this.prisma.standCapabilityTemplate.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.standCapabilityTemplate.count({
        where: { organizationId, isDefault: true },
      }),
      this.prisma.standCapabilityTemplate.groupBy({
        by: ['category'],
        where: { organizationId },
        _count: { category: true },
      }),
      this.prisma.standCapabilityTemplate.findMany({
        where: { organizationId },
        select: { applicableAircraftCategories: true },
      }),
    ]);

    // Process category statistics
    const byCategory: Record<string, number> = {};
    categoryStats.forEach((stat) => {
      byCategory[stat.category] = stat._count.category;
    });

    // Process aircraft category statistics
    const byAircraftCategory: Record<string, number> = {};
    aircraftCategoryStats.forEach((template) => {
      const categories = template.applicableAircraftCategories as string[];
      categories.forEach((category) => {
        byAircraftCategory[category] = (byAircraftCategory[category] || 0) + 1;
      });
    });

    return {
      totalTemplates,
      activeTemplates,
      defaultTemplates,
      byCategory,
      byAircraftCategory,
    };
  }

  /**
   * Find templates with usage data
   */
  async findWithUsage(options: TemplateQueryOptions): Promise<{
    templates: TemplateWithUsage[];
    totalCount: number;
  }> {
    const baseResult = await this.findMany(options);

    // Add usage data (would require tracking table)
    const templatesWithUsage: TemplateWithUsage[] = baseResult.templates.map((template) => ({
      ...template,
      usageCount: 0, // Placeholder
      lastUsed: undefined, // Placeholder
    }));

    return {
      templates: templatesWithUsage,
      totalCount: baseResult.totalCount,
    };
  }

  /**
   * Bulk update templates
   */
  async bulkUpdate(
    templateIds: string[],
    organizationId: string,
    updates: Partial<StandCapabilityTemplate>
  ): Promise<{
    updated: number;
    failed: number;
    errors: Array<{
      templateId: string;
      error: string;
    }>;
  }> {
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as Array<{
        templateId: string;
        error: string;
      }>,
    };

    for (const templateId of templateIds) {
      try {
        await this.update(templateId, organizationId, updates);
        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          templateId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Check if template name exists
   */
  async nameExists(
    name: string,
    organizationId: string,
    excludeTemplateId?: string
  ): Promise<boolean> {
    const where: any = {
      name,
      organizationId,
    };

    if (excludeTemplateId) {
      where.id = { not: excludeTemplateId };
    }

    const count = await this.prisma.standCapabilityTemplate.count({
      where,
    });

    return count > 0;
  }

  /**
   * Find templates by capability type
   */
  async findByCapabilityType(
    organizationId: string,
    capabilityType: keyof StandCapabilities
  ): Promise<StandCapabilityTemplate[]> {
    // This would require JSON querying capabilities
    // For now, return all templates and filter in memory
    const templates = await this.prisma.standCapabilityTemplate.findMany({
      where: { organizationId },
    });

    return templates.filter((template) => {
      const capabilities = template.capabilities as Partial<StandCapabilities>;
      return capabilities[capabilityType] !== undefined;
    });
  }

  /**
   * Get template hierarchy
   */
  async getHierarchy(organizationId: string): Promise<
    Array<{
      template: StandCapabilityTemplate;
      children: StandCapabilityTemplate[];
      depth: number;
    }>
  > {
    const allTemplates = await this.prisma.standCapabilityTemplate.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });

    const hierarchy: Array<{
      template: StandCapabilityTemplate;
      children: StandCapabilityTemplate[];
      depth: number;
    }> = [];

    // Build hierarchy
    const templateMap = new Map(allTemplates.map((t) => [t.id, t]));
    const processed = new Set<string>();

    const buildHierarchy = (template: StandCapabilityTemplate, depth = 0) => {
      if (processed.has(template.id)) return;
      processed.add(template.id);

      const children = allTemplates.filter((t) => t.parentTemplateId === template.id);

      hierarchy.push({
        template,
        children,
        depth,
      });

      children.forEach((child) => buildHierarchy(child, depth + 1));
    };

    // Start with root templates (no parent)
    const rootTemplates = allTemplates.filter((t) => !t.parentTemplateId);
    rootTemplates.forEach((template) => buildHierarchy(template));

    return hierarchy;
  }

  /**
   * Private helper methods
   */
  private buildOrderByClause(orderBy: string, orderDirection: 'asc' | 'desc'): any {
    const orderByMap: Record<string, any> = {
      name: { name: orderDirection },
      category: { category: orderDirection },
      created: { createdAt: orderDirection },
      updated: { updatedAt: orderDirection },
    };

    return orderByMap[orderBy] || { name: 'asc' };
  }
}

import { TemplateService } from './template.service';
import { PrismaClient } from '@prisma/client';
import { StandCapabilities, ICAOAircraftCategory } from '../types';

// Mock PrismaClient
const mockPrisma = {
  standCapabilityTemplate: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  stand: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TemplateService', () => {
  let service: TemplateService;
  const organizationId = 'test-org-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TemplateService(mockPrisma);
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const templateRequest = {
        name: 'Test Template',
        description: 'Test description',
        category: 'AIRCRAFT_SIZE' as const,
        isDefault: false,
        isActive: true,
        applicableAircraftCategories: [ICAOAircraftCategory.C],
        capabilities: {
          dimensions: {
            length: 60,
            width: 45,
            icaoCategory: ICAOAircraftCategory.C,
          },
        },
        tags: ['test', 'template'],
      };

      const createdTemplate = {
        id: 'template-123',
        organizationId,
        ...templateRequest,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.create.mockResolvedValue(createdTemplate);

      const result = await service.createTemplate(organizationId, templateRequest, userId);

      expect(result).toEqual(createdTemplate);
      expect(mockPrisma.standCapabilityTemplate.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          ...templateRequest,
          version: 1,
          createdBy: userId,
        },
      });
    });

    it('should unset other defaults when creating default template', async () => {
      const templateRequest = {
        name: 'Default Template',
        category: 'AIRCRAFT_SIZE' as const,
        isDefault: true,
        capabilities: {},
      };

      const createdTemplate = {
        id: 'template-123',
        organizationId,
        ...templateRequest,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.standCapabilityTemplate.create.mockResolvedValue(createdTemplate);

      const result = await service.createTemplate(organizationId, templateRequest, userId);

      expect(mockPrisma.standCapabilityTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId,
          category: 'AIRCRAFT_SIZE',
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
      expect(result).toEqual(createdTemplate);
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const templateId = 'template-123';
      const currentTemplate = {
        id: templateId,
        organizationId,
        name: 'Current Template',
        category: 'AIRCRAFT_SIZE',
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      const updates = {
        name: 'Updated Template',
        description: 'Updated description',
      };

      const updatedTemplate = {
        ...currentTemplate,
        ...updates,
        version: 2,
        updatedBy: userId,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(currentTemplate);
      mockPrisma.standCapabilityTemplate.update.mockResolvedValue(updatedTemplate);

      const result = await service.updateTemplate(templateId, organizationId, updates, userId);

      expect(result).toEqual(updatedTemplate);
      expect(mockPrisma.standCapabilityTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: {
          ...updates,
          version: 2,
          updatedBy: userId,
        },
      });
    });

    it('should throw error if template not found', async () => {
      const templateId = 'non-existent-template';

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(null);

      await expect(service.updateTemplate(templateId, organizationId, {}, userId)).rejects.toThrow(
        `Template with ID ${templateId} not found`
      );
    });
  });

  describe('getTemplate', () => {
    it('should return template by ID', async () => {
      const templateId = 'template-123';
      const template = {
        id: templateId,
        organizationId,
        name: 'Test Template',
        category: 'AIRCRAFT_SIZE',
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(template);

      const result = await service.getTemplate(templateId, organizationId);

      expect(result).toEqual(template);
      expect(mockPrisma.standCapabilityTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          id: templateId,
          organizationId,
        },
      });
    });

    it('should return null if template not found', async () => {
      const templateId = 'non-existent-template';

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(null);

      const result = await service.getTemplate(templateId, organizationId);

      expect(result).toBeNull();
    });
  });

  describe('searchTemplates', () => {
    it('should search templates with filters', async () => {
      const templates = [
        {
          id: 'template-1',
          organizationId,
          name: 'Template 1',
          category: 'AIRCRAFT_SIZE',
          isDefault: true,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: null,
          parentTemplateId: null,
        },
        {
          id: 'template-2',
          organizationId,
          name: 'Template 2',
          category: 'GROUND_SUPPORT',
          isDefault: false,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: null,
          parentTemplateId: null,
        },
      ];

      mockPrisma.standCapabilityTemplate.findMany.mockResolvedValue(templates);
      mockPrisma.standCapabilityTemplate.count.mockResolvedValue(2);

      const result = await service.searchTemplates(organizationId, {
        category: 'AIRCRAFT_SIZE',
        isActive: true,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        templates,
        totalCount: 2,
      });
    });
  });

  describe('getDefaultTemplate', () => {
    it('should return default template for category', async () => {
      const defaultTemplate = {
        id: 'template-123',
        organizationId,
        name: 'Default Template',
        category: 'AIRCRAFT_SIZE',
        isDefault: true,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(defaultTemplate);

      const result = await service.getDefaultTemplate(organizationId, 'AIRCRAFT_SIZE');

      expect(result).toEqual(defaultTemplate);
      expect(mockPrisma.standCapabilityTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId,
          category: 'AIRCRAFT_SIZE',
          isDefault: true,
          isActive: true,
        },
      });
    });

    it('should return null if no default template found', async () => {
      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(null);

      const result = await service.getDefaultTemplate(organizationId, 'AIRCRAFT_SIZE');

      expect(result).toBeNull();
    });
  });

  describe('applyTemplate', () => {
    it('should apply template to stands', async () => {
      const templateId = 'template-123';
      const template = {
        id: templateId,
        organizationId,
        name: 'Test Template',
        category: 'AIRCRAFT_SIZE',
        capabilities: {
          dimensions: {
            length: 60,
            width: 45,
            icaoCategory: ICAOAircraftCategory.C,
          },
        },
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      const stands = [
        {
          id: 'stand-1',
          identifier: 'A01',
          capabilities: {
            dimensions: {
              length: 50,
              width: 40,
            },
          },
        },
        {
          id: 'stand-2',
          identifier: 'A02',
          capabilities: {},
        },
      ];

      const applicationRequest = {
        templateId,
        standIds: ['stand-1', 'stand-2'],
        overrideMode: 'MERGE' as const,
        conflictResolution: 'OVERWRITE' as const,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(template);
      mockPrisma.stand.findMany.mockResolvedValue(stands);
      mockPrisma.stand.update.mockResolvedValue({});

      const result = await service.applyTemplate(organizationId, applicationRequest, userId);

      expect(result.totalStands).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should handle template not found', async () => {
      const templateId = 'non-existent-template';

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.applyTemplate(
          organizationId,
          {
            templateId,
            standIds: ['stand-1'],
            overrideMode: 'MERGE',
            conflictResolution: 'OVERWRITE',
          },
          userId
        )
      ).rejects.toThrow(`Template with ID ${templateId} not found`);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const templateId = 'template-123';
      const template = {
        id: templateId,
        organizationId,
        name: 'Test Template',
        category: 'AIRCRAFT_SIZE',
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(template);
      mockPrisma.standCapabilityTemplate.count.mockResolvedValue(0);
      mockPrisma.standCapabilityTemplate.delete.mockResolvedValue(template);

      await service.deleteTemplate(templateId, organizationId);

      expect(mockPrisma.standCapabilityTemplate.delete).toHaveBeenCalledWith({
        where: { id: templateId },
      });
    });

    it('should throw error if template has children', async () => {
      const templateId = 'template-123';
      const template = {
        id: templateId,
        organizationId,
        name: 'Test Template',
        category: 'AIRCRAFT_SIZE',
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(template);
      mockPrisma.standCapabilityTemplate.count.mockResolvedValue(1);

      await expect(service.deleteTemplate(templateId, organizationId)).rejects.toThrow(
        'Cannot delete template with child templates'
      );
    });
  });

  describe('createInheritanceChain', () => {
    it('should create inheritance chain', async () => {
      const templateId = 'template-123';
      const parentTemplateId = 'parent-template-456';

      const template = {
        id: templateId,
        organizationId,
        name: 'Child Template',
        category: 'AIRCRAFT_SIZE',
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      const parentTemplate = {
        id: parentTemplateId,
        organizationId,
        name: 'Parent Template',
        category: 'AIRCRAFT_SIZE',
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst
        .mockResolvedValueOnce(template)
        .mockResolvedValueOnce(parentTemplate);
      mockPrisma.standCapabilityTemplate.update.mockResolvedValue({
        ...template,
        parentTemplateId,
      });

      await service.createInheritanceChain(templateId, parentTemplateId, organizationId, userId);

      expect(mockPrisma.standCapabilityTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: {
          parentTemplateId,
          updatedBy: userId,
        },
      });
    });
  });

  describe('getInheritanceChain', () => {
    it('should return inheritance chain', async () => {
      const templateId = 'template-123';
      const template = {
        id: templateId,
        organizationId,
        name: 'Test Template',
        category: 'AIRCRAFT_SIZE',
        capabilities: {
          dimensions: {
            length: 60,
            width: 45,
          },
        },
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(template);
      mockPrisma.standCapabilityTemplate.findMany.mockResolvedValue([]);

      const result = await service.getInheritanceChain(templateId, organizationId);

      expect(result).toEqual({
        templateId,
        parentTemplateId: undefined,
        children: [],
        capabilities: template.capabilities,
        overrides: [],
      });
    });
  });

  describe('getMergedCapabilities', () => {
    it('should merge capabilities from inheritance chain', async () => {
      const templateId = 'template-123';
      const template = {
        id: templateId,
        organizationId,
        name: 'Child Template',
        category: 'AIRCRAFT_SIZE',
        capabilities: {
          dimensions: {
            length: 60,
            width: 45,
          },
        },
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        parentTemplateId: null,
      };

      mockPrisma.standCapabilityTemplate.findFirst.mockResolvedValue(template);

      const result = await service.getMergedCapabilities(templateId, organizationId);

      expect(result).toEqual(template.capabilities);
    });
  });
});

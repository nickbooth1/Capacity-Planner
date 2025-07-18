import { PrismaClient } from '@prisma/client';
import {
  CreateWorkRequestRequest,
  ValidationResponse,
  ValidationResult,
  ValidationSeverity,
  WorkRequestStatus,
  Priority,
  Urgency,
  WorkType,
  AssetType,
  ImpactLevel,
  WorkCategory,
} from '../index';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: ValidationSeverity;
  category: 'required' | 'format' | 'business' | 'consistency' | 'security' | 'performance';
  condition: (data: any) => boolean;
  message: string;
  field?: string;
  dependencies?: string[];
  isActive: boolean;
}

export interface ValidationContext {
  organizationId: string;
  userId: string;
  workRequestId?: string;
  existingData?: any;
  assetInfo?: any;
  userInfo?: any;
  organizationSettings?: any;
}

export class ValidationEngineService {
  private rules: ValidationRule[] = [];

  constructor(private prisma: PrismaClient) {
    this.initializeValidationRules();
  }

  async validateWorkRequest(
    data: Partial<CreateWorkRequestRequest>,
    context: ValidationContext
  ): Promise<ValidationResponse> {
    const validationResults: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const suggestions: ValidationResult[] = [];

    // Enrich context with additional data
    const enrichedContext = await this.enrichValidationContext(context, data);

    // Run all validation rules
    for (const rule of this.rules) {
      if (!rule.isActive) continue;

      try {
        const ruleResult = await this.executeValidationRule(rule, data, enrichedContext);
        if (ruleResult) {
          switch (rule.severity) {
            case ValidationSeverity.ERROR:
              validationResults.push(ruleResult);
              break;
            case ValidationSeverity.WARNING:
              warnings.push(ruleResult);
              break;
            case ValidationSeverity.INFO:
              suggestions.push(ruleResult);
              break;
          }
        }
      } catch (error) {
        console.error(`Error executing validation rule ${rule.id}:`, error);
        validationResults.push({
          field: rule.field || 'general',
          message: `Validation error: ${rule.name}`,
          severity: ValidationSeverity.ERROR,
          code: `VALIDATION_ERROR_${rule.id.toUpperCase()}`,
        });
      }
    }

    // Run cross-field validations
    const crossFieldResults = await this.runCrossFieldValidations(data, enrichedContext);
    validationResults.push(...crossFieldResults.errors);
    warnings.push(...crossFieldResults.warnings);
    suggestions.push(...crossFieldResults.suggestions);

    // Run business rule validations
    const businessRuleResults = await this.runBusinessRuleValidations(data, enrichedContext);
    validationResults.push(...businessRuleResults.errors);
    warnings.push(...businessRuleResults.warnings);
    suggestions.push(...businessRuleResults.suggestions);

    const isValid = validationResults.length === 0;

    return {
      isValid,
      validationResults,
      warnings,
      suggestions,
      context: enrichedContext,
    };
  }

  async validateField(
    fieldName: string,
    value: any,
    context: ValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Get rules that apply to this field
    const fieldRules = this.rules.filter(
      (rule) => rule.field === fieldName || rule.dependencies?.includes(fieldName)
    );

    for (const rule of fieldRules) {
      if (!rule.isActive) continue;

      try {
        const ruleResult = await this.executeValidationRule(rule, { [fieldName]: value }, context);
        if (ruleResult) {
          results.push(ruleResult);
        }
      } catch (error) {
        console.error(`Error executing field validation rule ${rule.id}:`, error);
      }
    }

    return results;
  }

  private async executeValidationRule(
    rule: ValidationRule,
    data: any,
    context: ValidationContext
  ): Promise<ValidationResult | null> {
    const conditionMet = rule.condition(data);

    if (conditionMet) {
      return {
        field: rule.field || 'general',
        message: rule.message,
        severity: rule.severity,
        code: rule.id.toUpperCase(),
        category: rule.category,
      };
    }

    return null;
  }

  private async enrichValidationContext(
    context: ValidationContext,
    data: any
  ): Promise<ValidationContext> {
    const enriched = { ...context };

    // Get asset information if assetId is provided
    if (data.assetId && !enriched.assetInfo) {
      enriched.assetInfo = await this.getAssetInfo(data.assetId, data.assetType || AssetType.STAND);
    }

    // Get user information if not provided
    if (!enriched.userInfo) {
      enriched.userInfo = await this.getUserInfo(context.userId);
    }

    // Get organization settings if not provided
    if (!enriched.organizationSettings) {
      enriched.organizationSettings = await this.getOrganizationSettings(context.organizationId);
    }

    return enriched;
  }

  private async runCrossFieldValidations(
    data: any,
    context: ValidationContext
  ): Promise<{
    errors: ValidationResult[];
    warnings: ValidationResult[];
    suggestions: ValidationResult[];
  }> {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const suggestions: ValidationResult[] = [];

    // Date range validation
    if (data.requestedStartDate && data.requestedEndDate) {
      const startDate = new Date(data.requestedStartDate);
      const endDate = new Date(data.requestedEndDate);

      if (endDate <= startDate) {
        errors.push({
          field: 'requestedEndDate',
          message: 'End date must be after start date',
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_DATE_RANGE',
        });
      }

      // Check if date range is reasonable
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (durationHours > 168) {
        // More than 7 days
        warnings.push({
          field: 'requestedEndDate',
          message: 'Work request duration exceeds 7 days. Consider breaking into smaller tasks.',
          severity: ValidationSeverity.WARNING,
          code: 'LONG_DURATION_WARNING',
        });
      }
    }

    // Cost consistency validation
    if (data.estimatedTotalCost && data.estimatedMaterialsCost) {
      if (data.estimatedMaterialsCost > data.estimatedTotalCost) {
        errors.push({
          field: 'estimatedMaterialsCost',
          message: 'Materials cost cannot exceed total estimated cost',
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_COST_BREAKDOWN',
        });
      }
    }

    // Priority and urgency consistency
    if (data.priority && data.urgency) {
      const priorityUrgencyMatrix = {
        [Priority.CRITICAL]: [Urgency.IMMEDIATE, Urgency.SCHEDULED],
        [Priority.HIGH]: [Urgency.IMMEDIATE, Urgency.SCHEDULED],
        [Priority.MEDIUM]: [Urgency.SCHEDULED, Urgency.ROUTINE],
        [Priority.LOW]: [Urgency.ROUTINE],
      };

      const validUrgencies = priorityUrgencyMatrix[data.priority as Priority];
      if (validUrgencies && !validUrgencies.includes(data.urgency)) {
        errors.push({
          field: 'urgency',
          message: `${data.priority} priority requests cannot have ${data.urgency} urgency`,
          severity: ValidationSeverity.ERROR,
          code: 'INVALID_PRIORITY_URGENCY_COMBINATION',
        });
      }
    }

    // Work type and category consistency
    if (data.workType && data.category) {
      const workTypeCategoryMatrix = {
        [WorkType.EMERGENCY]: [WorkCategory.EMERGENCY],
        [WorkType.MAINTENANCE]: [
          WorkCategory.ROUTINE,
          WorkCategory.CORRECTIVE,
          WorkCategory.PREVENTIVE,
        ],
        [WorkType.INSPECTION]: [WorkCategory.ROUTINE, WorkCategory.PREVENTIVE],
        [WorkType.REPAIR]: [WorkCategory.CORRECTIVE, WorkCategory.EMERGENCY],
        [WorkType.MODIFICATION]: [WorkCategory.ROUTINE],
      };

      const validCategories = workTypeCategoryMatrix[data.workType as WorkType];
      if (validCategories && !validCategories.includes(data.category)) {
        warnings.push({
          field: 'category',
          message: `${data.workType} work typically uses different categories`,
          severity: ValidationSeverity.WARNING,
          code: 'UNUSUAL_WORK_TYPE_CATEGORY_COMBINATION',
        });
      }
    }

    return { errors, warnings, suggestions };
  }

  private async runBusinessRuleValidations(
    data: any,
    context: ValidationContext
  ): Promise<{
    errors: ValidationResult[];
    warnings: ValidationResult[];
    suggestions: ValidationResult[];
  }> {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const suggestions: ValidationResult[] = [];

    // Asset availability validation
    if (data.assetId && data.requestedStartDate && data.requestedEndDate) {
      const conflicts = await this.checkAssetAvailability(
        data.assetId,
        data.requestedStartDate,
        data.requestedEndDate,
        context.workRequestId
      );

      if (conflicts.length > 0) {
        errors.push({
          field: 'requestedStartDate',
          message: `Asset is not available during requested time period. Conflicts: ${conflicts.join(', ')}`,
          severity: ValidationSeverity.ERROR,
          code: 'ASSET_UNAVAILABLE',
        });
      }
    }

    // Budget validation
    if (data.budgetCode && data.estimatedTotalCost) {
      const budgetAvailable = await this.checkBudgetAvailability(
        data.budgetCode,
        data.estimatedTotalCost,
        context.organizationId
      );

      if (!budgetAvailable.isAvailable) {
        if (budgetAvailable.requiresApproval) {
          warnings.push({
            field: 'estimatedTotalCost',
            message: 'Estimated cost exceeds budget threshold and will require additional approval',
            severity: ValidationSeverity.WARNING,
            code: 'BUDGET_THRESHOLD_EXCEEDED',
          });
        } else {
          errors.push({
            field: 'estimatedTotalCost',
            message: 'Insufficient budget available for this request',
            severity: ValidationSeverity.ERROR,
            code: 'INSUFFICIENT_BUDGET',
          });
        }
      }
    }

    // Regulatory compliance validation
    if (data.workType && data.assetId) {
      const regulatoryRequirements = await this.checkRegulatoryRequirements(
        data.workType,
        data.assetId,
        context.organizationId
      );

      if (regulatoryRequirements.approvalRequired && !data.regulatoryApprovalRequired) {
        warnings.push({
          field: 'regulatoryApprovalRequired',
          message: 'This type of work typically requires regulatory approval',
          severity: ValidationSeverity.WARNING,
          code: 'REGULATORY_APPROVAL_RECOMMENDED',
        });
      }
    }

    // Seasonal constraints validation
    if (data.requestedStartDate && data.assetId) {
      const seasonalConstraints = await this.checkSeasonalConstraints(
        data.assetId,
        data.requestedStartDate,
        context.organizationId
      );

      if (seasonalConstraints.hasConstraints) {
        warnings.push({
          field: 'requestedStartDate',
          message: `Seasonal constraints may affect this work: ${seasonalConstraints.message}`,
          severity: ValidationSeverity.WARNING,
          code: 'SEASONAL_CONSTRAINTS',
        });
      }
    }

    // Workload capacity validation
    if (data.requestedStartDate && data.estimatedDurationMinutes) {
      const capacityCheck = await this.checkWorkloadCapacity(
        data.requestedStartDate,
        data.estimatedDurationMinutes,
        context.organizationId
      );

      if (!capacityCheck.hasCapacity) {
        warnings.push({
          field: 'requestedStartDate',
          message: 'High workload during requested period may cause delays',
          severity: ValidationSeverity.WARNING,
          code: 'HIGH_WORKLOAD_PERIOD',
        });
      }
    }

    return { errors, warnings, suggestions };
  }

  private async checkAssetAvailability(
    assetId: string,
    startDate: string,
    endDate: string,
    excludeWorkRequestId?: string
  ): Promise<string[]> {
    const conflicts: string[] = [];

    // Check for conflicting work requests
    const conflictingRequests = await this.prisma.workRequest.findMany({
      where: {
        assetId,
        status: {
          in: [WorkRequestStatus.APPROVED, WorkRequestStatus.IN_PROGRESS],
        },
        ...(excludeWorkRequestId && { id: { not: excludeWorkRequestId } }),
        OR: [
          {
            AND: [
              { requestedStartDate: { lte: new Date(startDate) } },
              { requestedEndDate: { gte: new Date(startDate) } },
            ],
          },
          {
            AND: [
              { requestedStartDate: { lte: new Date(endDate) } },
              { requestedEndDate: { gte: new Date(endDate) } },
            ],
          },
          {
            AND: [
              { requestedStartDate: { gte: new Date(startDate) } },
              { requestedEndDate: { lte: new Date(endDate) } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        requestedStartDate: true,
        requestedEndDate: true,
      },
    });

    conflicts.push(...conflictingRequests.map((req) => `Work Request: ${req.title}`));

    return conflicts;
  }

  private async checkBudgetAvailability(
    budgetCode: string,
    estimatedCost: number,
    organizationId: string
  ): Promise<{ isAvailable: boolean; requiresApproval: boolean; availableAmount?: number }> {
    // This would typically check against a budget management system
    // For now, return mock data
    return {
      isAvailable: true,
      requiresApproval: estimatedCost > 10000,
      availableAmount: 50000,
    };
  }

  private async checkRegulatoryRequirements(
    workType: string,
    assetId: string,
    organizationId: string
  ): Promise<{ approvalRequired: boolean; requirements: string[] }> {
    // This would check against regulatory compliance rules
    // For now, return mock data
    const highRiskWorkTypes = [WorkType.MODIFICATION, WorkType.EMERGENCY];

    return {
      approvalRequired: highRiskWorkTypes.includes(workType as WorkType),
      requirements: highRiskWorkTypes.includes(workType as WorkType)
        ? ['Safety assessment', 'Environmental impact review']
        : [],
    };
  }

  private async checkSeasonalConstraints(
    assetId: string,
    requestedDate: string,
    organizationId: string
  ): Promise<{ hasConstraints: boolean; message: string }> {
    // This would check against seasonal operational constraints
    // For now, return mock data based on date
    const date = new Date(requestedDate);
    const month = date.getMonth();

    // Example: Winter months (Dec, Jan, Feb) have weather constraints
    if ([11, 0, 1].includes(month)) {
      return {
        hasConstraints: true,
        message: 'Winter weather may affect outdoor work',
      };
    }

    return {
      hasConstraints: false,
      message: '',
    };
  }

  private async checkWorkloadCapacity(
    requestedDate: string,
    durationMinutes: number,
    organizationId: string
  ): Promise<{ hasCapacity: boolean; utilizationPercentage: number }> {
    // This would check against resource scheduling system
    // For now, return mock data
    const date = new Date(requestedDate);
    const dayOfWeek = date.getDay();

    // Example: Weekends have lower capacity
    const baseCapacity = [0, 6].includes(dayOfWeek) ? 50 : 100; // Weekend vs weekday

    return {
      hasCapacity: baseCapacity > 80,
      utilizationPercentage: Math.min(baseCapacity + durationMinutes / 60, 100),
    };
  }

  private async getAssetInfo(assetId: string, assetType: AssetType): Promise<any> {
    // This would fetch from Assets Module
    return {
      id: assetId,
      code: 'A01',
      name: 'Stand A01',
      type: assetType,
      status: 'operational',
      capabilities: {},
      constraints: {},
    };
  }

  private async getUserInfo(userId: string): Promise<any> {
    // This would fetch from User Management system
    return {
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      role: 'maintenance_planner',
      permissions: ['work_request.create', 'work_request.read'],
      department: 'Maintenance',
    };
  }

  private async getOrganizationSettings(organizationId: string): Promise<any> {
    // This would fetch organization-specific settings
    return {
      id: organizationId,
      name: 'Test Organization',
      workRequestSettings: {
        maxDurationHours: 168,
        requireApprovalThreshold: 10000,
        allowWeekendWork: true,
        mandatoryFields: ['title', 'description', 'requestedStartDate'],
      },
    };
  }

  private initializeValidationRules(): void {
    // Required field validations
    this.rules.push({
      id: 'required_title',
      name: 'Title Required',
      description: 'Work request title is required',
      severity: ValidationSeverity.ERROR,
      category: 'required',
      condition: (data) => !data.title || data.title.trim().length === 0,
      message: 'Title is required',
      field: 'title',
      isActive: true,
    });

    this.rules.push({
      id: 'required_description',
      name: 'Description Required',
      description: 'Work request description is required',
      severity: ValidationSeverity.ERROR,
      category: 'required',
      condition: (data) => !data.description || data.description.trim().length === 0,
      message: 'Description is required',
      field: 'description',
      isActive: true,
    });

    this.rules.push({
      id: 'required_asset_id',
      name: 'Asset ID Required',
      description: 'Asset ID is required',
      severity: ValidationSeverity.ERROR,
      category: 'required',
      condition: (data) => !data.assetId || data.assetId.trim().length === 0,
      message: 'Please select an asset',
      field: 'assetId',
      isActive: true,
    });

    // Format validations
    this.rules.push({
      id: 'title_length',
      name: 'Title Length',
      description: 'Title must be between 5 and 200 characters',
      severity: ValidationSeverity.ERROR,
      category: 'format',
      condition: (data) => data.title && (data.title.length < 5 || data.title.length > 200),
      message: 'Title must be between 5 and 200 characters',
      field: 'title',
      isActive: true,
    });

    this.rules.push({
      id: 'description_length',
      name: 'Description Length',
      description: 'Description must be between 20 and 5000 characters',
      severity: ValidationSeverity.ERROR,
      category: 'format',
      condition: (data) =>
        data.description && (data.description.length < 20 || data.description.length > 5000),
      message: 'Description must be between 20 and 5000 characters',
      field: 'description',
      isActive: true,
    });

    // Date validations
    this.rules.push({
      id: 'future_start_date',
      name: 'Future Start Date',
      description: 'Start date must be in the future',
      severity: ValidationSeverity.ERROR,
      category: 'business',
      condition: (data) =>
        data.requestedStartDate && new Date(data.requestedStartDate) <= new Date(),
      message: 'Start date must be in the future',
      field: 'requestedStartDate',
      isActive: true,
    });

    // Cost validations
    this.rules.push({
      id: 'positive_cost',
      name: 'Positive Cost',
      description: 'Costs must be positive values',
      severity: ValidationSeverity.ERROR,
      category: 'format',
      condition: (data) =>
        (data.estimatedTotalCost && data.estimatedTotalCost < 0) ||
        (data.estimatedMaterialsCost && data.estimatedMaterialsCost < 0),
      message: 'Costs must be positive values',
      field: 'estimatedTotalCost',
      isActive: true,
    });

    // Business rule validations
    this.rules.push({
      id: 'emergency_immediate_urgency',
      name: 'Emergency Work Urgency',
      description: 'Emergency work should have immediate urgency',
      severity: ValidationSeverity.WARNING,
      category: 'business',
      condition: (data) =>
        data.workType === WorkType.EMERGENCY && data.urgency !== Urgency.IMMEDIATE,
      message: 'Emergency work should typically have immediate urgency',
      field: 'urgency',
      isActive: true,
    });

    this.rules.push({
      id: 'high_cost_justification',
      name: 'High Cost Justification',
      description: 'High cost requests should have detailed justification',
      severity: ValidationSeverity.WARNING,
      category: 'business',
      condition: (data) =>
        data.estimatedTotalCost &&
        data.estimatedTotalCost > 25000 &&
        data.description &&
        data.description.length < 100,
      message: 'High cost requests should include detailed justification in description',
      field: 'description',
      isActive: true,
    });

    // Security validations
    this.rules.push({
      id: 'budget_code_format',
      name: 'Budget Code Format',
      description: 'Budget code must follow organization format',
      severity: ValidationSeverity.ERROR,
      category: 'format',
      condition: (data) => data.budgetCode && !/^[A-Z0-9-]+$/.test(data.budgetCode),
      message: 'Budget code must contain only uppercase letters, numbers, and hyphens',
      field: 'budgetCode',
      isActive: true,
    });

    // Performance validations
    this.rules.push({
      id: 'reasonable_duration',
      name: 'Reasonable Duration',
      description: 'Work duration should be reasonable',
      severity: ValidationSeverity.WARNING,
      category: 'performance',
      condition: (data) => data.estimatedDurationMinutes && data.estimatedDurationMinutes > 10080, // 7 days
      message: 'Work duration exceeds 7 days. Consider breaking into smaller tasks.',
      field: 'estimatedDurationMinutes',
      isActive: true,
    });
  }
}

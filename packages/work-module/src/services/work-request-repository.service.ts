import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import {
  WorkRequest,
  WorkRequestSummary,
  WorkRequestFilters,
  PaginationInfo,
  WorkRequestStatus,
  Priority,
  Urgency,
  WorkType,
  AssetType,
} from '../index';

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface BulkOperationResult {
  success: boolean;
  totalCount: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ id: string; error: string }>;
}

export interface DashboardStats {
  totalRequests: number;
  byStatus: Record<WorkRequestStatus, number>;
  byPriority: Record<Priority, number>;
  byWorkType: Record<WorkType, number>;
  byAssetType: Record<AssetType, number>;
  avgResolutionTime: number;
  overdueCount: number;
  upcomingDeadlines: number;
  totalEstimatedCost: number;
  monthlyTrend: Array<{ month: string; count: number; cost: number }>;
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  filters: WorkRequestFilters;
  sortOptions?: SortOptions[];
  columns: string[];
  isDefault: boolean;
  isShared: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeAttachments: boolean;
  includeComments: boolean;
  includeHistory: boolean;
  columns?: string[];
}

export class WorkRequestRepositoryService {
  constructor(private prisma: PrismaClient) {}

  async searchWorkRequests(
    organizationId: string,
    filters: WorkRequestFilters,
    sortOptions: SortOptions[] = [],
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    success: boolean;
    data?: {
      requests: WorkRequestSummary[];
      pagination: PaginationInfo;
      stats?: DashboardStats;
    };
    error?: string;
  }> {
    try {
      const skip = (page - 1) * pageSize;
      const where = this.buildWhereClause(organizationId, filters);
      const orderBy = this.buildOrderByClause(sortOptions);

      const [requests, total] = await Promise.all([
        this.prisma.workRequest.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include: {
            assetAssociations: true,
            standAssociations: true,
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),
        this.prisma.workRequest.count({ where }),
      ]);

      const summaries = requests.map(this.mapToSummary);

      // Get dashboard stats if requested
      let stats: DashboardStats | undefined;
      if (filters.includeStats) {
        stats = await this.getDashboardStats(organizationId, filters);
      }

      return {
        success: true,
        data: {
          requests: summaries,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
          stats,
        },
      };
    } catch (error) {
      console.error('Error searching work requests:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async performBulkOperation(
    organizationId: string,
    requestIds: string[],
    operation: 'approve' | 'reject' | 'assign' | 'cancel' | 'prioritize',
    params: Record<string, any>,
    userId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      totalCount: requestIds.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    for (const requestId of requestIds) {
      try {
        switch (operation) {
          case 'approve':
            await this.bulkApprove(requestId, userId, params.comments);
            break;
          case 'reject':
            await this.bulkReject(requestId, userId, params.reason);
            break;
          case 'assign':
            await this.bulkAssign(requestId, params.assigneeId);
            break;
          case 'cancel':
            await this.bulkCancel(requestId, userId, params.reason);
            break;
          case 'prioritize':
            await this.bulkPrioritize(requestId, params.priority);
            break;
        }
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          id: requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.success = result.failureCount === 0;
    return result;
  }

  async getDashboardStats(
    organizationId: string,
    filters: WorkRequestFilters = {}
  ): Promise<DashboardStats> {
    const where = this.buildWhereClause(organizationId, filters);

    // Get counts by various dimensions
    const [
      totalRequests,
      statusCounts,
      priorityCounts,
      workTypeCounts,
      assetTypeCounts,
      overdueCount,
      upcomingDeadlines,
      costData,
      monthlyData,
    ] = await Promise.all([
      this.prisma.workRequest.count({ where }),
      this.getCountsByField(where, 'status'),
      this.getCountsByField(where, 'priority'),
      this.getCountsByField(where, 'workType'),
      this.getCountsByField(where, 'assetType'),
      this.getOverdueCount(where),
      this.getUpcomingDeadlines(where),
      this.getCostData(where),
      this.getMonthlyTrend(organizationId),
    ]);

    // Calculate average resolution time
    const avgResolutionTime = await this.calculateAvgResolutionTime(where);

    return {
      totalRequests,
      byStatus: statusCounts as Record<WorkRequestStatus, number>,
      byPriority: priorityCounts as Record<Priority, number>,
      byWorkType: workTypeCounts as Record<WorkType, number>,
      byAssetType: assetTypeCounts as Record<AssetType, number>,
      avgResolutionTime,
      overdueCount,
      upcomingDeadlines,
      totalEstimatedCost: costData._sum.estimatedTotalCost || 0,
      monthlyTrend: monthlyData,
    };
  }

  async exportWorkRequests(
    organizationId: string,
    filters: WorkRequestFilters,
    options: ExportOptions
  ): Promise<{
    success: boolean;
    data?: Buffer | string;
    filename?: string;
    mimeType?: string;
    error?: string;
  }> {
    try {
      const where = this.buildWhereClause(organizationId, filters);

      const requests = await this.prisma.workRequest.findMany({
        where,
        include: {
          attachments: options.includeAttachments,
          comments: options.includeComments,
          statusHistory: options.includeHistory,
        },
      });

      let data: Buffer | string;
      let filename: string;
      let mimeType: string;

      switch (options.format) {
        case 'csv':
          data = this.exportToCSV(requests, options.columns);
          filename = `work-requests-${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;
        case 'excel':
          data = await this.exportToExcel(requests, options.columns);
          filename = `work-requests-${Date.now()}.xlsx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          data = await this.exportToPDF(requests, options.columns);
          filename = `work-requests-${Date.now()}.pdf`;
          mimeType = 'application/pdf';
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      return {
        success: true,
        data,
        filename,
        mimeType,
      };
    } catch (error) {
      console.error('Error exporting work requests:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async saveView(
    organizationId: string,
    userId: string,
    view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; viewId?: string; error?: string }> {
    try {
      const savedView = await this.prisma.savedView.create({
        data: {
          organizationId,
          name: view.name,
          description: view.description,
          filters: view.filters,
          sortOptions: view.sortOptions,
          columns: view.columns,
          isDefault: view.isDefault,
          isShared: view.isShared,
          createdBy: userId,
        },
      });

      return {
        success: true,
        viewId: savedView.id,
      };
    } catch (error) {
      console.error('Error saving view:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSavedViews(
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean; views?: SavedView[]; error?: string }> {
    try {
      const views = await this.prisma.savedView.findMany({
        where: {
          organizationId,
          OR: [{ createdBy: userId }, { isShared: true }],
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        success: true,
        views: views as SavedView[],
      };
    } catch (error) {
      console.error('Error getting saved views:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildWhereClause(organizationId: string, filters: WorkRequestFilters): any {
    const where: any = { organizationId };

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }
    if (filters.priority?.length) {
      where.priority = { in: filters.priority };
    }
    if (filters.urgency?.length) {
      where.urgency = { in: filters.urgency };
    }
    if (filters.workType?.length) {
      where.workType = { in: filters.workType };
    }
    if (filters.assetType?.length) {
      where.assetType = { in: filters.assetType };
    }
    if (filters.assetId) {
      where.assetId = filters.assetId;
    }
    if (filters.assetCode) {
      where.assetCode = { contains: filters.assetCode, mode: 'insensitive' };
    }
    if (filters.requestedBy) {
      where.requestedBy = filters.requestedBy;
    }
    if (filters.currentApprover) {
      where.currentApproverId = filters.currentApprover;
    }
    if (filters.department) {
      where.department = filters.department;
    }

    // Date filters
    if (filters.submissionDateStart || filters.submissionDateEnd) {
      where.submissionDate = {};
      if (filters.submissionDateStart) {
        where.submissionDate.gte = filters.submissionDateStart;
      }
      if (filters.submissionDateEnd) {
        where.submissionDate.lte = filters.submissionDateEnd;
      }
    }

    if (filters.requestedStartDateStart || filters.requestedStartDateEnd) {
      where.requestedStartDate = {};
      if (filters.requestedStartDateStart) {
        where.requestedStartDate.gte = filters.requestedStartDateStart;
      }
      if (filters.requestedStartDateEnd) {
        where.requestedStartDate.lte = filters.requestedStartDateEnd;
      }
    }

    if (filters.deadlineStart || filters.deadlineEnd) {
      where.deadline = {};
      if (filters.deadlineStart) {
        where.deadline.gte = filters.deadlineStart;
      }
      if (filters.deadlineEnd) {
        where.deadline.lte = filters.deadlineEnd;
      }
    }

    // Cost filters
    if (filters.minCost !== undefined || filters.maxCost !== undefined) {
      where.estimatedTotalCost = {};
      if (filters.minCost !== undefined) {
        where.estimatedTotalCost.gte = filters.minCost;
      }
      if (filters.maxCost !== undefined) {
        where.estimatedTotalCost.lte = filters.maxCost;
      }
    }

    // Text search
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { assetCode: { contains: filters.search, mode: 'insensitive' } },
        { assetName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildOrderByClause(sortOptions: SortOptions[]): any {
    if (!sortOptions.length) {
      return { createdAt: 'desc' };
    }

    return sortOptions.reduce((acc, option) => {
      acc[option.field] = option.direction;
      return acc;
    }, {} as any);
  }

  private mapToSummary(request: any): WorkRequestSummary {
    return {
      id: request.id,
      title: request.title,
      status: request.status,
      priority: request.priority,
      urgency: request.urgency,
      workType: request.workType,
      assetType: request.assetType,
      assetCode: request.assetCode,
      assetName: request.assetName,
      assetLocation: request.assetLocation,
      requestedStartDate: request.requestedStartDate,
      estimatedTotalCost: request.estimatedTotalCost,
      requestorName: request.requestorName,
      department: request.department,
      submissionDate: request.submissionDate,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private async getCountsByField(where: any, field: string): Promise<Record<string, number>> {
    const results = await this.prisma.workRequest.groupBy({
      by: [field],
      where,
      _count: true,
    });

    return results.reduce(
      (acc, item) => {
        acc[item[field]] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private async getOverdueCount(where: any): Promise<number> {
    return this.prisma.workRequest.count({
      where: {
        ...where,
        deadline: { lt: new Date() },
        status: { notIn: ['completed', 'cancelled'] },
      },
    });
  }

  private async getUpcomingDeadlines(where: any): Promise<number> {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return this.prisma.workRequest.count({
      where: {
        ...where,
        deadline: {
          gte: new Date(),
          lte: sevenDaysFromNow,
        },
        status: { notIn: ['completed', 'cancelled'] },
      },
    });
  }

  private async getCostData(where: any): Promise<any> {
    return this.prisma.workRequest.aggregate({
      where,
      _sum: {
        estimatedTotalCost: true,
      },
    });
  }

  private async calculateAvgResolutionTime(where: any): Promise<number> {
    const completedRequests = await this.prisma.workRequest.findMany({
      where: {
        ...where,
        status: 'completed',
        completedDate: { not: null },
        submissionDate: { not: null },
      },
      select: {
        submissionDate: true,
        completedDate: true,
      },
    });

    if (completedRequests.length === 0) return 0;

    const totalTime = completedRequests.reduce((sum, req) => {
      const submissionDate = new Date(req.submissionDate!).getTime();
      const completedDate = new Date(req.completedDate!).getTime();
      return sum + (completedDate - submissionDate);
    }, 0);

    return Math.round(totalTime / completedRequests.length / (1000 * 60 * 60 * 24)); // Days
  }

  private async getMonthlyTrend(
    organizationId: string
  ): Promise<Array<{ month: string; count: number; cost: number }>> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const requests = await this.prisma.workRequest.findMany({
      where: {
        organizationId,
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
        estimatedTotalCost: true,
      },
    });

    const monthlyData: Record<string, { count: number; cost: number }> = {};

    requests.forEach((req) => {
      const monthKey = new Date(req.createdAt).toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      });
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, cost: 0 };
      }
      monthlyData[monthKey].count++;
      monthlyData[monthKey].cost += req.estimatedTotalCost || 0;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }

  private async bulkApprove(requestId: string, userId: string, comments?: string): Promise<void> {
    await this.prisma.workRequest.update({
      where: { id: requestId },
      data: {
        status: WorkRequestStatus.APPROVED,
        approvedDate: new Date(),
        statusHistory: {
          create: {
            toStatus: WorkRequestStatus.APPROVED,
            changedBy: userId,
            changedByName: 'Bulk Operation',
            changedAt: new Date(),
            comments,
          },
        },
      },
    });
  }

  private async bulkReject(requestId: string, userId: string, reason: string): Promise<void> {
    await this.prisma.workRequest.update({
      where: { id: requestId },
      data: {
        status: WorkRequestStatus.REJECTED,
        statusReason: reason,
        statusHistory: {
          create: {
            toStatus: WorkRequestStatus.REJECTED,
            changedBy: userId,
            changedByName: 'Bulk Operation',
            changedAt: new Date(),
            reason,
          },
        },
      },
    });
  }

  private async bulkAssign(requestId: string, assigneeId: string): Promise<void> {
    await this.prisma.workRequest.update({
      where: { id: requestId },
      data: {
        currentApproverId: assigneeId,
      },
    });
  }

  private async bulkCancel(requestId: string, userId: string, reason: string): Promise<void> {
    await this.prisma.workRequest.update({
      where: { id: requestId },
      data: {
        status: WorkRequestStatus.CANCELLED,
        statusReason: reason,
        statusHistory: {
          create: {
            toStatus: WorkRequestStatus.CANCELLED,
            changedBy: userId,
            changedByName: 'Bulk Operation',
            changedAt: new Date(),
            reason,
          },
        },
      },
    });
  }

  private async bulkPrioritize(requestId: string, priority: Priority): Promise<void> {
    await this.prisma.workRequest.update({
      where: { id: requestId },
      data: { priority },
    });
  }

  private exportToCSV(requests: any[], columns?: string[]): string {
    const headers = columns || [
      'ID',
      'Title',
      'Status',
      'Priority',
      'Work Type',
      'Asset Code',
      'Asset Name',
      'Requestor',
      'Department',
      'Submission Date',
      'Requested Start Date',
      'Estimated Cost',
    ];

    const rows = requests.map((req) => [
      req.id,
      req.title,
      req.status,
      req.priority,
      req.workType,
      req.assetCode,
      req.assetName,
      req.requestorName,
      req.department || '',
      req.submissionDate?.toISOString() || '',
      req.requestedStartDate.toISOString(),
      req.estimatedTotalCost || '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
  }

  private async exportToExcel(requests: any[], columns?: string[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Requests');

    // Define columns
    const defaultColumns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Work Type', key: 'workType', width: 15 },
      { header: 'Asset Code', key: 'assetCode', width: 15 },
      { header: 'Asset Name', key: 'assetName', width: 25 },
      { header: 'Requestor', key: 'requestorName', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Submission Date', key: 'submissionDate', width: 18 },
      { header: 'Requested Start Date', key: 'requestedStartDate', width: 18 },
      { header: 'Estimated Cost', key: 'estimatedTotalCost', width: 15 },
    ];

    worksheet.columns = defaultColumns;

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data
    requests.forEach((request) => {
      worksheet.addRow({
        id: request.id,
        title: request.title,
        status: request.status,
        priority: request.priority,
        workType: request.workType,
        assetCode: request.assetCode,
        assetName: request.assetName,
        requestorName: request.requestorName,
        department: request.department || '',
        submissionDate: request.submissionDate
          ? new Date(request.submissionDate).toLocaleDateString()
          : '',
        requestedStartDate: new Date(request.requestedStartDate).toLocaleDateString(),
        estimatedTotalCost: request.estimatedTotalCost || '',
      });
    });

    // Apply conditional formatting for priority
    worksheet.getColumn('priority').eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        switch (cell.value) {
          case 'critical':
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFF0000' },
            };
            cell.font = { color: { argb: 'FFFFFFFF' } };
            break;
          case 'high':
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFA500' },
            };
            break;
          case 'medium':
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFF00' },
            };
            break;
        }
      }
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column.width) {
        column.width = column.width;
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async exportToPDF(requests: any[], columns?: string[]): Promise<Buffer> {
    // Placeholder for PDF export
    // In a real implementation, you would use a library like pdfkit or puppeteer
    throw new Error('PDF export not implemented yet');
  }
}

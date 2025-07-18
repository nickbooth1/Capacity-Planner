import { PrismaClient, StandImportJob } from '@prisma/client';
import { StandImportJob as StandImportJobType } from '../types';

export class StandImportRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new import job
   */
  async createJob(
    organizationId: string,
    filename: string,
    fileUrl: string,
    totalRows: number,
    userId: string
  ): Promise<StandImportJob> {
    return await this.prisma.standImportJob.create({
      data: {
        organizationId,
        filename,
        fileUrl,
        totalRows,
        createdBy: userId,
      },
    });
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    updates?: {
      processedRows?: number;
      successRows?: number;
      errorRows?: number;
      errors?: any[];
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<StandImportJob> {
    const data: any = { status };

    if (updates) {
      Object.assign(data, updates);
    }

    return await this.prisma.standImportJob.update({
      where: { id: jobId },
      data,
    });
  }

  /**
   * Get import job by ID
   */
  async getJobById(jobId: string): Promise<StandImportJob | null> {
    return await this.prisma.standImportJob.findUnique({
      where: { id: jobId },
    });
  }

  /**
   * Get import jobs for an organization
   */
  async getJobsByOrganization(
    organizationId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    jobs: StandImportJob[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const [jobs, total] = await Promise.all([
      this.prisma.standImportJob.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.standImportJob.count({
        where: { organizationId },
      }),
    ]);

    return {
      jobs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Delete old completed jobs (cleanup)
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.standImportJob.deleteMany({
      where: {
        status: { in: ['completed', 'failed'] },
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

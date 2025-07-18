import { PrismaClient } from '@prisma/client';
import { StandImportRepository } from '../repositories/stand-import.repository';
import { StandCRUDService } from './stand-crud.service';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import { StandImportJob, StandImportRow, CreateStandRequest } from '../types';
import * as csv from 'csv-parser';
import * as fs from 'fs';

export class StandImportService {
  private importRepository: StandImportRepository;
  private crudService: StandCRUDService;

  constructor(
    private prisma: PrismaClient,
    private validationEngine: CapabilityValidationEngine
  ) {
    this.importRepository = new StandImportRepository(prisma);
    this.crudService = new StandCRUDService(prisma, validationEngine);
  }

  /**
   * Start a new import job
   */
  async startImport(
    organizationId: string,
    filename: string,
    fileUrl: string,
    userId: string
  ): Promise<StandImportJob> {
    // Create import job
    const job = await this.importRepository.createJob(
      organizationId,
      filename,
      fileUrl,
      0, // Will be updated after parsing
      userId
    );

    // Start processing asynchronously
    this.processImportJob(job.id, organizationId, fileUrl, userId).catch((error) => {
      console.error('Import job failed:', error);
    });

    return job;
  }

  /**
   * Get import job status
   */
  async getImportStatus(jobId: string): Promise<StandImportJob | null> {
    return await this.importRepository.getJobById(jobId);
  }

  /**
   * Get import jobs for an organization
   */
  async getImportJobs(organizationId: string, page: number = 1, pageSize: number = 20) {
    return await this.importRepository.getJobsByOrganization(organizationId, page, pageSize);
  }

  /**
   * Process an import job (runs asynchronously)
   */
  private async processImportJob(
    jobId: string,
    organizationId: string,
    fileUrl: string,
    userId: string
  ): Promise<void> {
    try {
      // Update job status to processing
      await this.importRepository.updateJobStatus(jobId, 'processing', {
        startedAt: new Date(),
      });

      // Parse CSV file
      const rows = await this.parseCSVFile(fileUrl);

      // Update total rows
      await this.importRepository.updateJobStatus(jobId, 'processing', {
        totalRows: rows.length,
      });

      // Process each row
      let processedRows = 0;
      let successRows = 0;
      let errorRows = 0;
      const errors: any[] = [];

      for (const row of rows) {
        try {
          // Validate and create stand
          const validationResult = await this.validateRow(row);
          if (validationResult.isValid) {
            await this.crudService.createStand(organizationId, validationResult.data, userId);
            successRows++;
          } else {
            errorRows++;
            errors.push({
              row: row.rowNumber,
              errors: validationResult.errors,
            });
          }
        } catch (error: any) {
          errorRows++;
          errors.push({
            row: row.rowNumber,
            errors: [error.message],
          });
        }

        processedRows++;

        // Update progress every 10 rows
        if (processedRows % 10 === 0) {
          await this.importRepository.updateJobStatus(jobId, 'processing', {
            processedRows,
            successRows,
            errorRows,
            errors,
          });
        }
      }

      // Final update
      await this.importRepository.updateJobStatus(jobId, 'completed', {
        processedRows,
        successRows,
        errorRows,
        errors,
        completedAt: new Date(),
      });
    } catch (error: any) {
      console.error('Import job processing failed:', error);
      await this.importRepository.updateJobStatus(jobId, 'failed', {
        errors: [{ message: error.message }],
        completedAt: new Date(),
      });
    }
  }

  /**
   * Parse CSV file into rows
   */
  private async parseCSVFile(fileUrl: string): Promise<StandImportRow[]> {
    return new Promise((resolve, reject) => {
      const rows: StandImportRow[] = [];
      let rowNumber = 0;

      // For now, assume fileUrl is a local file path
      // In production, this would download from S3/MinIO
      fs.createReadStream(fileUrl)
        .pipe(csv())
        .on('data', (data: any) => {
          rowNumber++;
          rows.push({
            rowNumber,
            data: this.mapCSVRowToStandRequest(data),
            errors: [],
            isValid: true,
          });
        })
        .on('end', () => {
          resolve(rows);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Map CSV row to CreateStandRequest
   */
  private mapCSVRowToStandRequest(row: any): CreateStandRequest {
    return {
      code: row.code || row.Code,
      name: row.name || row.Name,
      terminal: row.terminal || row.Terminal,
      status: row.status || row.Status || 'operational',
      dimensions: row.dimensions
        ? JSON.parse(row.dimensions)
        : {
            length: parseFloat(row.length) || undefined,
            width: parseFloat(row.width) || undefined,
            height: parseFloat(row.height) || undefined,
          },
      aircraftCompatibility: row.aircraftCompatibility
        ? JSON.parse(row.aircraftCompatibility)
        : {
            maxWingspan: parseFloat(row.maxWingspan) || undefined,
            maxLength: parseFloat(row.maxLength) || undefined,
            maxWeight: parseFloat(row.maxWeight) || undefined,
            compatibleCategories: row.compatibleCategories
              ? row.compatibleCategories.split(',')
              : undefined,
          },
      groundSupport: row.groundSupport
        ? JSON.parse(row.groundSupport)
        : {
            hasPowerSupply: this.parseBoolean(row.hasPowerSupply),
            hasGroundAir: this.parseBoolean(row.hasGroundAir),
            hasFuelHydrant: this.parseBoolean(row.hasFuelHydrant),
          },
      latitude: parseFloat(row.latitude) || undefined,
      longitude: parseFloat(row.longitude) || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    };
  }

  /**
   * Validate a single row
   */
  private async validateRow(row: StandImportRow): Promise<StandImportRow> {
    const errors: string[] = [];

    // Basic validation
    if (!row.data.code) {
      errors.push('Code is required');
    }
    if (!row.data.name) {
      errors.push('Name is required');
    }

    // Validate capabilities if provided
    if (this.hasCapabilityData(row.data)) {
      try {
        const capabilities = {
          dimensions: row.data.dimensions || {},
          aircraftCompatibility: row.data.aircraftCompatibility || {},
          groundSupport: row.data.groundSupport || {},
          operationalConstraints: row.data.operationalConstraints || {},
          environmentalFeatures: row.data.environmentalFeatures || {},
          infrastructure: row.data.infrastructure || {},
        };

        const validationResult = await this.validationEngine.validate(capabilities);
        if (!validationResult.valid) {
          errors.push(...validationResult.errors.map((e) => e.message));
        }
      } catch (error: any) {
        errors.push(`Capability validation failed: ${error.message}`);
      }
    }

    return {
      ...row,
      errors,
      isValid: errors.length === 0,
    };
  }

  /**
   * Check if the request contains capability data
   */
  private hasCapabilityData(data: CreateStandRequest): boolean {
    return !!(
      data.dimensions ||
      data.aircraftCompatibility ||
      data.groundSupport ||
      data.operationalConstraints ||
      data.environmentalFeatures ||
      data.infrastructure
    );
  }

  /**
   * Parse boolean values from CSV
   */
  private parseBoolean(value: string): boolean | undefined {
    if (!value) return undefined;
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') return true;
    if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') return false;
    return undefined;
  }
}

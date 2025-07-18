import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

export interface FileUploadConfig {
  uploadPath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  enableVirusScanning: boolean;
  enableEncryption: boolean;
  virusScannerUrl?: string;
}

export interface FileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  fileHash: string;
  isSecure: boolean;
  encryptionKeyId?: string;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'error';
  virusScanDate?: Date;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  metadata?: FileMetadata;
  error?: string;
}

export interface VirusScanResult {
  status: 'clean' | 'infected' | 'error';
  message?: string;
  scanDate: Date;
}

export class FileUploadService {
  private config: FileUploadConfig = {
    uploadPath: process.env.FILE_UPLOAD_PATH || '/app/uploads',
    maxFileSize: 104857600, // 100MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    enableVirusScanning: true,
    enableEncryption: false,
    virusScannerUrl: process.env.VIRUS_SCANNER_URL,
  };

  constructor(
    private prisma: PrismaClient,
    config?: Partial<FileUploadConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async uploadFile(
    workRequestId: string,
    file: Express.Multer.File,
    userId: string,
    options: {
      description?: string;
      isSecure?: boolean;
    } = {}
  ): Promise<UploadResult> {
    try {
      // Validate file
      const validationResult = await this.validateFile(file);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.error,
        };
      }

      // Generate unique filename
      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(file.originalname);
      const fileName = `${fileId}${fileExtension}`;
      const filePath = path.join(this.config.uploadPath, workRequestId, fileName);

      // Ensure upload directory exists
      await this.ensureUploadDirectory(path.dirname(filePath));

      // Calculate file hash
      const fileHash = await this.calculateFileHash(file.buffer);

      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Create database record
      const attachment = await this.prisma.workRequestAttachment.create({
        data: {
          workRequestId,
          fileName,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          filePath,
          fileHash,
          isSecure: options.isSecure || false,
          virusScanStatus: 'pending',
          uploadedBy: userId,
          description: options.description,
        },
      });

      // Trigger virus scan asynchronously
      if (this.config.enableVirusScanning) {
        this.scanFileForViruses(attachment.id, filePath).catch((error) => {
          console.error('Error scanning file for viruses:', error);
        });
      }

      // Update work request attachments array
      await this.updateWorkRequestAttachments(workRequestId, attachment.id);

      return {
        success: true,
        fileId: attachment.id,
        metadata: this.mapToFileMetadata(attachment),
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async downloadFile(
    workRequestId: string,
    attachmentId: string,
    userId: string
  ): Promise<{
    success: boolean;
    data?: { path: string; metadata: FileMetadata };
    error?: string;
  }> {
    try {
      // Get attachment record
      const attachment = await this.prisma.workRequestAttachment.findFirst({
        where: {
          id: attachmentId,
          workRequestId,
        },
      });

      if (!attachment) {
        return {
          success: false,
          error: 'Attachment not found',
        };
      }

      // Check if file is infected
      if (attachment.virusScanStatus === 'infected') {
        return {
          success: false,
          error: 'File is infected and cannot be downloaded',
        };
      }

      // Check if file exists
      const fileExists = await this.fileExists(attachment.filePath);
      if (!fileExists) {
        return {
          success: false,
          error: 'File not found on disk',
        };
      }

      // Verify file integrity
      const currentHash = await this.calculateFileHashFromPath(attachment.filePath);
      if (currentHash !== attachment.fileHash) {
        return {
          success: false,
          error: 'File integrity check failed',
        };
      }

      // Log download
      await this.logFileAccess(attachmentId, userId, 'download');

      return {
        success: true,
        data: {
          path: attachment.filePath,
          metadata: this.mapToFileMetadata(attachment),
        },
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async deleteFile(
    workRequestId: string,
    attachmentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get attachment record
      const attachment = await this.prisma.workRequestAttachment.findFirst({
        where: {
          id: attachmentId,
          workRequestId,
        },
      });

      if (!attachment) {
        return {
          success: false,
          error: 'Attachment not found',
        };
      }

      // Delete file from disk
      try {
        await fs.unlink(attachment.filePath);
      } catch (error) {
        console.error('Error deleting file from disk:', error);
        // Continue with database deletion even if file deletion fails
      }

      // Delete database record
      await this.prisma.workRequestAttachment.delete({
        where: { id: attachmentId },
      });

      // Update work request attachments array
      await this.removeFromWorkRequestAttachments(workRequestId, attachmentId);

      // Log deletion
      await this.logFileAccess(attachmentId, userId, 'delete');

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getAttachments(
    workRequestId: string
  ): Promise<{ success: boolean; data?: FileMetadata[]; error?: string }> {
    try {
      const attachments = await this.prisma.workRequestAttachment.findMany({
        where: { workRequestId },
        orderBy: { uploadedAt: 'desc' },
      });

      return {
        success: true,
        data: attachments.map(this.mapToFileMetadata),
      };
    } catch (error) {
      console.error('Error getting attachments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async validateFile(
    file: Express.Multer.File
  ): Promise<{ isValid: boolean; error?: string }> {
    // Check file size
    if (file.size <= 0) {
      return {
        isValid: false,
        error: 'File size must be greater than 0',
      };
    }

    if (file.size > this.config.maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${this.config.maxFileSize / 1024 / 1024}MB`,
      };
    }

    // Check mime type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `File type ${file.mimetype} is not allowed`,
      };
    }

    // Additional validation for file content
    const isValidContent = await this.validateFileContent(file);
    if (!isValidContent) {
      return {
        isValid: false,
        error: 'File content validation failed',
      };
    }

    return { isValid: true };
  }

  private async validateFileContent(file: Express.Multer.File): Promise<boolean> {
    // Basic content validation
    // Check if file buffer is not empty
    if (!file.buffer || file.buffer.length === 0) {
      return false;
    }

    // Validate file signatures for common types
    const fileSignatures: Record<string, Buffer[]> = {
      'application/pdf': [Buffer.from('%PDF', 'ascii')],
      'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
      'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
      'image/gif': [Buffer.from('GIF87a', 'ascii'), Buffer.from('GIF89a', 'ascii')],
    };

    const signatures = fileSignatures[file.mimetype];
    if (signatures) {
      const fileStart = file.buffer.slice(0, 10);
      return signatures.some((sig) => fileStart.slice(0, sig.length).equals(sig));
    }

    return true;
  }

  private async calculateFileHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  private async calculateFileHashFromPath(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return this.calculateFileHash(fileBuffer);
  }

  private async ensureUploadDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async scanFileForViruses(attachmentId: string, filePath: string): Promise<void> {
    try {
      const scanResult = await this.performVirusScan(filePath);

      await this.prisma.workRequestAttachment.update({
        where: { id: attachmentId },
        data: {
          virusScanStatus: scanResult.status,
          virusScanDate: scanResult.scanDate,
          virusScanMessage: scanResult.message,
        },
      });

      // If file is infected, quarantine it
      if (scanResult.status === 'infected') {
        await this.quarantineFile(filePath);
      }
    } catch (error) {
      console.error('Error in virus scan:', error);
      await this.prisma.workRequestAttachment.update({
        where: { id: attachmentId },
        data: {
          virusScanStatus: 'error',
          virusScanDate: new Date(),
          virusScanMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async performVirusScan(filePath: string): Promise<VirusScanResult> {
    // This would integrate with a real virus scanner like ClamAV
    // For now, return mock result

    // Simulate async scan
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock implementation - always return clean for development
    return {
      status: 'clean',
      message: 'No threats detected',
      scanDate: new Date(),
    };
  }

  private async quarantineFile(filePath: string): Promise<void> {
    const quarantinePath = path.join(path.dirname(filePath), 'quarantine', path.basename(filePath));

    await this.ensureUploadDirectory(path.dirname(quarantinePath));
    await fs.rename(filePath, quarantinePath);
  }

  private async updateWorkRequestAttachments(
    workRequestId: string,
    attachmentId: string
  ): Promise<void> {
    const workRequest = await this.prisma.workRequest.findUnique({
      where: { id: workRequestId },
    });

    if (workRequest) {
      const attachments = (workRequest.attachments as any[]) || [];
      attachments.push({ id: attachmentId, uploadedAt: new Date() });

      await this.prisma.workRequest.update({
        where: { id: workRequestId },
        data: { attachments },
      });
    }
  }

  private async removeFromWorkRequestAttachments(
    workRequestId: string,
    attachmentId: string
  ): Promise<void> {
    const workRequest = await this.prisma.workRequest.findUnique({
      where: { id: workRequestId },
    });

    if (workRequest) {
      const attachments = ((workRequest.attachments as any[]) || []).filter(
        (att) => att.id !== attachmentId
      );

      await this.prisma.workRequest.update({
        where: { id: workRequestId },
        data: { attachments },
      });
    }
  }

  private async logFileAccess(attachmentId: string, userId: string, action: string): Promise<void> {
    // This would log to audit trail
    console.log(`File access: ${action} by ${userId} on attachment ${attachmentId}`);
  }

  private mapToFileMetadata(attachment: any): FileMetadata {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      originalName: attachment.originalName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      filePath: attachment.filePath,
      fileHash: attachment.fileHash,
      isSecure: attachment.isSecure,
      encryptionKeyId: attachment.encryptionKeyId,
      virusScanStatus: attachment.virusScanStatus,
      virusScanDate: attachment.virusScanDate,
      uploadedBy: attachment.uploadedBy,
      uploadedAt: attachment.uploadedAt,
    };
  }
}

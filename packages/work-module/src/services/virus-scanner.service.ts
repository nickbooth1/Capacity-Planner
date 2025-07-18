import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

export interface ScanResult {
  status: 'clean' | 'infected' | 'error';
  threats: string[];
  scanTime: number;
  engine: string;
  message?: string;
}

export interface ScannerConfig {
  engine: 'clamav' | 'api' | 'mock';
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
  quarantinePath?: string;
}

export class VirusScannerService {
  private config: ScannerConfig;

  constructor(config?: Partial<ScannerConfig>) {
    this.config = {
      engine: (process.env.VIRUS_SCANNER_ENGINE as any) || 'mock',
      apiUrl: process.env.VIRUS_SCANNER_API_URL,
      apiKey: process.env.VIRUS_SCANNER_API_KEY,
      timeout: 30000, // 30 seconds
      quarantinePath: process.env.QUARANTINE_PATH || '/app/quarantine',
      ...config,
    };
  }

  async scanFile(filePath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      let result: ScanResult;

      switch (this.config.engine) {
        case 'clamav':
          result = await this.scanWithClamAV(filePath);
          break;
        case 'api':
          result = await this.scanWithAPI(filePath);
          break;
        case 'mock':
        default:
          result = await this.mockScan(filePath);
          break;
      }

      result.scanTime = Date.now() - startTime;
      return result;
    } catch (error) {
      console.error('Error scanning file:', error);
      return {
        status: 'error',
        threats: [],
        scanTime: Date.now() - startTime,
        engine: this.config.engine,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async scanBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
    // Create temporary file for scanning
    const tempPath = path.join('/tmp', `scan_${Date.now()}_${fileName}`);

    try {
      await fs.writeFile(tempPath, buffer);
      const result = await this.scanFile(tempPath);

      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {});

      return result;
    } catch (error) {
      // Ensure temp file is cleaned up
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  private async scanWithClamAV(filePath: string): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const clamdscan = spawn('clamdscan', ['--no-summary', filePath]);

      let stdout = '';
      let stderr = '';

      clamdscan.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      clamdscan.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      clamdscan.on('close', (code) => {
        if (code === 0) {
          // File is clean
          resolve({
            status: 'clean',
            threats: [],
            scanTime: 0,
            engine: 'clamav',
            message: 'No threats detected',
          });
        } else if (code === 1) {
          // File is infected
          const threats = this.parseClamAVOutput(stdout);
          resolve({
            status: 'infected',
            threats,
            scanTime: 0,
            engine: 'clamav',
            message: `Found ${threats.length} threat(s)`,
          });
        } else {
          // Error occurred
          reject(new Error(`ClamAV scan failed with code ${code}: ${stderr}`));
        }
      });

      clamdscan.on('error', (error) => {
        reject(new Error(`Failed to start ClamAV: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        clamdscan.kill();
        reject(new Error('ClamAV scan timeout'));
      }, this.config.timeout!);
    });
  }

  private async scanWithAPI(filePath: string): Promise<ScanResult> {
    if (!this.config.apiUrl) {
      throw new Error('API URL not configured for virus scanning');
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    // Create form data
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), fileName);

    // Send to API
    const response = await axios.post(this.config.apiUrl, formData, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: this.config.timeout,
    });

    // Parse API response
    if (response.data.status === 'clean') {
      return {
        status: 'clean',
        threats: [],
        scanTime: 0,
        engine: 'api',
        message: 'No threats detected',
      };
    } else if (response.data.status === 'infected') {
      return {
        status: 'infected',
        threats: response.data.threats || [],
        scanTime: 0,
        engine: 'api',
        message: response.data.message,
      };
    } else {
      throw new Error('Invalid API response');
    }
  }

  private async mockScan(filePath: string): Promise<ScanResult> {
    // Simulate scanning delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      return {
        status: 'error',
        threats: [],
        scanTime: 0,
        engine: 'mock',
        message: 'Empty file',
      };
    }

    // Mock implementation - check for EICAR test string
    const content = await fs.readFile(filePath, 'utf-8').catch(() => '');
    if (content.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
      return {
        status: 'infected',
        threats: ['EICAR-Test-File'],
        scanTime: 0,
        engine: 'mock',
        message: 'EICAR test file detected',
      };
    }

    // Randomly flag some files as infected in development (1% chance)
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) {
      return {
        status: 'infected',
        threats: ['Mock.Malware.Test'],
        scanTime: 0,
        engine: 'mock',
        message: 'Mock malware detected (development only)',
      };
    }

    return {
      status: 'clean',
      threats: [],
      scanTime: 0,
      engine: 'mock',
      message: 'No threats detected (mock scan)',
    };
  }

  private parseClamAVOutput(output: string): string[] {
    const threats: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('FOUND')) {
        const match = line.match(/: (.+) FOUND/);
        if (match && match[1]) {
          threats.push(match[1]);
        }
      }
    }

    return threats;
  }

  async quarantineFile(filePath: string, reason: string): Promise<string> {
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantineFileName = `${timestamp}_${reason}_${fileName}`;
    const quarantinePath = path.join(this.config.quarantinePath!, quarantineFileName);

    // Ensure quarantine directory exists
    await fs.mkdir(path.dirname(quarantinePath), { recursive: true });

    // Move file to quarantine
    await fs.rename(filePath, quarantinePath);

    // Create metadata file
    const metadataPath = `${quarantinePath}.json`;
    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          originalPath: filePath,
          quarantinedAt: new Date().toISOString(),
          reason,
          fileName,
        },
        null,
        2
      )
    );

    return quarantinePath;
  }

  async restoreFromQuarantine(quarantinePath: string, restorePath: string): Promise<void> {
    // Verify file exists in quarantine
    await fs.access(quarantinePath);

    // Scan file again before restoring
    const scanResult = await this.scanFile(quarantinePath);
    if (scanResult.status === 'infected') {
      throw new Error('Cannot restore infected file from quarantine');
    }

    // Restore file
    await fs.rename(quarantinePath, restorePath);

    // Remove metadata file
    const metadataPath = `${quarantinePath}.json`;
    await fs.unlink(metadataPath).catch(() => {});
  }

  async cleanQuarantine(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.config.quarantinePath!);

      for (const file of files) {
        if (file.endsWith('.json')) continue; // Skip metadata files

        const filePath = path.join(this.config.quarantinePath!, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);

          // Delete metadata file if exists
          const metadataPath = `${filePath}.json`;
          await fs.unlink(metadataPath).catch(() => {});

          deletedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning quarantine:', error);
    }

    return deletedCount;
  }
}

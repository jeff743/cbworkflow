import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export class BackupService {
  private backupDir = path.resolve(import.meta.dirname, '..', 'backups');

  constructor() {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a full database backup
   */
  async createFullBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `full-backup-${timestamp}.sql`);
    
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      // Create pg_dump command
      const command = `pg_dump "${databaseUrl}" > "${backupFile}"`;
      
      logger.info(`Starting database backup to ${backupFile}`, 'backup');
      await execAsync(command);
      
      logger.info(`Database backup completed: ${backupFile}`, 'backup');
      return backupFile;
    } catch (error) {
      logger.error(`Backup failed: ${error}`, 'backup', error as Error);
      throw error;
    }
  }

  /**
   * Create a schema-only backup
   */
  async createSchemaBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `schema-backup-${timestamp}.sql`);
    
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      const command = `pg_dump --schema-only "${databaseUrl}" > "${backupFile}"`;
      
      logger.info(`Starting schema backup to ${backupFile}`, 'backup');
      await execAsync(command);
      
      logger.info(`Schema backup completed: ${backupFile}`, 'backup');
      return backupFile;
    } catch (error) {
      logger.error(`Schema backup failed: ${error}`, 'backup', error as Error);
      throw error;
    }
  }

  /**
   * Export data to JSON format (application-level backup)
   */
  async createJsonBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `json-backup-${timestamp}.json`);
      
      // Import storage dynamically to avoid circular dependencies
      const { storage } = await import('./storage');
      
      logger.info(`Starting JSON backup to ${backupFile}`, 'backup');
      
      // Export all critical data
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          users: await storage.getAllUsers(),
          projects: await storage.getProjects(''), // We'll get all projects differently
          statements: await storage.getAllStatements(),
        }
      };

      // Write to file
      await fs.promises.writeFile(backupFile, JSON.stringify(backupData, null, 2));
      
      logger.info(`JSON backup completed: ${backupFile}`, 'backup');
      return backupFile;
    } catch (error) {
      logger.error(`JSON backup failed: ${error}`, 'backup', error as Error);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.backupDir);
      return files
        .filter(file => file.endsWith('.sql') || file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Most recent first
    } catch (error) {
      logger.error(`Failed to list backups: ${error}`, 'backup', error as Error);
      return [];
    }
  }

  /**
   * Clean up old backups (keep last N backups)
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<void> {
    try {
      const backups = await this.listBackups();
      const toDelete = backups.slice(keepCount);
      
      for (const backup of toDelete) {
        const filePath = path.join(this.backupDir, backup);
        await fs.promises.unlink(filePath);
        logger.info(`Deleted old backup: ${backup}`, 'backup');
      }
    } catch (error) {
      logger.error(`Cleanup failed: ${error}`, 'backup', error as Error);
    }
  }
}

export const backupService = new BackupService();
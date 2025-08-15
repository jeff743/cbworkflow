import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = path.resolve(import.meta.dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

// Log file paths
const logFiles = {
  [LogLevel.ERROR]: path.join(logsDir, 'error.log'),
  [LogLevel.WARN]: path.join(logsDir, 'warn.log'),
  [LogLevel.INFO]: path.join(logsDir, 'info.log'),
  [LogLevel.DEBUG]: path.join(logsDir, 'debug.log'),
  combined: path.join(logsDir, 'combined.log'),
  access: path.join(logsDir, 'access.log'),
  auth: path.join(logsDir, 'auth.log'),
  database: path.join(logsDir, 'database.log')
};

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private writeToFile(filePath: string, message: string): void {
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(filePath, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private writeToConsoleAndFile(level: LogLevel, message: string, context?: string): void {
    const contextStr = context ? ` [${context}]` : '';
    const fullMessage = `${level}${contextStr}: ${message}`;
    
    // Write to console
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit", 
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} ${fullMessage}`);
    
    // Write to specific log file
    this.writeToFile(logFiles[level], fullMessage);
    
    // Write to combined log
    this.writeToFile(logFiles.combined, fullMessage);
  }

  error(message: string, context?: string, error?: Error): void {
    let fullMessage = message;
    if (error) {
      fullMessage += `\nStack: ${error.stack}`;
    }
    this.writeToConsoleAndFile(LogLevel.ERROR, fullMessage, context);
  }

  warn(message: string, context?: string): void {
    this.writeToConsoleAndFile(LogLevel.WARN, message, context);
  }

  info(message: string, context?: string): void {
    this.writeToConsoleAndFile(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: string): void {
    // Only log debug in development
    if (process.env.NODE_ENV === 'development') {
      this.writeToConsoleAndFile(LogLevel.DEBUG, message, context);
    }
  }

  // Special logging methods for specific types of events
  access(message: string): void {
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] ${message}`;
    
    console.log(`${new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit", 
      hour12: true,
    })} [access] ${message}`);
    
    this.writeToFile(logFiles.access, logEntry);
    this.writeToFile(logFiles.combined, `ACCESS: ${logEntry}`);
  }

  auth(message: string, userId?: string): void {
    const userInfo = userId ? ` [User: ${userId}]` : '';
    const fullMessage = `${message}${userInfo}`;
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] ${fullMessage}`;
    
    console.log(`${new Date().toLocaleTimeString("en-US", {
      hour: "numeric", 
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })} [auth] ${fullMessage}`);
    
    this.writeToFile(logFiles.auth, logEntry);
    this.writeToFile(logFiles.combined, `AUTH: ${logEntry}`);
  }

  database(message: string, operation?: string): void {
    const opInfo = operation ? ` [${operation}]` : '';
    const fullMessage = `${message}${opInfo}`;
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] ${fullMessage}`;
    
    console.log(`${new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit", 
      second: "2-digit",
      hour12: true,
    })} [database] ${fullMessage}`);
    
    this.writeToFile(logFiles.database, logEntry);
    this.writeToFile(logFiles.combined, `DATABASE: ${logEntry}`);
  }

  // Method to get log file paths for external access
  getLogFiles(): typeof logFiles {
    return logFiles;
  }

  // Method to clear old logs (useful for log rotation)
  clearLogs(): void {
    Object.values(logFiles).forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.truncateSync(filePath, 0);
      }
    });
    this.info('All log files cleared');
  }

  // Method to get recent log entries
  getRecentLogs(logType: keyof typeof logFiles = 'combined', lines: number = 50): string[] {
    const filePath = logFiles[logType];
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }
}

export const logger = new Logger();

// Export convenience methods
export const log = (message: string, context?: string) => logger.info(message, context);
export const logError = (message: string, context?: string, error?: Error) => logger.error(message, context, error);
export const logWarn = (message: string, context?: string) => logger.warn(message, context);
export const logDebug = (message: string, context?: string) => logger.debug(message, context);
export const logAccess = (message: string) => logger.access(message);
export const logAuth = (message: string, userId?: string) => logger.auth(message, userId);
export const logDatabase = (message: string, operation?: string) => logger.database(message, operation);
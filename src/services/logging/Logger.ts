/**
 * Logging Service
 * 
 * Provides structured logging capabilities with consistent formatting,
 * timestamps, and context. Supports multiple log levels and automatic
 * redaction of sensitive data.
 * 
 * Requirements 19.5: Logging authentication attempts, parse errors,
 * business rule violations, and database errors with appropriate context
 */

/**
 * Log levels following the standard severity hierarchy
 */
export enum LogLevel {
  DEBUG = 'DEBUG',     // Detailed diagnostic information for development
  INFO = 'INFO',       // Normal operation events (user login, pricelist processed)
  WARN = 'WARN',       // Abnormal but handled situations (validation failures, business rule violations)
  ERROR = 'ERROR',     // Failures requiring attention (database errors, external service failures)
  CRITICAL = 'CRITICAL' // System-threatening failures requiring immediate response
}

/**
 * Log entry structure with consistent formatting
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Fields that should be redacted from logs to protect sensitive data
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'cardNumber',
  'cvv',
  'ssn',
  'socialSecurity',
  'creditCard',
  'paymentInfo',
];

/**
 * Logger class providing structured logging with automatic redaction
 */
export class Logger {
  private static instance: Logger;
  private minLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton Logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set the minimum log level (logs below this level will be suppressed)
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get the numeric value for log level comparison
   */
  private getLevelValue(level: LogLevel): number {
    const levels = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.CRITICAL]: 4,
    };
    return levels[level];
  }

  /**
   * Check if a log level should be logged based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getLevelValue(level) >= this.getLevelValue(this.minLevel);
  }

  /**
   * Redact sensitive fields from context objects
   */
  private redactSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactSensitiveData(item));
    }

    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Create a log entry with consistent formatting
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context) {
      entry.context = this.redactSensitiveData(context);
    }

    if (error) {
      entry.error = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Output the log entry (can be overridden for different targets)
   */
  private output(entry: LogEntry): void {
    const formatted = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formatted);
        break;
    }
  }

  /**
   * Format log entry as JSON string for structured logging
   */
  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Log a message at DEBUG level
   */
  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.output(entry);
  }

  /**
   * Log a message at INFO level
   */
  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.output(entry);
  }

  /**
   * Log a message at WARN level
   */
  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.output(entry);
  }

  /**
   * Log a message at ERROR level with optional error object
   */
  error(message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.output(entry);
  }

  /**
   * Log a message at CRITICAL level with optional error object
   */
  critical(message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(LogLevel.CRITICAL)) return;
    const entry = this.createLogEntry(LogLevel.CRITICAL, message, context, error);
    this.output(entry);
  }

  // Specialized logging methods for specific use cases

  /**
   * Log authentication attempt (Requirements 19.5)
   */
  logAuthAttempt(
    email: string,
    success: boolean,
    ipAddress?: string,
    reason?: string
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const message = success 
      ? `Authentication successful for user: ${email}`
      : `Authentication failed for user: ${email}`;

    const context: Record<string, any> = {
      email,
      success,
      timestamp: new Date().toISOString(),
    };

    if (ipAddress) {
      context.ipAddress = ipAddress;
    }

    if (!success && reason) {
      context.failureReason = reason;
    }

    if (success) {
      this.info(message, context);
    } else {
      this.warn(message, context);
    }
  }

  /**
   * Log parse error with file metadata (Requirements 19.5)
   */
  logParseError(
    fileName: string,
    errorMessage: string,
    fileMetadata?: {
      fileSize?: number;
      mimeType?: string;
      uploadedBy?: string;
    }
  ): void {
    const context: Record<string, any> = {
      fileName,
      errorMessage,
      category: 'parse_error',
    };

    if (fileMetadata) {
      if (fileMetadata.fileSize !== undefined) {
        context.fileSize = fileMetadata.fileSize;
      }
      if (fileMetadata.mimeType) {
        context.mimeType = fileMetadata.mimeType;
      }
      if (fileMetadata.uploadedBy) {
        context.uploadedBy = fileMetadata.uploadedBy;
      }
    }

    this.warn(`Parse error in file: ${fileName}`, context);
  }

  /**
   * Log business rule violation (Requirements 19.5)
   */
  logBusinessRuleViolation(
    rule: string,
    details: Record<string, any>,
    overridden: boolean = false,
    overriddenBy?: string
  ): void {
    const message = overridden
      ? `Business rule violation overridden: ${rule}`
      : `Business rule violation: ${rule}`;

    const context: Record<string, any> = {
      rule,
      details: this.redactSensitiveData(details),
      overridden,
      category: 'business_rule_violation',
    };

    if (overridden && overriddenBy) {
      context.overriddenBy = overriddenBy;
      context.overrideTimestamp = new Date().toISOString();
    }

    this.warn(message, context);
  }

  /**
   * Log database error with stack trace (Requirements 19.5)
   */
  logDatabaseError(
    operation: string,
    collection: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const message = `Database error during ${operation} on collection '${collection}'`;

    const logContext: Record<string, any> = {
      operation,
      collection,
      category: 'database_error',
      ...(context ? this.redactSensitiveData(context) : {}),
    };

    this.error(message, logContext, error);
  }

  /**
   * Log external service failure
   */
  logExternalServiceError(
    serviceName: string,
    operation: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const message = `External service '${serviceName}' failed during ${operation}`;

    const logContext: Record<string, any> = {
      serviceName,
      operation,
      category: 'external_service_error',
      ...(context ? this.redactSensitiveData(context) : {}),
    };

    this.error(message, logContext, error);
  }

  /**
   * Log account lockout event
   */
  logAccountLockout(
    email: string,
    reason: string,
    lockDurationMinutes: number,
    ipAddress?: string
  ): void {
    const context: Record<string, any> = {
      email,
      reason,
      lockDurationMinutes,
      category: 'account_lockout',
    };

    if (ipAddress) {
      context.ipAddress = ipAddress;
    }

    this.warn(`Account locked for user: ${email}`, context);
  }

  /**
   * Log inventory adjustment
   */
  logInventoryAdjustment(
    sku: string,
    quantityBefore: number,
    quantityAfter: number,
    reason: string,
    userId: string
  ): void {
    const context = {
      sku,
      quantityBefore,
      quantityAfter,
      quantityChange: quantityAfter - quantityBefore,
      reason,
      userId,
      category: 'inventory_adjustment',
    };

    this.info(`Inventory adjusted for SKU: ${sku}`, context);
  }

  /**
   * Log price change
   */
  logPriceChange(
    sku: string,
    oldPrice: number,
    newPrice: number,
    supplierId?: string,
    isSignificant?: boolean
  ): void {
    const context: Record<string, any> = {
      sku,
      oldPrice,
      newPrice,
      priceChange: newPrice - oldPrice,
      percentageChange: ((newPrice - oldPrice) / oldPrice * 100).toFixed(2),
      category: 'price_change',
    };

    if (supplierId) {
      context.supplierId = supplierId;
    }

    if (isSignificant) {
      context.significant = true;
    }

    const level = isSignificant ? LogLevel.WARN : LogLevel.INFO;
    const message = `Price change for SKU: ${sku}`;

    if (level === LogLevel.WARN) {
      this.warn(message, context);
    } else {
      this.info(message, context);
    }
  }
}

/**
 * Export a default logger instance for convenience
 */
export const logger = Logger.getInstance();

/**
 * Configure logger for different environments
 */
export function configureLogger(environment: 'development' | 'production' | 'test'): void {
  const logger = Logger.getInstance();
  
  switch (environment) {
    case 'development':
      logger.setMinLevel(LogLevel.DEBUG);
      break;
    case 'production':
      logger.setMinLevel(LogLevel.INFO);
      break;
    case 'test':
      logger.setMinLevel(LogLevel.WARN);
      break;
  }
}

/**
 * Structured logging system for observability
 * Provides consistent logging format for system events
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum LogEvent {
  MESSAGE_SENT = 'message_sent',
  MESSAGE_FAILED = 'message_failed',
  RETRY_TRIGGERED = 'retry_triggered',
  QUEUE_PAUSED = 'queue_paused',
  QUEUE_RESUMED = 'queue_resumed',
  API_ERROR = 'api_error',
  CAMPAIGN_STARTED = 'campaign_started',
  CAMPAIGN_COMPLETED = 'campaign_completed',
  CAMPAIGN_FAILED = 'campaign_failed',
  WEBHOOK_RECEIVED = 'webhook_received',
  WEBHOOK_PROCESSED = 'webhook_processed',
  WEBHOOK_FAILED = 'webhook_failed',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
}

export interface LogEntry {
  timestamp?: string;
  level: LogLevel;
  event: LogEvent;
  campaignId?: string;
  recipient?: string;
  status?: string;
  error?: string;
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private static instance: StructuredLogger;

  private constructor() {}

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private log(entry: LogEntry): void {
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    // In production, this would go to a proper logging service
    // For now, we'll use console with structured output
    const logString = JSON.stringify(logEntry);

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.DEBUG:
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  }

  debug(event: LogEvent, metadata?: Record<string, any>): void {
    this.log({
      level: LogLevel.DEBUG,
      event,
      metadata,
    });
  }

  info(event: LogEvent, metadata?: Record<string, any>): void {
    this.log({
      level: LogLevel.INFO,
      event,
      metadata,
    });
  }

  warn(event: LogEvent, metadata?: Record<string, any>): void {
    this.log({
      level: LogLevel.WARN,
      event,
      metadata,
    });
  }

  error(event: LogEvent, error?: string | Error, metadata?: Record<string, any>): void {
    this.log({
      level: LogLevel.ERROR,
      event,
      error: error instanceof Error ? error.message : error,
      metadata,
    });
  }

  messageSent(campaignId: string, recipient: string, metaMessageId: string): void {
    this.info(LogEvent.MESSAGE_SENT, {
      campaignId,
      recipient,
      metaMessageId,
    });
  }

  messageFailed(campaignId: string, recipient: string, error: string, attempts?: number): void {
    this.error(LogEvent.MESSAGE_FAILED, error, {
      campaignId,
      recipient,
      attempts,
    });
  }

  retryTriggered(campaignId: string, recipient: string, attempt: number, error: string): void {
    this.warn(LogEvent.RETRY_TRIGGERED, {
      campaignId,
      recipient,
      attempt,
      error,
    });
  }

  queuePaused(campaignId: string, reason: string): void {
    this.warn(LogEvent.QUEUE_PAUSED, {
      campaignId,
      reason,
    });
  }

  queueResumed(campaignId: string): void {
    this.info(LogEvent.QUEUE_RESUMED, {
      campaignId,
    });
  }

  apiError(endpoint: string, error: string, statusCode?: number): void {
    this.error(LogEvent.API_ERROR, error, {
      endpoint,
      statusCode,
    });
  }

  campaignStarted(campaignId: string, totalRecipients: number): void {
    this.info(LogEvent.CAMPAIGN_STARTED, {
      campaignId,
      totalRecipients,
    });
  }

  campaignCompleted(campaignId: string, sent: number, failed: number): void {
    this.info(LogEvent.CAMPAIGN_COMPLETED, {
      campaignId,
      sent,
      failed,
    });
  }

  campaignFailed(campaignId: string, error: string): void {
    this.error(LogEvent.CAMPAIGN_FAILED, error, {
      campaignId,
    });
  }

  webhookReceived(metaMessageId: string, status: string): void {
    this.debug(LogEvent.WEBHOOK_RECEIVED, {
      metaMessageId,
      status,
    });
  }

  webhookProcessed(metaMessageId: string, newStatus: string): void {
    this.info(LogEvent.WEBHOOK_PROCESSED, {
      metaMessageId,
      newStatus,
    });
  }

  webhookFailed(metaMessageId: string, error: string): void {
    this.error(LogEvent.WEBHOOK_FAILED, error, {
      metaMessageId,
    });
  }

  cacheHit(key: string): void {
    this.debug(LogEvent.CACHE_HIT, {
      key,
    });
  }

  cacheMiss(key: string): void {
    this.debug(LogEvent.CACHE_MISS, {
      key,
    });
  }

  rateLimitExceeded(tenantId: string, limit: number): void {
    this.warn(LogEvent.RATE_LIMIT_EXCEEDED, {
      tenantId,
      limit,
    });
  }
}

export const logger = StructuredLogger.getInstance();

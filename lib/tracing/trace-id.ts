/**
 * Request Tracing ID System
 * Provides unique trace IDs for request correlation and observability
 */

import crypto from 'crypto';

/**
 * Generate a unique trace ID
 * Format: {timestamp}-{random}
 * Example: 20260618-8a3b2c1d-4e5f6g7h
 */
export function generateTraceId(): string {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * Extract trace ID from headers
 * @param headers - Request headers
 * @returns Trace ID or undefined if not present
 */
export function extractTraceId(headers: Headers): string | undefined {
  return headers.get('x-trace-id') || headers.get('trace-id') || undefined;
}

/**
 * Validate trace ID format
 * @param traceId - Trace ID to validate
 * @returns True if valid
 */
export function isValidTraceId(traceId: string): boolean {
  // Basic validation: should be alphanumeric with hyphens
  return /^[a-zA-Z0-9-]{20,50}$/.test(traceId);
}

/**
 * Create trace context object
 * @param traceId - Trace ID
 * @param parentId - Parent span ID (for nested tracing)
 * @returns Trace context
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentId?: string;
  timestamp: string;
}

export function createTraceContext(
  traceId?: string,
  parentId?: string
): TraceContext {
  const id = traceId || generateTraceId();
  const spanId = crypto.randomBytes(8).toString('hex');
  
  return {
    traceId: id,
    spanId,
    parentId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Add trace ID to headers
 * @param headers - Headers object
 * @param traceId - Trace ID to add
 * @returns Headers with trace ID
 */
export function addTraceIdToHeaders(
  headers: Headers,
  traceId: string
): Headers {
  headers.set('x-trace-id', traceId);
  return headers;
}

/**
 * Create child span from parent context
 * @param parentContext - Parent trace context
 * @returns Child trace context
 */
export function createChildSpan(parentContext: TraceContext): TraceContext {
  return createTraceContext(parentContext.traceId, parentContext.spanId);
}

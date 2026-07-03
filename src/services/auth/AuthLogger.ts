/**
 * Authentication Logging Service
 * 
 * Logs all authentication attempts including successes and failures
 * with IP addresses and timestamps for security auditing.
 * 
 * Requirements: 19.5 - THE System SHALL log all authentication attempts 
 * including failures with IP address and timestamp
 */

import type { Firestore, Timestamp } from 'firebase/firestore';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Type of authentication event
 */
export type AuthEventType = 
  | 'login_success' 
  | 'login_failure' 
  | 'logout' 
  | 'token_refresh' 
  | 'account_locked';

/**
 * Authentication log entry
 */
export interface AuthLogEntry {
  eventType: AuthEventType;
  email: string;
  userId?: string; // Only present for successful events
  ipAddress: string;
  userAgent?: string;
  timestamp: Timestamp;
  failureReason?: string; // Only present for failures
  metadata?: Record<string, any>; // Additional context
}

/**
 * Authentication Logger Service
 * 
 * Provides methods to log authentication events with IP tracking
 * for security auditing and compliance.
 */
export class AuthLogger {
  private firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  /**
   * Log a successful login attempt
   * 
   * @param email - User email
   * @param userId - User ID
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent string
   */
  async logLoginSuccess(
    email: string,
    userId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'login_success',
      email,
      userId,
      ipAddress,
      userAgent,
      timestamp: serverTimestamp() as Timestamp,
    });
  }

  /**
   * Log a failed login attempt
   * 
   * Requirements: 19.5 - Log authentication failures with IP and timestamp
   * 
   * @param email - Attempted email
   * @param ipAddress - Client IP address
   * @param failureReason - Reason for failure
   * @param userAgent - Client user agent string
   */
  async logLoginFailure(
    email: string,
    ipAddress: string,
    failureReason: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'login_failure',
      email,
      ipAddress,
      failureReason,
      userAgent,
      timestamp: serverTimestamp() as Timestamp,
    });
  }

  /**
   * Log a logout event
   * 
   * @param email - User email
   * @param userId - User ID
   * @param ipAddress - Client IP address
   */
  async logLogout(
    email: string,
    userId: string,
    ipAddress: string
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'logout',
      email,
      userId,
      ipAddress,
      timestamp: serverTimestamp() as Timestamp,
    });
  }

  /**
   * Log a token refresh event
   * 
   * @param email - User email
   * @param userId - User ID
   * @param ipAddress - Client IP address
   */
  async logTokenRefresh(
    email: string,
    userId: string,
    ipAddress: string
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'token_refresh',
      email,
      userId,
      ipAddress,
      timestamp: serverTimestamp() as Timestamp,
    });
  }

  /**
   * Log an account lockout event
   * 
   * @param email - User email
   * @param userId - User ID
   * @param ipAddress - Client IP address
   * @param failedAttempts - Number of failed attempts leading to lockout
   */
  async logAccountLocked(
    email: string,
    userId: string,
    ipAddress: string,
    failedAttempts: number
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'account_locked',
      email,
      userId,
      ipAddress,
      timestamp: serverTimestamp() as Timestamp,
      metadata: {
        failedAttempts,
      },
    });
  }

  /**
   * Write authentication log entry to Firestore
   * 
   * @param entry - Log entry to write
   */
  private async logAuthEvent(entry: AuthLogEntry): Promise<void> {
    try {
      const authLogsCollection = collection(this.firestore, 'auth_logs');
      await addDoc(authLogsCollection, entry);
    } catch (error) {
      // Log to console but don't throw - logging failures shouldn't break auth flow
      console.error('Failed to log authentication event:', error);
    }
  }

  /**
   * Extract IP address from request
   * 
   * Checks multiple headers to find the real client IP,
   * accounting for proxies and load balancers.
   * 
   * @param request - HTTP request object
   * @returns Client IP address
   */
  static extractIPAddress(request: Request): string {
    // Check common proxy headers first
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first (client)
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    // Fallback to direct connection IP (may be proxy IP)
    // In Astro, we need to use clientAddress from context
    return 'unknown';
  }

  /**
   * Extract user agent from request
   * 
   * @param request - HTTP request object
   * @returns User agent string
   */
  static extractUserAgent(request: Request): string | undefined {
    return request.headers.get('user-agent') || undefined;
  }
}

/**
 * Helper to get IP address from Astro context
 * 
 * @param context - Astro request context
 * @returns Client IP address
 */
export function getClientIP(context: any): string {
  // Astro provides clientAddress in the context
  if (context.clientAddress) {
    return context.clientAddress;
  }

  // Fallback to header extraction
  return AuthLogger.extractIPAddress(context.request);
}

/**
 * POS Service Module Exports
 * 
 * Provides public API for point-of-sale operations.
 */

export { POSService, posService } from './POSService';
export { OfflineQueue, offlineQueue } from './OfflineQueue';
export type { QueueStatus } from './OfflineQueue';
export type { ProductPOS, POSTransaction, POSTransactionDraft, DateRange } from '../../types/models';

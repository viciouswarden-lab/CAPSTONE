/**
 * Receiving Service Module Exports
 * 
 * Provides receiving operations including record creation, line item management,
 * variance detection, and inventory updates.
 */

export { ReceivingService, receivingService } from './ReceivingService';
export type {
  CreateReceivingParams,
  VarianceResult,
  ReceivingRecordFilter,
} from './ReceivingService';

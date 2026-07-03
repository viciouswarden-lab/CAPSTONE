/**
 * PriceMonitorService Tests
 * 
 * Tests for price change detection, notification processing, and dashboard metrics updates.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { PricelistData } from '../../types/models';

// Mock Firebase Firestore at the top level
vi.mock('firebase/firestore', () => {
  const mockAddDoc = vi.fn();
  const mockRunTransaction = vi.fn();
  const mockDoc = vi.fn();
  const mockCollection = vi.fn();
  const mockQuery = vi.fn();
  const mockWhere = vi.fn();
  const mockOrderBy = vi.fn();
  const mockGetDocs = vi.fn();
  const mockFirestoreLimit = vi.fn();

  return {
    collection: mockCollection,
    addDoc: mockAddDoc,
    runTransaction: mockRunTransaction,
    doc: mockDoc,
    query: mockQuery,
    where: mockWhere,
    orderBy: mockOrderBy,
    getDocs: mockGetDocs,
    limit: mockFirestoreLimit,
    Timestamp: {
      fromDate: (date: Date) => ({
        toDate: () => date,
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
      }),
    },
  };
});

import { PriceMonitorService } from './PriceMonitorService';
import { collection, addDoc, runTransaction, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

// Get mocked functions
const mockAddDoc = addDoc as Mock;
const mockRunTransaction = runTransaction as Mock;
const mockDoc = doc as Mock;
const mockCollection = collection as Mock;

// Mock Firestore instance
const mockFirestore = {} as Firestore;

// Mock console.log to verify notifications
const originalConsoleLog = console.log;
let consoleLogSpy: Mock;

describe('PriceMonitorService - Notification and Dashboard Metrics', () => {
  let service: PriceMonitorService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup console spy
    consoleLogSpy = vi.fn();
    console.log = consoleLogSpy;
    
    // Setup default mock implementations
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
    
    service = new PriceMonitorService(mockFirestore);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('detectPriceChanges with notifications', () => {
    it('should process notifications and update dashboard metrics for significant changes', async () => {
      // Arrange
      const newPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-15'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 120 },
          { supplierCode: 'PROD002', description: 'Product 2', price: 55 },
        ],
      };

      const previousPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-01'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 100 }, // 20% increase
          { supplierCode: 'PROD002', description: 'Product 2', price: 50 },  // 10% increase
        ],
      };

      // Mock addDoc to return document references with IDs
      mockAddDoc.mockImplementation(() => {
        return Promise.resolve({ id: `change_${Math.random()}` });
      });

      // Mock runTransaction for dashboard metrics update
      mockRunTransaction.mockImplementation(async (db: any, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => false,
            data: () => null,
          }),
          set: vi.fn(),
        };
        await callback(mockTransaction);
      });

      // Act
      const changes = await service.detectPriceChanges(
        newPricelist,
        previousPricelist,
        'pricelist_new',
        'pricelist_old'
      );

      // Assert - price changes detected
      expect(changes).toHaveLength(2);
      expect(changes[0].percentageChange).toBe(20);
      expect(changes[0].isSignificant).toBe(true);
      expect(changes[1].percentageChange).toBe(10);
      expect(changes[1].isSignificant).toBe(false);

      // Assert - notifications sent for significant changes only
      const notificationLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] === 'PRICE ALERT:'
      );
      expect(notificationLogs).toHaveLength(1);

      // Verify notification content
      const notification = JSON.parse(notificationLogs[0][1]);
      expect(notification.type).toBe('significant_price_increase');
      expect(notification.title).toContain('PROD001');
      expect(notification.message).toContain('20.00%');
      expect(notification.metadata.oldPrice).toBe(100);
      expect(notification.metadata.newPrice).toBe(120);

      // Assert - dashboard metrics updated
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    it('should not process notifications when no significant changes exist', async () => {
      // Arrange
      const newPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-15'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 105 },
        ],
      };

      const previousPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-01'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 100 }, // 5% increase
        ],
      };

      mockAddDoc.mockResolvedValue({ id: 'change_1' });

      // Act
      const changes = await service.detectPriceChanges(
        newPricelist,
        previousPricelist,
        'pricelist_new',
        'pricelist_old'
      );

      // Assert
      expect(changes).toHaveLength(1);
      expect(changes[0].isSignificant).toBe(false);

      // No notifications should be sent
      const notificationLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] === 'PRICE ALERT:'
      );
      expect(notificationLogs).toHaveLength(0);

      // Dashboard metrics should not be updated
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('should handle multiple significant changes in the same month', async () => {
      // Arrange
      const newPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-15'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 150 },
          { supplierCode: 'PROD002', description: 'Product 2', price: 80 },
          { supplierCode: 'PROD003', description: 'Product 3', price: 220 },
        ],
      };

      const previousPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-01'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 100 }, // 50% increase
          { supplierCode: 'PROD002', description: 'Product 2', price: 70 },  // 14.29% increase
          { supplierCode: 'PROD003', description: 'Product 3', price: 200 }, // 10% increase (not significant)
        ],
      };

      mockAddDoc.mockImplementation(() => {
        return Promise.resolve({ id: `change_${Math.random()}` });
      });

      mockRunTransaction.mockImplementation(async (db: any, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => false,
            data: () => null,
          }),
          set: vi.fn(),
        };
        await callback(mockTransaction);
      });

      // Act
      const changes = await service.detectPriceChanges(
        newPricelist,
        previousPricelist,
        'pricelist_new',
        'pricelist_old'
      );

      // Assert
      expect(changes).toHaveLength(3);
      
      const significantChanges = changes.filter(c => c.isSignificant);
      expect(significantChanges).toHaveLength(2);

      // Verify notifications for both significant changes
      const notificationLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] === 'PRICE ALERT:'
      );
      expect(notificationLogs).toHaveLength(2);

      // Verify dashboard metrics creation
      const dashboardLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] && call[0].includes && call[0].includes('Created dashboard metrics')
      );
      expect(dashboardLogs).toHaveLength(1);
      expect(dashboardLogs[0][0]).toContain('2024-01');
      expect(dashboardLogs[0][0]).toContain('with 2 changes');
    });

    it('should update existing dashboard metrics without duplicates', async () => {
      // Arrange
      const newPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-20'),
        items: [
          { supplierCode: 'PROD004', description: 'Product 4', price: 130 },
        ],
      };

      const previousPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2024-01-15'),
        items: [
          { supplierCode: 'PROD004', description: 'Product 4', price: 100 }, // 30% increase
        ],
      };

      mockAddDoc.mockResolvedValue({ id: 'change_PROD004' });

      // Mock existing dashboard metrics
      mockRunTransaction.mockImplementation(async (db: any, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              metricId: '2024-01',
              month: '2024-01',
              significantPriceIncreases: {
                count: 2,
                changes: [
                  { changeId: 'change_PROD001', sku: 'PROD001' },
                  { changeId: 'change_PROD002', sku: 'PROD002' },
                ],
              },
              lastUpdated: { toDate: () => new Date('2024-01-15') },
            }),
          }),
          set: vi.fn(),
        };
        await callback(mockTransaction);
      });

      // Act
      await service.detectPriceChanges(
        newPricelist,
        previousPricelist,
        'pricelist_new',
        'pricelist_old'
      );

      // Assert - dashboard metrics updated (not duplicated)
      const dashboardLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] && call[0].includes && call[0].includes('Updated dashboard metrics')
      );
      expect(dashboardLogs).toHaveLength(1);
      expect(dashboardLogs[0][0]).toContain('2024-01');
      expect(dashboardLogs[0][0]).toContain('with 1 new changes');
    });

    it('should handle price changes across different months', async () => {
      // Arrange
      const decemberPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2023-12-15'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 120 },
        ],
      };

      const novemberPricelist: PricelistData = {
        supplierId: 'SUP001',
        uploadDate: new Date('2023-11-15'),
        items: [
          { supplierCode: 'PROD001', description: 'Product 1', price: 100 }, // 20% increase
        ],
      };

      mockAddDoc.mockResolvedValue({ id: 'change_dec' });

      mockRunTransaction.mockImplementation(async (db: any, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => false,
            data: () => null,
          }),
          set: vi.fn(),
        };
        await callback(mockTransaction);
      });

      // Act
      await service.detectPriceChanges(
        decemberPricelist,
        novemberPricelist,
        'pricelist_dec',
        'pricelist_nov'
      );

      // Assert - December metrics created
      const dashboardLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] && call[0].includes && call[0].includes('Created dashboard metrics')
      );
      expect(dashboardLogs).toHaveLength(1);
      expect(dashboardLogs[0][0]).toContain('2023-12');
    });
  });
});

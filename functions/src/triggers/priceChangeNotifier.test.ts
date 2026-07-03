/**
 * Tests for Price Change Notification Cloud Function
 * 
 * Requirements: 6.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processPriceChangeNotification } from './priceChangeNotifier.js';
import type { FirestoreEvent } from 'firebase-functions/v2/firestore';
import type { Firestore, Timestamp, DocumentSnapshot } from 'firebase-admin/firestore';

// Mock Firestore Timestamp
function createTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000,
  } as Timestamp;
}

describe('Price Change Notification Function', () => {
  let mockFirestore: Firestore;
  let mockTransaction: any;
  let mockDocRef: any;
  let mockCollectionRef: any;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Mock transaction
    mockTransaction = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    };
    
    // Mock document reference
    mockDocRef = {
      id: 'test-doc-id',
    };
    
    // Mock collection reference
    mockCollectionRef = {
      doc: vi.fn(() => mockDocRef),
      add: vi.fn(() => Promise.resolve(mockDocRef)),
    };
    
    // Mock Firestore instance
    mockFirestore = {
      collection: vi.fn(() => mockCollectionRef),
      runTransaction: vi.fn((callback) => callback(mockTransaction)),
    } as any;
  });

  describe('Significant Price Change Detection', () => {
    it('should process significant price increase and update dashboard metrics', async () => {
      // Arrange
      const changeDate = new Date('2024-01-15T10:00:00Z');
      const priceChange = {
        changeId: 'change-001',
        sku: 'SKU-123',
        supplierId: 'supplier-001',
        oldPrice: 100,
        newPrice: 120,
        absoluteChange: 20,
        percentageChange: 20, // Significant (>10%)
        changeDate: createTimestamp(changeDate),
        isSignificant: true,
        oldPricelistId: 'pricelist-001',
        newPricelistId: 'pricelist-002',
      };

      const mockSnapshot = {
        data: () => priceChange,
      } as unknown as DocumentSnapshot;

      const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
        data: mockSnapshot,
        params: { changeId: 'change-001' },
        id: 'event-001',
        location: 'us-central1',
        project: 'test-project',
        time: changeDate.toISOString(),
      } as any;

      // Mock empty metrics document (first significant change of the month)
      mockTransaction.get.mockResolvedValue({
        exists: false,
      });

      // Act
      await processPriceChangeNotification(mockEvent, mockFirestore);

      // Assert
      expect(mockFirestore.collection).toHaveBeenCalledWith('dashboard_metrics');
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('2024-01');
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          metricId: '2024-01',
          month: '2024-01',
          significantPriceIncreases: {
            count: 1,
            changes: [
              expect.objectContaining({
                changeId: 'change-001',
                sku: 'SKU-123',
                supplierId: 'supplier-001',
                oldPrice: 100,
                newPrice: 120,
                percentageChange: 20,
              }),
            ],
          },
        })
      );
    });

    it('should update existing dashboard metrics when adding another significant change', async () => {
      // Arrange
      const changeDate = new Date('2024-01-15T10:00:00Z');
      const priceChange = {
        changeId: 'change-002',
        sku: 'SKU-456',
        supplierId: 'supplier-002',
        oldPrice: 50,
        newPrice: 60,
        absoluteChange: 10,
        percentageChange: 20,
        changeDate: createTimestamp(changeDate),
        isSignificant: true,
        oldPricelistId: 'pricelist-003',
        newPricelistId: 'pricelist-004',
      };

      const mockSnapshot = {
        data: () => priceChange,
      } as unknown as DocumentSnapshot;

      const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
        data: mockSnapshot,
        params: { changeId: 'change-002' },
        id: 'event-002',
        location: 'us-central1',
        project: 'test-project',
        time: changeDate.toISOString(),
      } as any;

      // Mock existing metrics document
      const existingMetrics = {
        metricId: '2024-01',
        month: '2024-01',
        significantPriceIncreases: {
          count: 1,
          changes: [
            {
              changeId: 'change-001',
              sku: 'SKU-123',
              supplierId: 'supplier-001',
              oldPrice: 100,
              newPrice: 120,
              percentageChange: 20,
              changeDate: createTimestamp(new Date('2024-01-10T10:00:00Z')),
            },
          ],
        },
        lastUpdated: createTimestamp(new Date('2024-01-10T10:00:00Z')),
      };

      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => existingMetrics,
      });

      // Act
      await processPriceChangeNotification(mockEvent, mockFirestore);

      // Assert
      expect(mockTransaction.update).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          'significantPriceIncreases.count': 2,
          'significantPriceIncreases.changes': expect.arrayContaining([
            expect.objectContaining({ changeId: 'change-001' }),
            expect.objectContaining({ changeId: 'change-002' }),
          ]),
        })
      );
    });

    it('should not duplicate price changes in dashboard metrics (idempotency)', async () => {
      // Arrange
      const changeDate = new Date('2024-01-15T10:00:00Z');
      const priceChange = {
        changeId: 'change-001',
        sku: 'SKU-123',
        supplierId: 'supplier-001',
        oldPrice: 100,
        newPrice: 120,
        absoluteChange: 20,
        percentageChange: 20,
        changeDate: createTimestamp(changeDate),
        isSignificant: true,
        oldPricelistId: 'pricelist-001',
        newPricelistId: 'pricelist-002',
      };

      const mockSnapshot = {
        data: () => priceChange,
      } as unknown as DocumentSnapshot;

      const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
        data: mockSnapshot,
        params: { changeId: 'change-001' },
        id: 'event-001',
        location: 'us-central1',
        project: 'test-project',
        time: changeDate.toISOString(),
      } as any;

      // Mock existing metrics document that already contains this change
      const existingMetrics = {
        metricId: '2024-01',
        month: '2024-01',
        significantPriceIncreases: {
          count: 1,
          changes: [
            {
              changeId: 'change-001', // Same changeId
              sku: 'SKU-123',
              supplierId: 'supplier-001',
              oldPrice: 100,
              newPrice: 120,
              percentageChange: 20,
              changeDate: createTimestamp(changeDate),
            },
          ],
        },
        lastUpdated: createTimestamp(changeDate),
      };

      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => existingMetrics,
      });

      // Act
      await processPriceChangeNotification(mockEvent, mockFirestore);

      // Assert - should NOT call update since change is already recorded
      expect(mockTransaction.update).not.toHaveBeenCalled();
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  describe('Non-Significant Price Changes', () => {
    it('should not update dashboard metrics for non-significant changes', async () => {
      // Arrange
      const changeDate = new Date('2024-01-15T10:00:00Z');
      const priceChange = {
        changeId: 'change-003',
        sku: 'SKU-789',
        supplierId: 'supplier-003',
        oldPrice: 100,
        newPrice: 105,
        absoluteChange: 5,
        percentageChange: 5, // Not significant (<=10%)
        changeDate: createTimestamp(changeDate),
        isSignificant: false,
        oldPricelistId: 'pricelist-005',
        newPricelistId: 'pricelist-006',
      };

      const mockSnapshot = {
        data: () => priceChange,
      } as unknown as DocumentSnapshot;

      const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
        data: mockSnapshot,
        params: { changeId: 'change-003' },
        id: 'event-003',
        location: 'us-central1',
        project: 'test-project',
        time: changeDate.toISOString(),
      } as any;

      // Act
      await processPriceChangeNotification(mockEvent, mockFirestore);

      // Assert - should NOT update dashboard metrics
      expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
      expect(mockTransaction.set).not.toHaveBeenCalled();
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing price change data gracefully', async () => {
      // Arrange
      const mockSnapshot = {
        data: () => undefined,
      } as unknown as DocumentSnapshot;

      const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
        data: mockSnapshot,
        params: { changeId: 'change-004' },
        id: 'event-004',
        location: 'us-central1',
        project: 'test-project',
        time: new Date().toISOString(),
      } as any;

      // Act & Assert - should not throw
      await expect(
        processPriceChangeNotification(mockEvent, mockFirestore)
      ).resolves.not.toThrow();
    });

    it('should log errors when dashboard update fails', async () => {
      // Arrange
      const changeDate = new Date('2024-01-15T10:00:00Z');
      const priceChange = {
        changeId: 'change-005',
        sku: 'SKU-999',
        supplierId: 'supplier-004',
        oldPrice: 100,
        newPrice: 150,
        absoluteChange: 50,
        percentageChange: 50,
        changeDate: createTimestamp(changeDate),
        isSignificant: true,
        oldPricelistId: 'pricelist-007',
        newPricelistId: 'pricelist-008',
      };

      const mockSnapshot = {
        data: () => priceChange,
      } as unknown as DocumentSnapshot;

      const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
        data: mockSnapshot,
        params: { changeId: 'change-005' },
        id: 'event-005',
        location: 'us-central1',
        project: 'test-project',
        time: changeDate.toISOString(),
      } as any;

      // Mock transaction failure
      const transactionError = new Error('Transaction failed');
      mockFirestore.runTransaction = vi.fn(() => Promise.reject(transactionError));

      // Act & Assert - should not throw, but should log error
      await expect(
        processPriceChangeNotification(mockEvent, mockFirestore)
      ).resolves.not.toThrow();

      // Verify error was logged
      expect(mockFirestore.collection).toHaveBeenCalledWith('notification_errors');
      expect(mockCollectionRef.add).toHaveBeenCalledWith(
        expect.objectContaining({
          changeId: 'change-005',
          error: 'Transaction failed',
        })
      );
    });
  });

  describe('Month Key Generation', () => {
    it('should generate correct month key for different months', async () => {
      // Test cases for different months
      const testCases = [
        { date: new Date('2024-01-15T10:00:00Z'), expectedMonth: '2024-01' },
        { date: new Date('2024-12-15T10:00:00Z'), expectedMonth: '2024-12' },
        { date: new Date('2025-03-01T00:00:00Z'), expectedMonth: '2025-03' },
      ];

      for (const testCase of testCases) {
        // Reset mocks for each test case
        vi.clearAllMocks();
        
        // Recreate mock objects
        mockTransaction = {
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
        };
        
        mockDocRef = {
          id: 'test-doc-id',
        };
        
        mockCollectionRef = {
          doc: vi.fn(() => mockDocRef),
          add: vi.fn(() => Promise.resolve(mockDocRef)),
        };
        
        mockFirestore = {
          collection: vi.fn(() => mockCollectionRef),
          runTransaction: vi.fn((callback) => callback(mockTransaction)),
        } as any;
        
        // Arrange
        const priceChange = {
          changeId: `change-${testCase.date.getTime()}`,
          sku: 'SKU-TEST',
          supplierId: 'supplier-test',
          oldPrice: 100,
          newPrice: 120,
          absoluteChange: 20,
          percentageChange: 20,
          changeDate: createTimestamp(testCase.date),
          isSignificant: true,
          oldPricelistId: 'pricelist-old',
          newPricelistId: 'pricelist-new',
        };

        const mockSnapshot = {
          data: () => priceChange,
        } as unknown as DocumentSnapshot;

        const mockEvent: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }> = {
          data: mockSnapshot,
          params: { changeId: priceChange.changeId },
          id: `event-${testCase.date.getTime()}`,
          location: 'us-central1',
          project: 'test-project',
          time: testCase.date.toISOString(),
        } as any;

        mockTransaction.get.mockResolvedValue({ exists: false });

        // Act
        await processPriceChangeNotification(mockEvent, mockFirestore);

        // Assert
        expect(mockCollectionRef.doc).toHaveBeenCalledWith(testCase.expectedMonth);
      }
    });
  });
});


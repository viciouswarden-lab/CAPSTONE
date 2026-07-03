/**
 * Unit tests for Low Stock Alert Cloud Function
 * 
 * Tests the logic for generating and resolving low stock alerts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processLowStockAlert } from './lowStockAlert.js';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Mock Firestore
const mockFirestore = {
  collection: vi.fn(),
};

// Helper to create mock Firestore event
function createMockInventoryEvent(
  inventoryData: any,
  inventoryId: string = 'TEST-SKU-001_LOC-001'
): FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { inventoryId: string }> {
  return {
    data: {
      after: {
        data: () => inventoryData,
        exists: true,
      } as QueryDocumentSnapshot,
      before: {} as QueryDocumentSnapshot,
    } as Change<QueryDocumentSnapshot>,
    params: { inventoryId },
    id: 'test-event-id',
    type: 'google.cloud.firestore.document.v1.updated',
    source: `projects/test/databases/(default)/documents/inventory/${inventoryId}`,
    subject: `documents/inventory/${inventoryId}`,
    time: new Date().toISOString(),
  } as any;
}

// Helper to create mock product document
function createMockProductDoc(productData: any, exists: boolean = true) {
  return {
    exists,
    data: () => productData,
  };
}

// Helper to create mock alert document
function createMockAlertDoc(alertData: any, exists: boolean = true) {
  return {
    exists,
    data: () => alertData,
  };
}

describe('Low Stock Alert Cloud Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processLowStockAlert', () => {
    it('should generate alert when quantity falls below reorder point', async () => {
      // Arrange
      const inventoryData = {
        inventoryId: 'TEST-SKU-001_LOC-001',
        sku: 'TEST-SKU-001',
        locationId: 'LOC-001',
        quantityOnHand: 5,
        lastUpdated: new Date(),
        lastTransactionId: 'TXN-001',
      };

      const productData = {
        sku: 'TEST-SKU-001',
        description: 'Test Product',
        category: 'Test',
        unitOfMeasure: 'EA',
        reorderPoint: 10,
        isActive: true,
      };

      const mockProductRef = {
        get: vi.fn().mockResolvedValue(createMockProductDoc(productData)),
      };

      const mockAlertRef = {
        get: vi.fn().mockResolvedValue(createMockAlertDoc(null, false)),
        set: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'products') {
          return { doc: () => mockProductRef };
        }
        if (collectionName === 'low_stock_alerts') {
          return { doc: () => mockAlertRef };
        }
        return { doc: vi.fn() };
      });

      const event = createMockInventoryEvent(inventoryData);

      // Act
      await processLowStockAlert(event, mockFirestore as any);

      // Assert
      expect(mockProductRef.get).toHaveBeenCalled();
      expect(mockAlertRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          alertId: 'TEST-SKU-001_LOC-001',
          sku: 'TEST-SKU-001',
          locationId: 'LOC-001',
          currentQuantity: 5,
          reorderPoint: 10,
          status: 'active',
        })
      );
    });

    it('should NOT generate alert when quantity is at or above reorder point', async () => {
      // Arrange
      const inventoryData = {
        inventoryId: 'TEST-SKU-002_LOC-001',
        sku: 'TEST-SKU-002',
        locationId: 'LOC-001',
        quantityOnHand: 15,
        lastUpdated: new Date(),
        lastTransactionId: 'TXN-002',
      };

      const productData = {
        sku: 'TEST-SKU-002',
        description: 'Test Product 2',
        category: 'Test',
        unitOfMeasure: 'EA',
        reorderPoint: 10,
        isActive: true,
      };

      const mockProductRef = {
        get: vi.fn().mockResolvedValue(createMockProductDoc(productData)),
      };

      const mockAlertRef = {
        get: vi.fn().mockResolvedValue(createMockAlertDoc(null, false)),
        set: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'products') {
          return { doc: () => mockProductRef };
        }
        if (collectionName === 'low_stock_alerts') {
          return { doc: () => mockAlertRef };
        }
        return { doc: vi.fn() };
      });

      const event = createMockInventoryEvent(inventoryData, 'TEST-SKU-002_LOC-001');

      // Act
      await processLowStockAlert(event, mockFirestore as any);

      // Assert
      expect(mockProductRef.get).toHaveBeenCalled();
      expect(mockAlertRef.set).not.toHaveBeenCalled();
    });

    it('should resolve alert when quantity increases above reorder point', async () => {
      // Arrange
      const inventoryData = {
        inventoryId: 'TEST-SKU-003_LOC-001',
        sku: 'TEST-SKU-003',
        locationId: 'LOC-001',
        quantityOnHand: 20,
        lastUpdated: new Date(),
        lastTransactionId: 'TXN-003',
      };

      const productData = {
        sku: 'TEST-SKU-003',
        description: 'Test Product 3',
        category: 'Test',
        unitOfMeasure: 'EA',
        reorderPoint: 10,
        isActive: true,
      };

      const existingAlertData = {
        alertId: 'TEST-SKU-003_LOC-001',
        sku: 'TEST-SKU-003',
        locationId: 'LOC-001',
        currentQuantity: 5,
        reorderPoint: 10,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockProductRef = {
        get: vi.fn().mockResolvedValue(createMockProductDoc(productData)),
      };

      const mockAlertRef = {
        get: vi.fn().mockResolvedValue(createMockAlertDoc(existingAlertData)),
        update: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'products') {
          return { doc: () => mockProductRef };
        }
        if (collectionName === 'low_stock_alerts') {
          return { doc: () => mockAlertRef };
        }
        return { doc: vi.fn() };
      });

      const event = createMockInventoryEvent(inventoryData, 'TEST-SKU-003_LOC-001');

      // Act
      await processLowStockAlert(event, mockFirestore as any);

      // Assert
      expect(mockAlertRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
        })
      );
    });

    it('should skip alert check for inactive products', async () => {
      // Arrange
      const inventoryData = {
        inventoryId: 'TEST-SKU-004_LOC-001',
        sku: 'TEST-SKU-004',
        locationId: 'LOC-001',
        quantityOnHand: 5,
        lastUpdated: new Date(),
        lastTransactionId: 'TXN-004',
      };

      const productData = {
        sku: 'TEST-SKU-004',
        description: 'Inactive Product',
        category: 'Test',
        unitOfMeasure: 'EA',
        reorderPoint: 10,
        isActive: false, // Inactive product
      };

      const mockProductRef = {
        get: vi.fn().mockResolvedValue(createMockProductDoc(productData)),
      };

      const mockAlertRef = {
        set: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'products') {
          return { doc: () => mockProductRef };
        }
        if (collectionName === 'low_stock_alerts') {
          return { doc: () => mockAlertRef };
        }
        return { doc: vi.fn() };
      });

      const event = createMockInventoryEvent(inventoryData, 'TEST-SKU-004_LOC-001');

      // Act
      await processLowStockAlert(event, mockFirestore as any);

      // Assert
      expect(mockProductRef.get).toHaveBeenCalled();
      expect(mockAlertRef.set).not.toHaveBeenCalled();
    });

    it('should handle missing product gracefully', async () => {
      // Arrange
      const inventoryData = {
        inventoryId: 'MISSING-SKU_LOC-001',
        sku: 'MISSING-SKU',
        locationId: 'LOC-001',
        quantityOnHand: 5,
        lastUpdated: new Date(),
        lastTransactionId: 'TXN-005',
      };

      const mockProductRef = {
        get: vi.fn().mockResolvedValue(createMockProductDoc(null, false)),
      };

      const mockAlertRef = {
        set: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'products') {
          return { doc: () => mockProductRef };
        }
        if (collectionName === 'low_stock_alerts') {
          return { doc: () => mockAlertRef };
        }
        return { doc: vi.fn() };
      });

      const event = createMockInventoryEvent(inventoryData, 'MISSING-SKU_LOC-001');

      // Act
      await processLowStockAlert(event, mockFirestore as any);

      // Assert
      expect(mockProductRef.get).toHaveBeenCalled();
      expect(mockAlertRef.set).not.toHaveBeenCalled();
    });

    it('should update existing alert with new quantity', async () => {
      // Arrange
      const inventoryData = {
        inventoryId: 'TEST-SKU-005_LOC-001',
        sku: 'TEST-SKU-005',
        locationId: 'LOC-001',
        quantityOnHand: 3, // Updated quantity, still below reorder point
        lastUpdated: new Date(),
        lastTransactionId: 'TXN-006',
      };

      const productData = {
        sku: 'TEST-SKU-005',
        description: 'Test Product 5',
        category: 'Test',
        unitOfMeasure: 'EA',
        reorderPoint: 10,
        isActive: true,
      };

      const existingAlertData = {
        alertId: 'TEST-SKU-005_LOC-001',
        sku: 'TEST-SKU-005',
        locationId: 'LOC-001',
        currentQuantity: 7, // Old quantity
        reorderPoint: 10,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockProductRef = {
        get: vi.fn().mockResolvedValue(createMockProductDoc(productData)),
      };

      const mockAlertRef = {
        get: vi.fn().mockResolvedValue(createMockAlertDoc(existingAlertData)),
        update: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'products') {
          return { doc: () => mockProductRef };
        }
        if (collectionName === 'low_stock_alerts') {
          return { doc: () => mockAlertRef };
        }
        return { doc: vi.fn() };
      });

      const event = createMockInventoryEvent(inventoryData, 'TEST-SKU-005_LOC-001');

      // Act
      await processLowStockAlert(event, mockFirestore as any);

      // Assert
      expect(mockAlertRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          currentQuantity: 3,
          reorderPoint: 10,
          status: 'active',
        })
      );
    });
  });
});

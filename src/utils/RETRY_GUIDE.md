# Retry Utility Usage Guide

## Overview

The retry utility provides automatic retry logic with exponential backoff for transient failures. It's specifically designed for Firebase/Firestore operations and network requests.

**Requirement 18.4**: THE System SHALL implement automatic retry logic for transient network failures with exponential backoff

## Features

- ✅ **Exponential Backoff**: Automatically increases wait time between retries
- ✅ **Transient Error Detection**: Distinguishes between temporary and permanent errors
- ✅ **Jitter**: Adds randomization to prevent thundering herd problem
- ✅ **Configurable**: Fully customizable retry behavior
- ✅ **Type-Safe**: Full TypeScript support with generics
- ✅ **Pre-configured Wrappers**: Ready-to-use for Firestore and network operations

## Quick Start

### Using Pre-configured Wrappers

The simplest way to add retry logic is using the pre-configured wrappers:

```typescript
import { retryFirestore, retryNetwork } from '@/utils/retry';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';

// Firestore operations
await retryFirestore(async () => {
  const docRef = doc(db, 'products', productId);
  await setDoc(docRef, productData);
});

// Network requests
const data = await retryNetwork(async () => {
  const response = await fetch('https://api.example.com/data');
  return response.json();
});
```

### Using withRetry with Custom Configuration

For more control, use `withRetry` directly:

```typescript
import { withRetry } from '@/utils/retry';

const result = await withRetry(
  async () => {
    // Your operation here
    return await someOperation();
  },
  {
    maxRetries: 5,
    initialDelayMs: 500,
    backoffMultiplier: 2,
    maxDelayMs: 15000,
    onRetry: (error, attempt, delayMs) => {
      console.log(`Retry attempt ${attempt} after ${delayMs}ms`);
    }
  }
);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | number | 3 | Maximum number of retry attempts |
| `initialDelayMs` | number | 1000 | Initial delay before first retry (ms) |
| `backoffMultiplier` | number | 2 | Multiplier for exponential backoff |
| `maxDelayMs` | number | 30000 | Maximum delay between retries (ms) |
| `isTransient` | function | (built-in) | Custom function to detect transient errors |
| `onRetry` | function | undefined | Callback before each retry |

## Transient vs Permanent Errors

The utility automatically detects transient errors that should be retried:

### Transient Errors (Will Retry)
- `unavailable` - Service temporarily unavailable
- `deadline-exceeded` - Operation timeout
- `resource-exhausted` - Quota exceeded
- `aborted` - Transaction conflict
- `internal` - Internal server error
- Network errors (timeout, connection refused, etc.)

### Permanent Errors (Will NOT Retry)
- `permission-denied` - Access denied
- `unauthenticated` - Not authenticated
- `invalid-argument` - Invalid input
- `not-found` - Resource not found
- `already-exists` - Duplicate resource
- `failed-precondition` - Business logic violation

## Common Use Cases

### 1. Firestore Write Operations

```typescript
import { retryFirestore } from '@/utils/retry';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function createProduct(product: Product): Promise<void> {
  await retryFirestore(async () => {
    const productRef = doc(db, 'products', product.sku);
    await setDoc(productRef, {
      ...product,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}
```

### 2. Firestore Read Operations

```typescript
import { retryFirestore } from '@/utils/retry';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function getProduct(sku: string): Promise<Product | null> {
  return await retryFirestore(async () => {
    const productRef = doc(db, 'products', sku);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      return null;
    }
    
    return convertToProduct(productSnap.data());
  });
}
```

### 3. Firestore Transactions

```typescript
import { retryFirestore } from '@/utils/retry';
import { runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function transferInventory(
  fromLocation: string,
  toLocation: string,
  sku: string,
  quantity: number
): Promise<void> {
  await retryFirestore(async () => {
    await runTransaction(db, async (transaction) => {
      const fromRef = doc(db, 'inventory', `${sku}_${fromLocation}`);
      const toRef = doc(db, 'inventory', `${sku}_${toLocation}`);
      
      const fromSnap = await transaction.get(fromRef);
      const toSnap = await transaction.get(toRef);
      
      // Update both locations atomically
      transaction.update(fromRef, {
        quantityOnHand: fromSnap.data().quantityOnHand - quantity
      });
      
      transaction.update(toRef, {
        quantityOnHand: toSnap.data().quantityOnHand + quantity
      });
    });
  });
}
```

### 4. Batch Operations

```typescript
import { retryFirestore } from '@/utils/retry';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function updateMultipleProducts(updates: ProductUpdate[]): Promise<void> {
  await retryFirestore(async () => {
    const batch = writeBatch(db);
    
    updates.forEach(update => {
      const productRef = doc(db, 'products', update.sku);
      batch.update(productRef, update.fields);
    });
    
    await batch.commit();
  });
}
```

### 5. Query Operations

```typescript
import { retryFirestore } from '@/utils/retry';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function getLowStockProducts(): Promise<Product[]> {
  return await retryFirestore(async () => {
    const inventoryRef = collection(db, 'inventory');
    const q = query(
      inventoryRef,
      where('quantityOnHand', '<', 10)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertToProduct(doc.data()));
  });
}
```

### 6. External API Calls

```typescript
import { retryNetwork } from '@/utils/retry';

export async function fetchSupplierPricing(supplierId: string): Promise<PricingData> {
  return await retryNetwork(async () => {
    const response = await fetch(`https://api.supplier.com/pricing/${supplierId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  });
}
```

### 7. Custom Retry Configuration

```typescript
import { withRetry } from '@/utils/retry';

// More aggressive retries for critical operations
export async function criticalDatabaseWrite(data: any): Promise<void> {
  await withRetry(
    async () => {
      await setDoc(doc(db, 'critical', data.id), data);
    },
    {
      maxRetries: 10,        // More retries
      initialDelayMs: 500,   // Shorter initial delay
      backoffMultiplier: 1.5, // Gentler backoff
      maxDelayMs: 20000,     // Cap at 20 seconds
      onRetry: (error, attempt, delay) => {
        // Log to monitoring system
        console.error(`Critical write retry ${attempt}:`, error);
      }
    }
  );
}
```

### 8. Creating Reusable Wrappers

```typescript
import { createRetryWrapper } from '@/utils/retry';

// Custom wrapper for AI service calls
export const retryAIService = createRetryWrapper({
  maxRetries: 5,
  initialDelayMs: 2000,
  backoffMultiplier: 2,
  maxDelayMs: 60000, // AI services may need longer waits
  onRetry: (error, attempt, delay) => {
    console.warn(`AI service retry ${attempt} in ${delay}ms`);
  }
});

// Use it throughout the app
const matchSuggestions = await retryAIService(async () => {
  return await aiService.matchProducts(supplierProducts);
});
```

### 9. Custom Transient Error Detection

```typescript
import { withRetry } from '@/utils/retry';

// Custom logic for specific API
const result = await withRetry(
  async () => {
    return await customAPICall();
  },
  {
    isTransient: (error) => {
      // Retry on specific HTTP status codes
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        return status === 429 || status === 503 || status === 504;
      }
      return false;
    }
  }
);
```

## Best Practices

### ✅ DO

1. **Use retry for Firestore operations**: Wrap all Firestore reads, writes, transactions, and queries
2. **Use retry for external API calls**: Especially for unreliable third-party services
3. **Log retry attempts**: Use `onRetry` callback for monitoring and debugging
4. **Choose appropriate timeouts**: Match retry settings to operation criticality
5. **Handle final failure gracefully**: Catch errors after all retries exhausted

```typescript
try {
  await retryFirestore(async () => {
    await setDoc(docRef, data);
  });
} catch (error) {
  // All retries exhausted, handle failure
  console.error('Failed after retries:', error);
  // Show user-friendly error message
  // Log to monitoring system
  // Implement fallback logic if possible
}
```

### ❌ DON'T

1. **Don't wrap non-idempotent operations without care**: Ensure retries won't cause duplicates
2. **Don't use very long delays for user-facing operations**: Users won't wait minutes
3. **Don't retry validation errors**: These are permanent and won't succeed on retry
4. **Don't ignore the final error**: Always handle the case where all retries fail
5. **Don't use infinite retries**: Always set a reasonable `maxRetries`

## Monitoring and Logging

### Basic Logging

```typescript
import { retryFirestore } from '@/utils/retry';

// The pre-configured retryFirestore already logs to console.warn
// Logs look like:
// [Retry] Firestore operation failed, attempt 1/3, retrying in 1250ms. Error: unavailable
```

### Custom Monitoring

```typescript
import { withRetry } from '@/utils/retry';
import { trackMetric, trackError } from '@/services/monitoring';

await withRetry(
  async () => {
    return await riskyOperation();
  },
  {
    onRetry: (error, attempt, delay) => {
      // Track retry attempts in monitoring system
      trackMetric('retry_attempt', {
        operation: 'riskyOperation',
        attempt,
        delay,
        errorCode: error.code || 'unknown'
      });
    }
  }
);
```

## Performance Considerations

### Exponential Backoff Timing

With default settings (initialDelayMs: 1000, backoffMultiplier: 2, maxRetries: 3):

| Attempt | Delay Range (with jitter) | Cumulative Time |
|---------|---------------------------|-----------------|
| 1       | 500-1000ms                | 0.5-1s          |
| 2       | 1000-2000ms               | 1.5-3s          |
| 3       | 2000-4000ms               | 3.5-7s          |

Total worst-case time for 3 retries: ~7 seconds

### Adjusting for User Experience

```typescript
// For user-facing operations, use shorter delays
const quickRetry = createRetryWrapper({
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 3000,
});

// For background jobs, longer retries are acceptable
const backgroundRetry = createRetryWrapper({
  maxRetries: 10,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
});
```

## Testing with Retry Logic

### Mocking Transient Failures

```typescript
import { describe, it, expect, vi } from 'vitest';
import { retryFirestore } from '@/utils/retry';

describe('Product Service', () => {
  it('should retry on transient Firestore errors', async () => {
    const mockSetDoc = vi.fn()
      .mockRejectedValueOnce({ code: 'unavailable' })
      .mockRejectedValueOnce({ code: 'deadline-exceeded' })
      .mockResolvedValueOnce(undefined);
    
    await retryFirestore(async () => {
      await mockSetDoc();
    });
    
    expect(mockSetDoc).toHaveBeenCalledTimes(3);
  });
});
```

## Migration Guide

### Before (No Retry Logic)

```typescript
export async function createSupplier(supplier: Supplier): Promise<void> {
  const supplierRef = doc(db, 'suppliers', supplier.id);
  await setDoc(supplierRef, supplier);
}
```

### After (With Retry Logic)

```typescript
import { retryFirestore } from '@/utils/retry';

export async function createSupplier(supplier: Supplier): Promise<void> {
  await retryFirestore(async () => {
    const supplierRef = doc(db, 'suppliers', supplier.id);
    await setDoc(supplierRef, supplier);
  });
}
```

That's it! Just wrap the operation in `retryFirestore()`.

## Troubleshooting

### Issue: Operation never succeeds after retries

**Possible causes:**
- Error is actually permanent (check error code)
- Network/service is down for extended period
- Firestore security rules denying access

**Solutions:**
- Check Firebase console for service status
- Verify Firestore security rules
- Review error codes in logs
- Consider if operation is actually idempotent

### Issue: Retries taking too long

**Possible causes:**
- Too many retry attempts
- Delays too long
- Operation itself is slow

**Solutions:**
- Reduce `maxRetries`
- Reduce `initialDelayMs` or `maxDelayMs`
- Optimize the operation itself
- Use different retry settings for user-facing vs background operations

### Issue: Getting duplicate writes

**Possible causes:**
- Non-idempotent operation being retried
- Transaction not properly structured

**Solutions:**
- Ensure operations are idempotent (use set instead of increment)
- Use Firestore transactions for atomic operations
- Add unique constraints to prevent duplicates
- Consider using batch writes with proper error handling

## Related Documentation

- [Error Handling Guide](./ERRORS_README.md)
- [Validation Guide](./VALIDATION_README.md)
- [Firebase Service Documentation](../services/firebase/README.md)

## Support

For questions or issues:
1. Check Firebase documentation for error codes
2. Review monitoring logs for retry patterns
3. Consult team lead for critical operation retry settings

# Scalability Tests

This directory contains scalability tests that validate PRO SYNAPSE can handle large production-scale data volumes.

## Test Files

### `large-dataset.test.ts`

Comprehensive scalability test suite that validates:

- **Requirement 22.1**: 100,000 product records
- **Requirement 22.2**: 1,000,000 transaction records  
- **Requirement 22.3**: Concurrent user operations
- **Requirement 22.4**: Query performance with large datasets

## Running the Tests

**Important**: These tests are marked with `.skip` by default to prevent accidental execution.

### Prerequisites

1. **Firebase Emulator** (recommended) or real Firebase project
2. **Firestore indexes** deployed
3. **Sufficient resources**: 4GB RAM, 10GB disk space
4. **Time**: 40-60 minutes for full test suite

### Quick Start

1. Start Firebase Emulator:
   ```bash
   firebase emulators:start
   ```

2. Remove `.skip` from test describe blocks in `large-dataset.test.ts`

3. Run the tests:
   ```bash
   npm run test src/tests/scalability/large-dataset.test.ts
   ```

### Detailed Instructions

See [TASK_43.3_SCALABILITY_TEST_GUIDE.md](../../../TASK_43.3_SCALABILITY_TEST_GUIDE.md) for:
- Complete setup instructions
- Firebase configuration options
- Performance thresholds
- Troubleshooting guide
- Data cleanup procedures

## Test Approach

The tests use a realistic data generation strategy:

### Products (100,000 records)
- Distributed across 5 categories
- Varied pricing ($10-$1000)
- Supplier mappings included
- Realistic reorder points

### Transactions (1,000,000 records)
- 1-5 line items per transaction
- Random timestamps over 1 year
- Mixed payment methods
- Accurate tax calculations

### Performance Validation
- Query execution time measurements
- Concurrent operation testing
- Indexed query validation
- Data integrity checks

## Performance Expectations

### Firebase Emulator (Local)
- **Write throughput**: 200-300 records/sec
- **Indexed queries**: 500-1500ms
- **Concurrent queries**: 800-1800ms average

### Real Firebase (Network)
- **Write throughput**: 50-150 records/sec
- **Indexed queries**: 800-1800ms
- **Concurrent queries**: 1000-2000ms average

All queries must complete within **2 seconds** per Requirement 17.2.

## Data Cleanup

Test data is prefixed with `scalability_test_` for easy identification.

**Automatic cleanup** (disabled by default):
- Uncomment `cleanupTestData()` in `afterAll()` hook

**Manual cleanup**:
- Restart Firebase Emulator (erases all data)
- Use Firebase Console to delete by prefix

## Notes

- Tests generate substantial data (several GB)
- Network tests consume Firebase quota
- Proper indexes are critical for passing tests
- Test timeouts are configured for data volume

## Integration with CI/CD

See the guide for GitHub Actions workflow example to run these tests on a schedule.

# FuzzyMatcher Implementation Summary

## Overview

The `FuzzyMatcher` service implements fuzzy text matching for products that don't have exact SKU matches. It uses two complementary algorithms:

1. **Levenshtein Distance** - Character-level similarity matching
2. **Cosine Similarity** - Word-level semantic matching

The combination provides robust matching that handles typos, word reordering, and semantic similarity.

## Requirements Satisfied

- **Requirement 4.3**: Fuzzy matching on product descriptions when exact match fails
- **Requirement 4.4**: Confidence threshold of 0.85 for match suggestions

## Algorithm Details

### Levenshtein Distance (Character-Level Matching)

**Purpose**: Measures character-level similarity between two strings

**How it works**:
- Calculates the minimum number of single-character edits (insertions, deletions, substitutions) required to change one string into another
- Uses dynamic programming for efficient computation
- Normalized to 0-1 range where 1.0 = identical strings

**Strengths**:
- Handles typos and spelling variations well
- Good for detecting similar text structure
- Robust against character transpositions

**Example**:
```
"DeWalt Cordless Drill" vs "DeWlt Cordlss Dril"
Levenshtein Distance: 3 edits
Similarity: ~0.85 (very similar despite typos)
```

### Cosine Similarity (Word-Level Matching)

**Purpose**: Measures semantic similarity based on word overlap

**How it works**:
1. Tokenizes both strings into words
2. Creates term frequency vectors for each string
3. Calculates cosine of the angle between vectors
4. Formula: `cos(θ) = (A · B) / (||A|| × ||B||)`

**Strengths**:
- Detects semantic similarity even with word reordering
- Captures shared vocabulary
- Less sensitive to string length differences

**Example**:
```
"Industrial Hammer 16oz Acme" vs "Acme Industrial Hammer 16oz"
Word overlap: 4/4 words match
Cosine Similarity: ~1.0 (identical word content)
```

### Combined Scoring

The final confidence score is a weighted combination:

```
confidence = (levenshteinScore × 0.4) + (cosineScore × 0.6)
```

**Weights rationale**:
- Cosine similarity (60%) - Higher weight because word-level matching better captures product semantic meaning
- Levenshtein distance (40%) - Important for catching typos and character-level variations

## Configuration

### Default Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `levenshteinWeight` | 0.4 | Weight for character-level similarity |
| `cosineWeight` | 0.6 | Weight for word-level similarity |
| `maxSuggestions` | 5 | Maximum number of suggestions to return |
| `minConfidence` | 0.5 | Minimum confidence threshold for returning suggestions |

### Text Normalization

Before comparison, all text is normalized:
1. Convert to lowercase
2. Remove punctuation (replaced with spaces)
3. Collapse multiple spaces into single space
4. Trim leading/trailing whitespace

This ensures consistent matching regardless of formatting differences.

## Usage Example

```typescript
import { fuzzyMatcher } from '@/services/matching';

const supplierProduct: PricelistItem = {
  supplierCode: 'SUP-HAM-001',
  description: 'Industrial Hammer 16 ounce Acme',
  price: 24.99,
};

const internalProducts: Product[] = [
  {
    sku: 'SKU001',
    description: 'Acme Industrial Hammer 16oz',
    // ... other fields
  },
  // ... more products
];

const suggestions = await fuzzyMatcher.matchProduct(
  supplierProduct,
  internalProducts
);

// Results sorted by confidence (highest first)
suggestions.forEach(suggestion => {
  console.log(`SKU: ${suggestion.suggestedSKU}`);
  console.log(`Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`);
  console.log(`Reason: ${suggestion.reason}`);
});
```

## Return Format

Each suggestion includes:

```typescript
interface MatchSuggestion {
  supplierCode: string;      // Original supplier code
  suggestedSKU: string;       // Internal SKU suggestion
  productName: string;        // Internal product description
  confidence: number;         // Confidence score (0-1)
  reason: string;             // Human-readable explanation
}
```

## Performance Characteristics

### Time Complexity

- **Levenshtein Distance**: O(m × n) where m, n are string lengths
- **Cosine Similarity**: O(k) where k is total number of unique words
- **Overall per product**: O(m × n + k)

### Space Complexity

- **Levenshtein Distance**: O(m × n) for DP matrix
- **Cosine Similarity**: O(k) for term frequency maps
- Can be optimized with space-efficient Levenshtein if needed

### Scalability

For 1000 products with average 50-character descriptions:
- **Estimated time**: ~100-200ms on modern hardware
- **Memory usage**: Minimal (dominated by DP matrices)

**Optimization opportunities**:
- Pre-compute term frequency vectors for internal products
- Use parallel processing for batch matching
- Implement early termination for very low scores

## Edge Cases Handled

1. **Empty strings**: Returns confidence 0
2. **Identical strings**: Returns confidence ~1.0
3. **Special characters**: Normalized away during comparison
4. **Case sensitivity**: All comparisons are case-insensitive
5. **Word reordering**: Detected by cosine similarity
6. **Typos**: Detected by Levenshtein distance
7. **Inactive products**: Excluded from matching
8. **Very long descriptions**: Handled correctly (may be slower)

## Test Coverage

The implementation includes 22 comprehensive tests covering:

- ✅ High-confidence matches for similar descriptions
- ✅ Moderate word overlap detection
- ✅ Unrelated product filtering
- ✅ Confidence-based sorting
- ✅ Result limiting (top N)
- ✅ Inactive product exclusion
- ✅ Exact character matches
- ✅ Confidence score range validation
- ✅ Empty product list handling
- ✅ Special character handling
- ✅ Case-insensitive matching
- ✅ Typo tolerance
- ✅ Descriptive match reasons
- ✅ Levenshtein distance algorithm
- ✅ Cosine similarity algorithm
- ✅ Edge cases (empty strings, long descriptions, whitespace)

All tests pass successfully.

## Integration with Product Matching Pipeline

The FuzzyMatcher is used as part of the overall product matching flow:

```
1. Exact Matcher attempts direct SKU/code match
   ↓ (if no exact match)
2. FuzzyMatcher performs text similarity matching
   ↓ (if confidence < 0.85)
3. AI Matcher performs semantic analysis
   ↓ (if still no high-confidence match)
4. Product flagged as unmatched for manual review
```

## Future Enhancements

Potential improvements for future iterations:

1. **Adaptive Weights**: Learn optimal weights from user confirmations
2. **Phonetic Matching**: Add Soundex/Metaphone for sound-alike products
3. **N-gram Analysis**: Include character n-grams for better partial matches
4. **Pre-computation**: Cache term vectors for internal products
5. **Parallel Processing**: Use worker threads for large product sets
6. **Customizable Thresholds**: Allow per-supplier confidence thresholds
7. **Match Caching**: Cache recent matches to avoid recomputation

## References

- Levenshtein Distance: https://en.wikipedia.org/wiki/Levenshtein_distance
- Cosine Similarity: https://en.wikipedia.org/wiki/Cosine_similarity
- Text Similarity Algorithms: https://www.baeldung.com/cs/string-similarity-algorithms

/**
 * Fuzzy Matcher Service
 * 
 * Performs text similarity matching using Levenshtein distance and cosine similarity.
 * Used for products that don't have exact SKU matches.
 * Combines character-level and word-level similarity for robust matching.
 * 
 * Requirements: 4.3, 4.4
 */

import type { PricelistItem, MatchSuggestion, Product } from '../../types/models';

/**
 * Fuzzy matching result with detailed scoring
 */
export interface FuzzyMatchResult {
  /**
   * Internal product SKU
   */
  sku: string;
  
  /**
   * Product name/description
   */
  productName: string;
  
  /**
   * Combined confidence score (0-1)
   */
  confidence: number;
  
  /**
   * Levenshtein distance similarity score (0-1)
   */
  levenshteinScore: number;
  
  /**
   * Cosine similarity score (0-1)
   */
  cosineScore: number;
  
  /**
   * Explanation of match
   */
  reason: string;
}

/**
 * FuzzyMatcher class
 * 
 * Implements fuzzy text matching using:
 * 1. Levenshtein distance - for character-level similarity
 * 2. Cosine similarity - for word-level semantic similarity
 * 
 * The final confidence score is a weighted combination of both metrics.
 * 
 * Requirements: 4.3, 4.4
 */
export class FuzzyMatcher {
  /**
   * Weight for Levenshtein distance in final score (0-1)
   */
  private readonly levenshteinWeight: number = 0.4;
  
  /**
   * Weight for cosine similarity in final score (0-1)
   */
  private readonly cosineWeight: number = 0.6;
  
  /**
   * Maximum number of top suggestions to return
   */
  private readonly maxSuggestions: number = 5;
  
  /**
   * Minimum confidence threshold for returning suggestions (0-1)
   */
  private readonly minConfidence: number = 0.5;
  
  /**
   * Match a single supplier product against internal products
   * 
   * Uses fuzzy text matching to find similar products based on description.
   * Returns top N suggestions sorted by confidence score.
   * 
   * @param supplierProduct - Supplier product to match
   * @param internalProducts - Array of internal products to match against
   * @returns Array of match suggestions sorted by confidence (highest first)
   * 
   * Requirements: 4.3, 4.4
   */
  async matchProduct(
    supplierProduct: PricelistItem,
    internalProducts: Product[]
  ): Promise<MatchSuggestion[]> {
    const results = await this.calculateMatches(
      supplierProduct,
      internalProducts
    );
    
    // Filter by minimum confidence threshold
    const filteredResults = results.filter(
      result => result.confidence >= this.minConfidence
    );
    
    // Sort by confidence (highest first) and limit to top N
    const topResults = filteredResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxSuggestions);
    
    // Convert to MatchSuggestion format
    return topResults.map(result => ({
      supplierCode: supplierProduct.supplierCode,
      suggestedSKU: result.sku,
      productName: result.productName,
      confidence: result.confidence,
      reason: result.reason,
    }));
  }
  
  /**
   * Calculate fuzzy matches for all active internal products
   * 
   * @param supplierProduct - Supplier product to match
   * @param internalProducts - Array of internal products to match against
   * @returns Array of fuzzy match results
   * 
   * @private
   */
  private async calculateMatches(
    supplierProduct: PricelistItem,
    internalProducts: Product[]
  ): Promise<FuzzyMatchResult[]> {
    const supplierDesc = supplierProduct.description;
    const results: FuzzyMatchResult[] = [];
    
    // Filter only active products
    const activeProducts = internalProducts.filter(p => p.isActive);
    
    for (const product of activeProducts) {
      const productDesc = product.description;
      
      // Calculate Levenshtein distance similarity
      const levenshteinScore = this.calculateLevenshteinSimilarity(
        supplierDesc,
        productDesc
      );
      
      // Calculate cosine similarity
      const cosineScore = this.calculateCosineSimilarity(
        supplierDesc,
        productDesc
      );
      
      // Combine scores with weights
      const confidence = this.combineScores(levenshteinScore, cosineScore);
      
      // Generate explanation
      const reason = this.generateReason(
        levenshteinScore,
        cosineScore,
        confidence
      );
      
      results.push({
        sku: product.sku,
        productName: product.description,
        confidence,
        levenshteinScore,
        cosineScore,
        reason,
      });
    }
    
    return results;
  }
  
  /**
   * Calculate Levenshtein distance similarity (character-level matching)
   * 
   * Computes the edit distance between two strings and normalizes to 0-1 range.
   * Higher scores indicate more similar strings.
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score (0-1), where 1 is identical
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    // Normalize strings for comparison
    const normalized1 = this.normalizeText(str1);
    const normalized2 = this.normalizeText(str2);
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalized1, normalized2);
    
    // Convert distance to similarity (0-1 range)
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    if (maxLength === 0) {
      return 1.0; // Both strings are empty
    }
    
    // Similarity = 1 - (distance / maxLength)
    return Math.max(0, 1.0 - (distance / maxLength));
  }
  
  /**
   * Calculate Levenshtein distance (edit distance) between two strings
   * 
   * Uses dynamic programming to compute the minimum number of
   * single-character edits (insertions, deletions, substitutions)
   * required to change one string into the other.
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Levenshtein distance
   * 
   * @private
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create matrix for dynamic programming
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row (cost of inserting characters)
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    
    // Initialize first column (cost of deleting characters)
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill in the rest of the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,         // deletion
          matrix[i][j - 1] + 1,         // insertion
          matrix[i - 1][j - 1] + cost   // substitution
        );
      }
    }
    
    return matrix[len1][len2];
  }
  
  /**
   * Calculate cosine similarity (word-level matching)
   * 
   * Tokenizes both strings into words, creates term frequency vectors,
   * and calculates the cosine of the angle between them.
   * Higher scores indicate more semantically similar text.
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Cosine similarity score (0-1)
   */
  private calculateCosineSimilarity(str1: string, str2: string): number {
    // Normalize and tokenize strings
    const tokens1 = this.tokenize(this.normalizeText(str1));
    const tokens2 = this.tokenize(this.normalizeText(str2));
    
    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }
    
    // Create term frequency vectors
    const vector1 = this.createTermFrequencyVector(tokens1);
    const vector2 = this.createTermFrequencyVector(tokens2);
    
    // Calculate cosine similarity
    return this.cosineSimilarity(vector1, vector2);
  }
  
  /**
   * Tokenize text into words
   * 
   * Splits text on whitespace and filters empty tokens.
   * 
   * @param text - Text to tokenize
   * @returns Array of tokens (words)
   * 
   * @private
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(token => token.length > 0);
  }
  
  /**
   * Create a term frequency vector from tokens
   * 
   * Builds a map of term -> frequency count.
   * 
   * @param tokens - Array of tokens
   * @returns Map of term frequencies
   * 
   * @private
   */
  private createTermFrequencyVector(tokens: string[]): Map<string, number> {
    const vector = new Map<string, number>();
    
    for (const token of tokens) {
      const count = vector.get(token) || 0;
      vector.set(token, count + 1);
    }
    
    return vector;
  }
  
  /**
   * Calculate cosine similarity between two term frequency vectors
   * 
   * Formula: cos(θ) = (A · B) / (||A|| × ||B||)
   * Where:
   * - A · B is the dot product of vectors A and B
   * - ||A|| is the magnitude (length) of vector A
   * - ||B|| is the magnitude (length) of vector B
   * 
   * @param vector1 - First term frequency vector
   * @param vector2 - Second term frequency vector
   * @returns Cosine similarity (0-1)
   * 
   * @private
   */
  private cosineSimilarity(
    vector1: Map<string, number>,
    vector2: Map<string, number>
  ): number {
    // Get all unique terms from both vectors
    const allTerms = new Set([...vector1.keys(), ...vector2.keys()]);
    
    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (const term of allTerms) {
      const freq1 = vector1.get(term) || 0;
      const freq2 = vector2.get(term) || 0;
      
      dotProduct += freq1 * freq2;
      magnitude1 += freq1 * freq1;
      magnitude2 += freq2 * freq2;
    }
    
    // Calculate magnitudes (square root of sum of squares)
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    // Avoid division by zero
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    // Return cosine similarity
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Combine Levenshtein and cosine scores into final confidence score
   * 
   * Uses weighted average based on configured weights.
   * 
   * @param levenshteinScore - Levenshtein similarity score (0-1)
   * @param cosineScore - Cosine similarity score (0-1)
   * @returns Combined confidence score (0-1)
   * 
   * @private
   */
  private combineScores(
    levenshteinScore: number,
    cosineScore: number
  ): number {
    const combined = (
      levenshteinScore * this.levenshteinWeight +
      cosineScore * this.cosineWeight
    );
    
    // Ensure result is in [0, 1] range
    return Math.max(0, Math.min(1, combined));
  }
  
  /**
   * Normalize text for comparison
   * 
   * Converts to lowercase, removes extra whitespace, and strips punctuation.
   * 
   * @param text - Text to normalize
   * @returns Normalized text
   * 
   * @private
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')      // Collapse multiple spaces
      .trim();
  }
  
  /**
   * Generate human-readable explanation for match
   * 
   * @param levenshteinScore - Levenshtein similarity score
   * @param cosineScore - Cosine similarity score
   * @param confidence - Overall confidence score
   * @returns Match reason explanation
   * 
   * @private
   */
  private generateReason(
    levenshteinScore: number,
    cosineScore: number,
    confidence: number
  ): string {
    const reasons: string[] = [];
    
    // Describe character-level similarity
    if (levenshteinScore > 0.8) {
      reasons.push('very similar text');
    } else if (levenshteinScore > 0.6) {
      reasons.push('similar text');
    } else if (levenshteinScore > 0.4) {
      reasons.push('somewhat similar text');
    }
    
    // Describe word-level similarity
    if (cosineScore > 0.7) {
      reasons.push('high word overlap');
    } else if (cosineScore > 0.5) {
      reasons.push('moderate word overlap');
    } else if (cosineScore > 0.3) {
      reasons.push('some shared words');
    }
    
    if (reasons.length === 0) {
      return 'Fuzzy text matching';
    }
    
    return `Matched based on ${reasons.join(' and ')} (confidence: ${(confidence * 100).toFixed(1)}%)`;
  }
}

/**
 * Create and export a singleton instance
 */
export const fuzzyMatcher = new FuzzyMatcher();

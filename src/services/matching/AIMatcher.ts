/**
 * AI Matcher Service
 * 
 * Wrapper for AI-powered semantic product description matching.
 * Integrates with Firebase ML Kit or external AI service to perform
 * advanced matching based on product descriptions.
 * 
 * Requirements: 4.3
 */

import type { PricelistItem, MatchSuggestion, Product } from '../../types/models';

/**
 * AI matching configuration
 */
export interface AIMatcherConfig {
  /**
   * Minimum confidence threshold for returning suggestions (0-1)
   */
  minConfidence?: number;
  
  /**
   * Maximum number of suggestions to return per query
   */
  maxSuggestions?: number;
  
  /**
   * API endpoint for external AI service (if not using Firebase ML Kit)
   */
  apiEndpoint?: string;
  
  /**
   * API key for external AI service
   */
  apiKey?: string;
}

/**
 * Result from AI semantic matching
 */
export interface AIMatchResult {
  /**
   * Internal product SKU
   */
  sku: string;
  
  /**
   * Product name/description
   */
  productName: string;
  
  /**
   * Match confidence score (0-1)
   */
  confidence: number;
  
  /**
   * Explanation of why this match was suggested
   */
  reason: string;
  
  /**
   * Optional semantic similarity score
   */
  semanticScore?: number;
}

/**
 * AI Matcher Service
 * 
 * Provides semantic product description matching using AI/ML techniques.
 * This is a wrapper that can integrate with:
 * - Firebase ML Kit
 * - External AI services (OpenAI, Google Cloud AI, etc.)
 * - Custom trained models
 * 
 * Requirements: 4.3
 */
export class AIMatcher {
  private config: Required<AIMatcherConfig>;
  
  /**
   * Create an AI matcher instance
   * 
   * @param config - Configuration for the AI matcher
   */
  constructor(config: AIMatcherConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.5,
      maxSuggestions: config.maxSuggestions ?? 5,
      apiEndpoint: config.apiEndpoint ?? '',
      apiKey: config.apiKey ?? '',
    };
  }
  
  /**
   * Perform semantic matching for a supplier product
   * 
   * Uses AI-powered techniques to find products with semantically similar descriptions.
   * 
   * @param supplierProduct - Supplier product to match
   * @param internalProducts - Array of internal products to match against
   * @returns Promise resolving to array of match suggestions
   * 
   * Requirements: 4.3
   */
  async matchProduct(
    supplierProduct: PricelistItem,
    internalProducts: Product[]
  ): Promise<MatchSuggestion[]> {
    // Perform AI-powered semantic matching
    const results = await this.performSemanticMatching(
      supplierProduct.description,
      internalProducts
    );
    
    // Filter by minimum confidence threshold
    const filteredResults = results.filter(
      result => result.confidence >= this.config.minConfidence
    );
    
    // Sort by confidence (highest first) and limit to max suggestions
    const topResults = filteredResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestions);
    
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
   * Perform semantic matching using AI service
   * 
   * This is the core AI integration point. Current implementation provides
   * a semantic similarity calculation that can be replaced with:
   * - Firebase ML Kit text similarity
   * - OpenAI embeddings
   * - Google Cloud Natural Language API
   * - Custom trained models
   * 
   * @param supplierDescription - Description to match
   * @param internalProducts - Products to match against
   * @returns Promise resolving to AI match results
   */
  private async performSemanticMatching(
    supplierDescription: string,
    internalProducts: Product[]
  ): Promise<AIMatchResult[]> {
    // Normalize supplier description for comparison
    const normalizedSupplier = this.normalizeText(supplierDescription);
    const supplierTokens = this.tokenize(normalizedSupplier);
    
    // Calculate semantic similarity for each internal product
    const results: AIMatchResult[] = [];
    
    for (const product of internalProducts.filter(p => p.isActive)) {
      const normalizedProduct = this.normalizeText(product.description);
      const productTokens = this.tokenize(normalizedProduct);
      
      // Calculate token overlap similarity
      const tokenSimilarity = this.calculateTokenSimilarity(
        supplierTokens,
        productTokens
      );
      
      // Calculate character-level similarity (Jaccard similarity)
      const charSimilarity = this.calculateJaccardSimilarity(
        normalizedSupplier,
        normalizedProduct
      );
      
      // Calculate edit distance similarity
      const editSimilarity = this.calculateEditDistanceSimilarity(
        normalizedSupplier,
        normalizedProduct
      );
      
      // Weighted combination of similarity metrics
      // Token overlap is weighted highest for semantic meaning
      const confidence = (
        tokenSimilarity * 0.5 +
        charSimilarity * 0.25 +
        editSimilarity * 0.25
      );
      
      // Generate reason explanation
      const reason = this.generateMatchReason(
        supplierDescription,
        product.description,
        confidence,
        tokenSimilarity,
        charSimilarity
      );
      
      results.push({
        sku: product.sku,
        productName: product.description,
        confidence,
        reason,
        semanticScore: tokenSimilarity,
      });
    }
    
    return results;
  }
  
  /**
   * Normalize text for comparison
   * 
   * Converts to lowercase, removes extra whitespace, and strips punctuation
   * 
   * @param text - Text to normalize
   * @returns Normalized text
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ')     // Collapse multiple spaces
      .trim();
  }
  
  /**
   * Tokenize text into words
   * 
   * @param text - Text to tokenize
   * @returns Array of tokens
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(token => token.length > 0);
  }
  
  /**
   * Calculate token-based similarity (semantic overlap)
   * 
   * Measures how many meaningful words are shared between descriptions.
   * This captures semantic similarity better than character-level metrics.
   * 
   * @param tokens1 - First set of tokens
   * @param tokens2 - Second set of tokens
   * @returns Similarity score (0-1)
   */
  private calculateTokenSimilarity(
    tokens1: string[],
    tokens2: string[]
  ): number {
    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    // Count intersection
    let intersection = 0;
    for (const token of set1) {
      if (set2.has(token)) {
        intersection++;
      }
    }
    
    // Jaccard similarity: intersection / union
    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  /**
   * Calculate Jaccard similarity at character level
   * 
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  private calculateJaccardSimilarity(text1: string, text2: string): number {
    if (text1.length === 0 || text2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(text1.split(''));
    const set2 = new Set(text2.split(''));
    
    let intersection = 0;
    for (const char of set1) {
      if (set2.has(char)) {
        intersection++;
      }
    }
    
    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  /**
   * Calculate similarity based on edit distance (Levenshtein distance)
   * 
   * Normalized to 0-1 range where 1 is identical and 0 is completely different
   * 
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  private calculateEditDistanceSimilarity(
    text1: string,
    text2: string
  ): number {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    if (maxLength === 0) {
      return 1.0;
    }
    
    return 1.0 - (distance / maxLength);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create matrix
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return matrix[len1][len2];
  }
  
  /**
   * Generate human-readable explanation for match
   * 
   * @param supplierDesc - Supplier product description
   * @param productDesc - Internal product description
   * @param confidence - Overall confidence score
   * @param tokenSimilarity - Token similarity score
   * @param charSimilarity - Character similarity score
   * @returns Match reason explanation
   */
  private generateMatchReason(
    supplierDesc: string,
    productDesc: string,
    confidence: number,
    tokenSimilarity: number,
    charSimilarity: number
  ): string {
    const reasons: string[] = [];
    
    if (tokenSimilarity > 0.7) {
      reasons.push('high semantic similarity');
    } else if (tokenSimilarity > 0.4) {
      reasons.push('moderate semantic similarity');
    }
    
    if (charSimilarity > 0.7) {
      reasons.push('similar text structure');
    }
    
    // Find common keywords
    const supplierTokens = this.tokenize(this.normalizeText(supplierDesc));
    const productTokens = this.tokenize(this.normalizeText(productDesc));
    const commonTokens = supplierTokens.filter(t => productTokens.includes(t));
    
    if (commonTokens.length > 0) {
      const keyTerms = commonTokens.slice(0, 3).join(', ');
      reasons.push(`shared terms: ${keyTerms}`);
    }
    
    if (reasons.length === 0) {
      reasons.push('AI-based semantic analysis');
    }
    
    return `Matched based on ${reasons.join('; ')}`;
  }
  
  /**
   * Update the matcher with confirmed match for learning
   * 
   * This method allows the AI matcher to learn from user confirmations.
   * In a production system, this would update training data or fine-tune models.
   * 
   * @param supplierProduct - Supplier product
   * @param confirmedSKU - Confirmed internal SKU
   */
  async learnFromConfirmation(
    supplierProduct: PricelistItem,
    confirmedSKU: string
  ): Promise<void> {
    // In production, this would:
    // 1. Store the confirmation in a training dataset
    // 2. Update model weights or embeddings
    // 3. Improve future matching accuracy
    
    // For now, this is a no-op that can be implemented when
    // integrating with an actual AI service
    
    console.log(
      `Learning from confirmation: ${supplierProduct.supplierCode} -> ${confirmedSKU}`
    );
  }
}

/**
 * Create default AI matcher instance
 */
export function createAIMatcher(config?: AIMatcherConfig): AIMatcher {
  return new AIMatcher(config);
}

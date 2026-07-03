/**
 * Product Matching Service Exports
 * 
 * Centralized exports for product matching components.
 */

export { ExactMatcher, exactMatcher } from './ExactMatcher';
export { FuzzyMatcher, fuzzyMatcher } from './FuzzyMatcher';
export type { FuzzyMatchResult } from './FuzzyMatcher';
export { AIMatcher, createAIMatcher } from './AIMatcher';
export type { AIMatcherConfig, AIMatchResult } from './AIMatcher';
export { MatcherService, matcherService, createMatcherService } from './MatcherService';
export type { MatcherServiceConfig } from './MatcherService';
export { NewProductDetector, newProductDetector, createNewProductDetector } from './NewProductDetector';
export type { NewProductDetectionResult } from './NewProductDetector';

/**
 * Product Match Review Interactive Component
 * 
 * Interactive React component for reviewing product match suggestions.
 * Allows users to confirm or reject matches with supplier products.
 * 
 * Features:
 * - Display supplier product details and suggested match
 * - Side-by-side comparison view
 * - Confidence score visualization
 * - Confirm/reject actions
 * - Updates match learning system on confirmation
 * 
 * Requirements: 4.6
 * Task: 27.2
 */

import React, { useState } from 'react';
import type { MatchSuggestion } from '@/types/models';

interface ProductMatchReviewProps {
  /**
   * Match suggestion to review
   */
  suggestion: MatchSuggestion;
  
  /**
   * Supplier product details
   */
  supplierProduct: {
    itemId: string;
    supplierCode: string;
    description: string;
    price: number;
    supplierId: string;
    supplierName: string;
    pricelistId: string;
  };
  
  /**
   * Callback when match is confirmed
   */
  onConfirm?: () => void;
  
  /**
   * Callback when match is rejected
   */
  onReject?: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * ProductMatchReview Component
 * 
 * Interactive component for reviewing and confirming product matches.
 */
export default function ProductMatchReview({
  suggestion,
  supplierProduct,
  onConfirm,
  onReject,
}: ProductMatchReviewProps) {
  const [confirmStatus, setConfirmStatus] = useState<ActionStatus>('idle');
  const [rejectStatus, setRejectStatus] = useState<ActionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Handle confirm match action
   * Calls MatcherService.confirmMatch API endpoint
   */
  const handleConfirm = async () => {
    try {
      setConfirmStatus('loading');
      setErrorMessage('');

      const response = await fetch('/api/matching/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: supplierProduct.itemId,
          supplierCode: supplierProduct.supplierCode,
          internalSKU: suggestion.suggestedSKU,
          supplierId: supplierProduct.supplierId,
          pricelistId: supplierProduct.pricelistId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to confirm match');
      }

      setConfirmStatus('success');
      
      // Call callback after short delay to show success state
      setTimeout(() => {
        onConfirm?.();
      }, 1000);
    } catch (error) {
      console.error('Error confirming match:', error);
      setConfirmStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to confirm match');
    }
  };

  /**
   * Handle reject match action
   * Returns product to unmatched queue
   */
  const handleReject = async () => {
    try {
      setRejectStatus('loading');
      setErrorMessage('');

      const response = await fetch('/api/matching/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: supplierProduct.itemId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to reject match');
      }

      setRejectStatus('success');
      
      // Call callback after short delay to show success state
      setTimeout(() => {
        onReject?.();
      }, 1000);
    } catch (error) {
      console.error('Error rejecting match:', error);
      setRejectStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reject match');
    }
  };

  /**
   * Get confidence level badge styling
   */
  const getConfidenceBadgeClass = (confidence: number): string => {
    if (confidence >= 0.95) return 'bg-green-100 text-green-800';
    if (confidence >= 0.90) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  /**
   * Format confidence as percentage
   */
  const formatConfidence = (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  /**
   * Format price as currency
   */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const isProcessing = confirmStatus === 'loading' || rejectStatus === 'loading';
  const isCompleted = confirmStatus === 'success' || rejectStatus === 'success';

  return (
    <div className="product-match-review bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="header bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
        <h3 className="text-xl font-bold">Product Match Review</h3>
        <p className="text-blue-100 text-sm mt-1">
          Review and confirm suggested product match
        </p>
      </div>

      {/* Confidence Score */}
      <div className="confidence-section bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">Match Confidence</span>
            <p className="text-xs text-gray-500 mt-1">
              Based on AI-powered text similarity analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="confidence-bar-container w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="confidence-bar h-full bg-gradient-to-r from-yellow-400 via-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${suggestion.confidence * 100}%` }}
              />
            </div>
            <span className={`confidence-badge px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceBadgeClass(suggestion.confidence)}`}>
              {formatConfidence(suggestion.confidence)}
            </span>
          </div>
        </div>
      </div>

      {/* Comparison View */}
      <div className="comparison-grid grid md:grid-cols-2 gap-6 px-6 py-6">
        {/* Supplier Product */}
        <div className="supplier-product">
          <div className="section-header flex items-center gap-2 mb-4">
            <div className="icon w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-bold text-sm">S</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Supplier Product</h4>
              <p className="text-xs text-gray-500">{supplierProduct.supplierName}</p>
            </div>
          </div>
          
          <div className="details space-y-3">
            <div className="detail-row">
              <label className="text-xs font-medium text-gray-500 uppercase">Code</label>
              <p className="text-sm font-mono text-gray-900 mt-1">{supplierProduct.supplierCode}</p>
            </div>
            
            <div className="detail-row">
              <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
              <p className="text-sm text-gray-900 mt-1 leading-relaxed">{supplierProduct.description}</p>
            </div>
            
            <div className="detail-row">
              <label className="text-xs font-medium text-gray-500 uppercase">Price</label>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(supplierProduct.price)}</p>
            </div>
          </div>
        </div>

        {/* Suggested Internal Product */}
        <div className="internal-product">
          <div className="section-header flex items-center gap-2 mb-4">
            <div className="icon w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">I</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Suggested Match</h4>
              <p className="text-xs text-gray-500">Internal Product Catalog</p>
            </div>
          </div>
          
          <div className="details space-y-3">
            <div className="detail-row">
              <label className="text-xs font-medium text-gray-500 uppercase">SKU</label>
              <p className="text-sm font-mono text-gray-900 mt-1">{suggestion.suggestedSKU}</p>
            </div>
            
            <div className="detail-row">
              <label className="text-xs font-medium text-gray-500 uppercase">Product Name</label>
              <p className="text-sm text-gray-900 mt-1 leading-relaxed">{suggestion.productName}</p>
            </div>
            
            <div className="detail-row">
              <label className="text-xs font-medium text-gray-500 uppercase">Match Reason</label>
              <p className="text-sm text-gray-600 mt-1 italic">{suggestion.reason}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            <span className="font-semibold">Error: </span>
            {errorMessage}
          </p>
        </div>
      )}

      {/* Success Message */}
      {isCompleted && (
        <div className="success-message mx-6 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            <span className="font-semibold">
              {confirmStatus === 'success' ? '✓ Match confirmed!' : '✓ Match rejected!'}
            </span>
            {' '}
            {confirmStatus === 'success' 
              ? 'The system has learned from your confirmation.'
              : 'Product returned to unmatched queue.'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="actions px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="help-text text-xs text-gray-600">
          <p>
            <strong>Confirm</strong> to create product link and update learning system
          </p>
          <p className="mt-1">
            <strong>Reject</strong> to return product to unmatched queue
          </p>
        </div>
        
        <div className="buttons flex gap-3">
          <button
            onClick={handleReject}
            disabled={isProcessing || isCompleted}
            className={`
              reject-btn px-6 py-2.5 rounded-md font-medium text-sm transition-all
              ${rejectStatus === 'loading' 
                ? 'bg-gray-400 text-white cursor-wait' 
                : rejectStatus === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md active:scale-95'
              }
              ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {rejectStatus === 'loading' ? 'Rejecting...' : rejectStatus === 'success' ? 'Rejected ✓' : 'Reject Match'}
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={isProcessing || isCompleted}
            className={`
              confirm-btn px-6 py-2.5 rounded-md font-medium text-sm transition-all
              ${confirmStatus === 'loading' 
                ? 'bg-gray-400 text-white cursor-wait' 
                : confirmStatus === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:scale-95'
              }
              ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {confirmStatus === 'loading' ? 'Confirming...' : confirmStatus === 'success' ? 'Confirmed ✓' : 'Confirm Match'}
          </button>
        </div>
      </div>
    </div>
  );
}

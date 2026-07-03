/**
 * Match Review Modal Component
 * 
 * Modal wrapper for ProductMatchReview component.
 * Displays the review UI in a modal overlay.
 * 
 * Task: 27.2
 */

import React, { useEffect } from 'react';
import ProductMatchReview from './ProductMatchReview';
import type { MatchSuggestion } from '@/types/models';

interface MatchReviewModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
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
   * Callback when modal should close
   */
  onClose: () => void;
  
  /**
   * Callback when match is confirmed
   */
  onConfirm?: () => void;
  
  /**
   * Callback when match is rejected
   */
  onReject?: () => void;
}

/**
 * MatchReviewModal Component
 * 
 * Modal overlay for reviewing product matches.
 */
export default function MatchReviewModal({
  isOpen,
  suggestion,
  supplierProduct,
  onClose,
  onConfirm,
  onReject,
}: MatchReviewModalProps) {
  // Close modal on Escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm?.();
    // Modal will be closed by parent after confirmation completes
  };

  const handleReject = () => {
    onReject?.();
    // Modal will be closed by parent after rejection completes
  };

  return (
    <div 
      className="match-review-modal fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="modal-content max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
        {/* Close Button */}
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Product Match Review Component */}
        <ProductMatchReview
          suggestion={suggestion}
          supplierProduct={supplierProduct}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

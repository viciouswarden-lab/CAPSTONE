/**
 * Matching Queue Actions Component
 * 
 * Manages the interactive actions for the matching queue page.
 * Injects "Review Match" buttons into the DataTable and handles modal display.
 * 
 * Task: 27.2
 */

import React, { useState, useEffect } from 'react';
import MatchReviewModal from './MatchReviewModal';
import type { MatchSuggestion } from '@/types/models';

interface SuggestedMatchItem {
  itemId: string;
  supplierCode: string;
  description: string;
  suggestedSKU: string;
  productName: string;
  confidence: number;
  supplierName: string;
  price: number;
  supplierId: string;
  pricelistId: string;
}

interface MatchingQueueActionsProps {
  /**
   * List of suggested matches to display
   */
  suggestedMatches: SuggestedMatchItem[];
}

/**
 * MatchingQueueActions Component
 * 
 * Provides interactive actions for reviewing matches.
 */
export default function MatchingQueueActions({
  suggestedMatches,
}: MatchingQueueActionsProps) {
  const [selectedMatch, setSelectedMatch] = useState<SuggestedMatchItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processedItems, setProcessedItems] = useState<Set<string>>(new Set());

  // Inject "Review Match" buttons into the DataTable
  useEffect(() => {
    const suggestedTable = document.querySelector('.suggested-matches-section .data-table');
    if (!suggestedTable) return;

    const tbody = suggestedTable.querySelector('tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      const actionsCell = cells[cells.length - 1];
      
      if (actionsCell && suggestedMatches[index] && !processedItems.has(suggestedMatches[index].itemId)) {
        actionsCell.innerHTML = '';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex items-center justify-center gap-2';
        
        const reviewButton = document.createElement('button');
        reviewButton.className = 'review-btn px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm hover:shadow-md active:scale-95';
        reviewButton.textContent = 'Review Match';
        reviewButton.setAttribute('data-match-index', index.toString());
        
        reviewButton.addEventListener('click', () => {
          handleReviewClick(suggestedMatches[index]);
        });
        
        buttonContainer.appendChild(reviewButton);
        actionsCell.appendChild(buttonContainer);
      } else if (actionsCell && processedItems.has(suggestedMatches[index]?.itemId)) {
        // Show processed status
        actionsCell.innerHTML = `
          <div class="flex items-center justify-center">
            <span class="px-3 py-1 bg-green-100 text-green-800 rounded-md text-sm font-medium">
              ✓ Processed
            </span>
          </div>
        `;
      }
    });
  }, [suggestedMatches, processedItems]);

  const handleReviewClick = (match: SuggestedMatchItem) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Clear selection after modal animation completes
    setTimeout(() => {
      setSelectedMatch(null);
    }, 300);
  };

  const handleConfirm = () => {
    if (selectedMatch) {
      setProcessedItems(prev => new Set(prev).add(selectedMatch.itemId));
      
      // Close modal and refresh page after short delay
      setTimeout(() => {
        handleCloseModal();
        // Reload page to reflect updated status
        window.location.reload();
      }, 1500);
    }
  };

  const handleReject = () => {
    if (selectedMatch) {
      setProcessedItems(prev => new Set(prev).add(selectedMatch.itemId));
      
      // Close modal and refresh page after short delay
      setTimeout(() => {
        handleCloseModal();
        // Reload page to reflect updated status
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <>
      {/* Match Review Modal */}
      {selectedMatch && (
        <MatchReviewModal
          isOpen={isModalOpen}
          suggestion={{
            supplierCode: selectedMatch.supplierCode,
            suggestedSKU: selectedMatch.suggestedSKU,
            productName: selectedMatch.productName,
            confidence: selectedMatch.confidence,
            reason: `AI-powered match based on product description similarity (${(selectedMatch.confidence * 100).toFixed(1)}% confidence)`,
          }}
          supplierProduct={{
            itemId: selectedMatch.itemId,
            supplierCode: selectedMatch.supplierCode,
            description: selectedMatch.description,
            price: selectedMatch.price,
            supplierId: selectedMatch.supplierId,
            supplierName: selectedMatch.supplierName,
            pricelistId: selectedMatch.pricelistId,
          }}
          onClose={handleCloseModal}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      )}
    </>
  );
}

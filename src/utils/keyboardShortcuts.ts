/**
 * Keyboard Shortcuts System
 * 
 * Provides keyboard shortcut registration and handling for frequently used operations.
 * Validates Requirement 20.4
 */

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'forms' | 'general';
  scope?: string; // Optional scope to limit shortcut to specific pages
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled = true;

  /**
   * Register a keyboard shortcut
   */
  register(id: string, shortcut: KeyboardShortcut): void {
    this.shortcuts.set(id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Get all registered shortcuts, optionally filtered by category
   */
  getShortcuts(category?: string): KeyboardShortcut[] {
    const shortcuts = Array.from(this.shortcuts.values());
    if (category) {
      return shortcuts.filter(s => s.category === category);
    }
    return shortcuts;
  }

  /**
   * Get all shortcuts grouped by category
   */
  getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    const shortcuts = Array.from(this.shortcuts.values());
    const grouped: Record<string, KeyboardShortcut[]> = {
      navigation: [],
      actions: [],
      forms: [],
      general: []
    };

    shortcuts.forEach(shortcut => {
      grouped[shortcut.category].push(shortcut);
    });

    return grouped;
  }

  /**
   * Format a shortcut for display
   */
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    
    // Detect OS for proper modifier key display
    const isMac = typeof navigator !== 'undefined' && 
                  /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    
    if (shortcut.ctrlKey) parts.push(isMac ? 'Cmd' : 'Ctrl');
    if (shortcut.altKey) parts.push(isMac ? 'Opt' : 'Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.metaKey) parts.push('Meta');
    
    // Format key name
    const keyName = shortcut.key.length === 1 
      ? shortcut.key.toUpperCase() 
      : shortcut.key;
    
    parts.push(keyName);
    
    return parts.join(' + ');
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in input fields (except for Escape)
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.tagName === 'SELECT' ||
                        target.isContentEditable;
    
    if (isInputField && event.key !== 'Escape') {
      return;
    }

    // Find matching shortcut
    for (const [id, shortcut] of this.shortcuts) {
      if (this.matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        break;
      }
    }
  };

  /**
   * Check if event matches a shortcut definition
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    // Key must match (case-insensitive)
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
      return false;
    }

    // Modifiers must match exactly
    if (!!event.ctrlKey !== !!shortcut.ctrlKey) return false;
    if (!!event.altKey !== !!shortcut.altKey) return false;
    if (!!event.shiftKey !== !!shortcut.shiftKey) return false;
    if (!!event.metaKey !== !!shortcut.metaKey) return false;

    return true;
  }

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable keyboard shortcuts
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Initialize the keyboard shortcut manager
   */
  init(): void {
    if (typeof window === 'undefined') return;
    
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Register default shortcuts
    this.registerDefaultShortcuts();
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    if (typeof window === 'undefined') return;
    
    document.removeEventListener('keydown', this.handleKeyDown);
    this.shortcuts.clear();
  }

  /**
   * Register default global shortcuts
   * Task 40.1: Keyboard shortcuts for frequent operations (Requirement 20.4)
   */
  private registerDefaultShortcuts(): void {
    // Navigation shortcuts - Alt + Key for quick page navigation
    this.register('goto-dashboard', {
      key: 'h',
      ctrlKey: true,
      description: 'Go to Dashboard',
      category: 'navigation',
      action: () => window.location.href = '/'
    });

    this.register('goto-products', {
      key: 'p',
      altKey: true,
      description: 'Go to Products',
      category: 'navigation',
      action: () => window.location.href = '/products'
    });

    this.register('goto-inventory', {
      key: 'i',
      altKey: true,
      description: 'Go to Inventory',
      category: 'navigation',
      action: () => window.location.href = '/inventory'
    });

    this.register('goto-suppliers', {
      key: 's',
      altKey: true,
      description: 'Go to Suppliers',
      category: 'navigation',
      action: () => window.location.href = '/suppliers'
    });

    this.register('goto-pricelists', {
      key: 'l',
      altKey: true,
      description: 'Go to Pricelists',
      category: 'navigation',
      action: () => window.location.href = '/pricelists'
    });

    this.register('goto-receiving', {
      key: 'r',
      altKey: true,
      description: 'Go to Receiving',
      category: 'navigation',
      action: () => window.location.href = '/receiving'
    });

    this.register('goto-pos', {
      key: 'o',
      altKey: true,
      description: 'Go to POS',
      category: 'navigation',
      action: () => window.location.href = '/pos'
    });

    this.register('goto-reports', {
      key: 't',
      altKey: true,
      description: 'Go to Reports',
      category: 'navigation',
      action: () => window.location.href = '/reports'
    });

    this.register('goto-pricing', {
      key: 'c',
      altKey: true,
      description: 'Go to Pricing',
      category: 'navigation',
      action: () => window.location.href = '/pricing'
    });

    // General shortcuts
    this.register('show-help', {
      key: '?',
      shiftKey: true,
      description: 'Show Keyboard Shortcuts Help',
      category: 'general',
      action: () => {
        // Show help modal
        const helpModal = document.getElementById('keyboard-shortcuts-modal');
        if (helpModal) {
          (helpModal as any).modalController?.showModal();
        }
      }
    });

    this.register('show-help-f1', {
      key: 'F1',
      description: 'Show Keyboard Shortcuts Help',
      category: 'general',
      action: () => {
        // Show help modal
        const helpModal = document.getElementById('keyboard-shortcuts-modal');
        if (helpModal) {
          (helpModal as any).modalController?.showModal();
        }
      }
    });

    this.register('quick-search', {
      key: 'k',
      ctrlKey: true,
      description: 'Quick Search',
      category: 'general',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[name="search"], #search-input, #sku-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    this.register('search-slash', {
      key: '/',
      description: 'Focus Search Bar',
      category: 'general',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[name="search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    this.register('escape', {
      key: 'Escape',
      description: 'Close Modals/Clear Focus',
      category: 'general',
      action: () => {
        // Close any open modals
        const openModals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
        openModals.forEach(modal => {
          (modal as any).modalController?.hideModal();
        });
        
        // Blur active element
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    });

    // Action shortcuts - Task 40.1: New product, Save, POS scan
    this.register('new-product', {
      key: 'n',
      ctrlKey: true,
      description: 'New Product (from Products page)',
      category: 'actions',
      action: () => {
        if (window.location.pathname.includes('/products')) {
          const newBtn = document.querySelector<HTMLButtonElement>('a[href*="/products/new"], button.btn-new-product');
          if (newBtn) {
            newBtn.click();
          } else {
            // Navigate to new product page if it exists
            window.location.href = '/products/new';
          }
        }
      }
    });

    this.register('save-form', {
      key: 's',
      ctrlKey: true,
      description: 'Save Form',
      category: 'forms',
      action: () => {
        // Find visible forms with save button
        const saveBtn = document.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled]), .btn-save:not([disabled])');
        if (saveBtn) {
          saveBtn.click();
        }
      }
    });

    this.register('pos-quick-scan', {
      key: 'F2',
      description: 'Focus POS Scan Input',
      category: 'actions',
      action: () => {
        if (window.location.pathname.includes('/pos')) {
          const skuInput = document.querySelector<HTMLInputElement>('#sku-input');
          if (skuInput) {
            skuInput.focus();
            skuInput.select();
          }
        }
      }
    });

    this.register('refresh', {
      key: 'r',
      ctrlKey: true,
      shiftKey: true,
      description: 'Refresh Page',
      category: 'general',
      action: () => {
        window.location.reload();
      }
    });
  }
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcutManager();

// Auto-initialize when module loads in browser
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => keyboardShortcuts.init());
  } else {
    keyboardShortcuts.init();
  }
}

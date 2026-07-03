/**
 * Unit Tests for Keyboard Shortcuts System
 * 
 * Tests the KeyboardShortcutManager functionality including:
 * - Shortcut registration and unregistration
 * - Keyboard event handling and matching
 * - Modifier key combinations
 * - Input field exceptions
 * - Help modal integration
 * - Formatting for display
 * 
 * Validates Requirement 20.4: THE System SHALL support keyboard shortcuts for frequently used operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { keyboardShortcuts, type KeyboardShortcut } from './keyboardShortcuts';

describe('KeyboardShortcutManager', () => {
  beforeEach(() => {
    // Clear all shortcuts before each test
    keyboardShortcuts.destroy();
    keyboardShortcuts.init();
  });

  afterEach(() => {
    keyboardShortcuts.destroy();
  });

  describe('Shortcut Registration', () => {
    it('should register a new shortcut', () => {
      const mockAction = vi.fn();
      const shortcut: KeyboardShortcut = {
        key: 'x', // Use a key not used by default shortcuts
        ctrlKey: true,
        description: 'Test shortcut',
        category: 'general',
        action: mockAction
      };

      keyboardShortcuts.register('test-shortcut', shortcut);
      const shortcuts = keyboardShortcuts.getShortcuts();

      expect(shortcuts).toContainEqual(expect.objectContaining({
        key: 'x',
        ctrlKey: true,
        description: 'Test shortcut'
      }));
    });

    it('should unregister a shortcut', () => {
      const mockAction = vi.fn();
      const shortcut: KeyboardShortcut = {
        key: 'x', // Use unique key
        description: 'Test shortcut',
        category: 'general',
        action: mockAction
      };

      keyboardShortcuts.register('test-shortcut-unreg', shortcut);
      keyboardShortcuts.unregister('test-shortcut-unreg');
      
      const shortcuts = keyboardShortcuts.getShortcuts();
      expect(shortcuts.find(s => s.key === 'x' && s.description === 'Test shortcut')).toBeUndefined();
    });

    it('should allow overwriting existing shortcuts', () => {
      const mockAction1 = vi.fn();
      const mockAction2 = vi.fn();
      
      const shortcut1: KeyboardShortcut = {
        key: 'y', // Use unique key
        description: 'Test 1',
        category: 'general',
        action: mockAction1
      };
      
      const shortcut2: KeyboardShortcut = {
        key: 'y',
        description: 'Test 2',
        category: 'general',
        action: mockAction2
      };

      keyboardShortcuts.register('test-overwrite', shortcut1);
      keyboardShortcuts.register('test-overwrite', shortcut2);
      
      const shortcuts = keyboardShortcuts.getShortcuts();
      const testShortcut = shortcuts.find(s => s.key === 'y');
      
      expect(testShortcut?.description).toBe('Test 2');
    });
  });

  describe('Shortcut Retrieval', () => {
    beforeEach(() => {
      keyboardShortcuts.register('nav-1', {
        key: 'd',
        altKey: true,
        description: 'Dashboard',
        category: 'navigation',
        action: () => {}
      });
      
      keyboardShortcuts.register('action-1', {
        key: 's',
        ctrlKey: true,
        description: 'Save',
        category: 'actions',
        action: () => {}
      });
    });

    it('should get all shortcuts', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      expect(shortcuts.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter shortcuts by category', () => {
      const navShortcuts = keyboardShortcuts.getShortcuts('navigation');
      expect(navShortcuts.every(s => s.category === 'navigation')).toBe(true);
    });

    it('should group shortcuts by category', () => {
      const grouped = keyboardShortcuts.getShortcutsByCategory();
      
      expect(grouped).toHaveProperty('navigation');
      expect(grouped).toHaveProperty('actions');
      expect(grouped).toHaveProperty('forms');
      expect(grouped).toHaveProperty('general');
      
      expect(Array.isArray(grouped.navigation)).toBe(true);
      expect(Array.isArray(grouped.actions)).toBe(true);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should register a simple key shortcut', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-simple', {
        key: 'k',
        description: 'Test',
        category: 'general',
        action: mockAction
      });

      const shortcuts = keyboardShortcuts.getShortcuts();
      const testShortcut = shortcuts.find(s => s.key === 'k');
      expect(testShortcut).toBeDefined();
    });

    it('should register Ctrl+key combinations', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-ctrl', {
        key: 'k',
        ctrlKey: true,
        description: 'Save',
        category: 'forms',
        action: mockAction
      });

      const shortcuts = keyboardShortcuts.getShortcuts();
      const testShortcut = shortcuts.find(s => s.key === 'k' && s.ctrlKey);
      expect(testShortcut).toBeDefined();
      expect(testShortcut?.ctrlKey).toBe(true);
    });

    it('should register Alt+key combinations', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-alt', {
        key: 'k',
        altKey: true,
        description: 'Dashboard',
        category: 'navigation',
        action: mockAction
      });

      const shortcuts = keyboardShortcuts.getShortcuts();
      const testShortcut = shortcuts.find(s => s.key === 'k' && s.altKey);
      expect(testShortcut).toBeDefined();
      expect(testShortcut?.altKey).toBe(true);
    });

    it('should register Shift+key combinations', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-shift', {
        key: 'k',
        shiftKey: true,
        description: 'Help',
        category: 'general',
        action: mockAction
      });

      const shortcuts = keyboardShortcuts.getShortcuts();
      const testShortcut = shortcuts.find(s => s.key === 'k' && s.shiftKey);
      expect(testShortcut).toBeDefined();
      expect(testShortcut?.shiftKey).toBe(true);
    });

    it('should register complex modifier combinations', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-complex', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        description: 'Refresh',
        category: 'general',
        action: mockAction
      });

      const shortcuts = keyboardShortcuts.getShortcuts();
      const testShortcut = shortcuts.find(s => s.key === 'k' && s.ctrlKey && s.shiftKey);
      expect(testShortcut).toBeDefined();
      expect(testShortcut?.ctrlKey).toBe(true);
      expect(testShortcut?.shiftKey).toBe(true);
    });

    it('should support same key with different modifiers', () => {
      const mockAction1 = vi.fn();
      const mockAction2 = vi.fn();
      
      keyboardShortcuts.register('test-no-mod', {
        key: 'k',
        description: 'Just K',
        category: 'general',
        action: mockAction1
      });
      
      keyboardShortcuts.register('test-ctrl-mod', {
        key: 'k',
        ctrlKey: true,
        description: 'Ctrl+K',
        category: 'forms',
        action: mockAction2
      });
      
      const shortcuts = keyboardShortcuts.getShortcuts();
      const kShortcuts = shortcuts.filter(s => s.key === 'k');
      
      expect(kShortcuts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Input Field Exception', () => {
    it('should NOT trigger shortcuts when typing in input fields', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test', {
        key: 't',
        description: 'Test',
        category: 'general',
        action: mockAction
      });

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 't',
        bubbles: true
      });
      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      
      document.dispatchEvent(event);

      expect(mockAction).not.toHaveBeenCalled();
      
      document.body.removeChild(input);
    });

    it('should NOT trigger shortcuts when typing in textarea', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test', {
        key: 't',
        description: 'Test',
        category: 'general',
        action: mockAction
      });

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', { key: 't' });
      Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
      
      document.dispatchEvent(event);

      expect(mockAction).not.toHaveBeenCalled();
      
      document.body.removeChild(textarea);
    });

    it('should NOT trigger shortcuts when typing in contentEditable', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-contenteditable', {
        key: 't',
        description: 'Test',
        category: 'general',
        action: mockAction
      });

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();

      // Create event that bubbles to document
      const event = new KeyboardEvent('keydown', { 
        key: 't', 
        bubbles: true,
        cancelable: true
      });
      
      // Dispatch from the contentEditable element so it bubbles to document
      div.dispatchEvent(event);

      expect(mockAction).not.toHaveBeenCalled();
      
      // Clean up
      keyboardShortcuts.unregister('test-contenteditable');
      document.body.removeChild(div);
    });

    it('should allow Escape key even in input fields', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test-escape', {
        key: 'Escape',
        description: 'Close',
        category: 'general',
        action: mockAction
      });

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Create event that bubbles to document
      const event = new KeyboardEvent('keydown', { 
        key: 'Escape', 
        bubbles: true,
        cancelable: true
      });
      
      // Dispatch from the input element so it bubbles to document
      input.dispatchEvent(event);

      expect(mockAction).toHaveBeenCalled();
      
      // Clean up
      keyboardShortcuts.unregister('test-escape');
      document.body.removeChild(input);
    });
  });

  describe('Enable/Disable', () => {
    it('should disable all shortcuts', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test', {
        key: 't',
        description: 'Test',
        category: 'general',
        action: mockAction
      });

      keyboardShortcuts.disable();

      const event = new KeyboardEvent('keydown', { key: 't' });
      document.dispatchEvent(event);

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should re-enable shortcuts', () => {
      const mockAction = vi.fn();
      keyboardShortcuts.register('test', {
        key: 't',
        description: 'Test',
        category: 'general',
        action: mockAction
      });

      keyboardShortcuts.disable();
      keyboardShortcuts.enable();

      const event = new KeyboardEvent('keydown', { key: 't' });
      document.dispatchEvent(event);

      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('Shortcut Formatting', () => {
    it('should format single key shortcuts', () => {
      const shortcut: KeyboardShortcut = {
        key: 't',
        description: 'Test',
        category: 'general',
        action: () => {}
      };

      const formatted = keyboardShortcuts.formatShortcut(shortcut);
      expect(formatted).toBe('T');
    });

    it('should format Ctrl+key shortcuts', () => {
      const shortcut: KeyboardShortcut = {
        key: 's',
        ctrlKey: true,
        description: 'Save',
        category: 'forms',
        action: () => {}
      };

      const formatted = keyboardShortcuts.formatShortcut(shortcut);
      expect(formatted).toMatch(/Ctrl \+ S|Cmd \+ S/);
    });

    it('should format Alt+key shortcuts', () => {
      const shortcut: KeyboardShortcut = {
        key: 'd',
        altKey: true,
        description: 'Dashboard',
        category: 'navigation',
        action: () => {}
      };

      const formatted = keyboardShortcuts.formatShortcut(shortcut);
      expect(formatted).toMatch(/Alt \+ D|Opt \+ D/);
    });

    it('should format Shift+key shortcuts', () => {
      const shortcut: KeyboardShortcut = {
        key: '?',
        shiftKey: true,
        description: 'Help',
        category: 'general',
        action: () => {}
      };

      const formatted = keyboardShortcuts.formatShortcut(shortcut);
      expect(formatted).toBe('Shift + ?');
    });

    it('should format complex combinations', () => {
      const shortcut: KeyboardShortcut = {
        key: 'r',
        ctrlKey: true,
        shiftKey: true,
        description: 'Refresh',
        category: 'general',
        action: () => {}
      };

      const formatted = keyboardShortcuts.formatShortcut(shortcut);
      expect(formatted).toMatch(/Ctrl \+ Shift \+ R|Cmd \+ Shift \+ R/);
    });
  });

  describe('Default Shortcuts', () => {
    it('should register navigation shortcuts', () => {
      const shortcuts = keyboardShortcuts.getShortcuts('navigation');
      
      const dashboardShortcut = shortcuts.find(s => s.description.includes('Dashboard'));
      expect(dashboardShortcut).toBeDefined();
      expect(dashboardShortcut?.key).toBe('d');
      expect(dashboardShortcut?.altKey).toBe(true);
    });

    it('should register form shortcuts', () => {
      const shortcuts = keyboardShortcuts.getShortcuts('forms');
      
      const saveShortcut = shortcuts.find(s => s.description.includes('Save'));
      expect(saveShortcut).toBeDefined();
      expect(saveShortcut?.key).toBe('s');
      expect(saveShortcut?.ctrlKey).toBe(true);
    });

    it('should register general shortcuts', () => {
      const shortcuts = keyboardShortcuts.getShortcuts('general');
      
      const helpShortcut = shortcuts.find(s => s.description.includes('Keyboard Shortcuts'));
      expect(helpShortcut).toBeDefined();
      expect(helpShortcut?.key).toBe('?');
      expect(helpShortcut?.shiftKey).toBe(true);
    });

    it('should have search shortcut', () => {
      const shortcuts = keyboardShortcuts.getShortcuts('general');
      
      const searchShortcut = shortcuts.find(s => s.description.includes('Search'));
      expect(searchShortcut).toBeDefined();
      expect(searchShortcut?.key).toBe('/');
    });

    it('should have escape shortcut', () => {
      const shortcuts = keyboardShortcuts.getShortcuts('general');
      
      const escapeShortcut = shortcuts.find(s => s.key === 'Escape');
      expect(escapeShortcut).toBeDefined();
    });
  });

  describe('Requirement 20.4 Validation: Frequently Used Operations', () => {
    it('should support navigation to Dashboard (Alt+D)', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      const dashboardShortcut = shortcuts.find(s => 
        s.key === 'd' && s.altKey && s.description.includes('Dashboard')
      );
      
      expect(dashboardShortcut).toBeDefined();
    });

    it('should support navigation to Products (Alt+P)', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      const productsShortcut = shortcuts.find(s => 
        s.key === 'p' && s.altKey && s.description.includes('Products')
      );
      
      expect(productsShortcut).toBeDefined();
    });

    it('should support navigation to Inventory (Alt+I)', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      const inventoryShortcut = shortcuts.find(s => 
        s.key === 'i' && s.altKey && s.description.includes('Inventory')
      );
      
      expect(inventoryShortcut).toBeDefined();
    });

    it('should support saving forms (Ctrl+S)', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      const saveShortcut = shortcuts.find(s => 
        s.key === 's' && s.ctrlKey && s.description.includes('Save')
      );
      
      expect(saveShortcut).toBeDefined();
    });

    it('should support search focus (/)', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      const searchShortcut = shortcuts.find(s => 
        s.key === '/' && s.description.includes('Search')
      );
      
      expect(searchShortcut).toBeDefined();
    });

    it('should support help modal (Shift+?)', () => {
      const shortcuts = keyboardShortcuts.getShortcuts();
      const helpShortcut = shortcuts.find(s => 
        s.key === '?' && s.shiftKey && s.description.includes('Keyboard Shortcuts')
      );
      
      expect(helpShortcut).toBeDefined();
    });
  });
});

/**
 * Property: Shortcut Uniqueness
 * 
 * For any registered keyboard shortcut, there should be no other shortcut
 * with the exact same key combination (same key + same modifiers).
 * This prevents shortcut conflicts.
 * 
 * Validates Requirement 20.4
 */
describe('Shortcut Uniqueness Property', () => {
  beforeEach(() => {
    keyboardShortcuts.destroy();
    keyboardShortcuts.init();
  });

  afterEach(() => {
    keyboardShortcuts.destroy();
  });

  it('should not have duplicate shortcut combinations', () => {
    const shortcuts = keyboardShortcuts.getShortcuts();
    const combinations = new Set<string>();
    
    shortcuts.forEach(shortcut => {
      const combo = [
        shortcut.key,
        shortcut.ctrlKey ? 'ctrl' : '',
        shortcut.altKey ? 'alt' : '',
        shortcut.shiftKey ? 'shift' : '',
        shortcut.metaKey ? 'meta' : ''
      ].filter(Boolean).join('+');
      
      expect(combinations.has(combo)).toBe(false);
      combinations.add(combo);
    });
  });

  it('should allow same key with different modifiers', () => {
    keyboardShortcuts.register('test1', {
      key: 's',
      description: 'Just S',
      category: 'general',
      action: () => {}
    });
    
    keyboardShortcuts.register('test2', {
      key: 's',
      ctrlKey: true,
      description: 'Ctrl+S',
      category: 'forms',
      action: () => {}
    });
    
    const shortcuts = keyboardShortcuts.getShortcuts();
    const sShortcuts = shortcuts.filter(s => s.key === 's');
    
    expect(sShortcuts.length).toBeGreaterThanOrEqual(2);
  });
});

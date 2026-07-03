/**
 * Unit tests for parser utilities
 */

import { describe, it, expect } from 'vitest';
import { detectFormat, parseCSVContent, ParseError } from './parser.js';

describe('Parser Utilities', () => {
  describe('detectFormat', () => {
    it('should detect CSV format', () => {
      expect(detectFormat('pricelist.csv')).toBe('csv');
      expect(detectFormat('PRICELIST.CSV')).toBe('csv');
    });

    it('should detect Excel format', () => {
      expect(detectFormat('pricelist.xls')).toBe('excel');
      expect(detectFormat('pricelist.xlsx')).toBe('excel');
      expect(detectFormat('PRICELIST.XLSX')).toBe('excel');
    });

    it('should detect PDF format', () => {
      expect(detectFormat('pricelist.pdf')).toBe('pdf');
      expect(detectFormat('PRICELIST.PDF')).toBe('pdf');
    });

    it('should return unknown for unsupported formats', () => {
      expect(detectFormat('pricelist.txt')).toBe('unknown');
      expect(detectFormat('pricelist.doc')).toBe('unknown');
      expect(detectFormat('pricelist')).toBe('unknown');
    });
  });

  describe('parseCSVContent', () => {
    it('should parse valid CSV with required columns', () => {
      const csv = `supplier_code,description,price
ABC123,Widget A,10.50
XYZ789,Widget B,25.99`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.supplierId).toBe('SUPPLIER001');
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        supplierCode: 'ABC123',
        description: 'Widget A',
        price: 10.50,
      });
      expect(result.items[1]).toEqual({
        supplierCode: 'XYZ789',
        description: 'Widget B',
        price: 25.99,
      });
    });

    it('should parse CSV with optional UOM column', () => {
      const csv = `code,description,price,uom
ABC123,Widget A,10.50,EA
XYZ789,Widget B,25.99,BOX`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].uom).toBe('EA');
      expect(result.items[1].uom).toBe('BOX');
    });

    it('should handle various column name variations', () => {
      const csv = `product_code,product_description,unit_price
ABC123,Widget A,10.50`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].supplierCode).toBe('ABC123');
    });

    it('should skip empty rows', () => {
      const csv = `supplier_code,description,price
ABC123,Widget A,10.50

XYZ789,Widget B,25.99`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items).toHaveLength(2);
    });

    it('should handle quoted fields with commas', () => {
      const csv = `supplier_code,description,price
ABC123,"Widget A, Premium Edition",10.50`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items[0].description).toBe('Widget A, Premium Edition');
    });

    it('should throw error for empty file', () => {
      expect(() => {
        parseCSVContent('', 'SUPPLIER001');
      }).toThrow(ParseError);
    });

    it('should throw error for missing required columns', () => {
      const csv = `code,description
ABC123,Widget A`;

      expect(() => {
        parseCSVContent(csv, 'SUPPLIER001');
      }).toThrow(ParseError);
      expect(() => {
        parseCSVContent(csv, 'SUPPLIER001');
      }).toThrow(/price/i);
    });

    it('should throw error for insufficient data', () => {
      const csv = `supplier_code,description,price`;

      expect(() => {
        parseCSVContent(csv, 'SUPPLIER001');
      }).toThrow(ParseError);
      expect(() => {
        parseCSVContent(csv, 'SUPPLIER001');
      }).toThrow(/Insufficient data/i);
    });

    it('should handle price formats with currency symbols', () => {
      const csv = `supplier_code,description,price
ABC123,Widget A,$10.50
XYZ789,Widget B,€25.99`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items[0].price).toBe(10.50);
      expect(result.items[1].price).toBe(25.99);
    });

    it('should handle prices with thousands separators', () => {
      const csv = `supplier_code,description,price
ABC123,Widget A,"1,234.56"`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items[0].price).toBe(1234.56);
    });

    it('should round prices to 2 decimal places', () => {
      const csv = `supplier_code,description,price
ABC123,Widget A,10.505`;

      const result = parseCSVContent(csv, 'SUPPLIER001');

      expect(result.items[0].price).toBe(10.51);
    });
  });
});

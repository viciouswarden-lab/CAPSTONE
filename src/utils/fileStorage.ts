/**
 * Local File Storage Utility
 * 
 * Provides file storage operations for local filesystem as a replacement
 * for Firebase Cloud Storage (which requires Blaze plan).
 * 
 * Security features:
 * - File type validation (CSV, Excel, PDF only)
 * - File size limits (10MB max)
 * - Filename sanitization (prevent path traversal)
 * - Directory structure enforcement
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Base uploads directory
export const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');

// Subdirectories for different file types
export const PRICELISTS_DIR = path.join(UPLOADS_DIR, 'pricelists');
export const INVOICES_DIR = path.join(UPLOADS_DIR, 'invoices');
export const DELIVERY_RECEIPTS_DIR = path.join(UPLOADS_DIR, 'delivery_receipts');
export const REPORTS_DIR = path.join(UPLOADS_DIR, 'reports');

// File size limit (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file extensions
export const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.pdf'];

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
];

/**
 * File validation error
 */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Sanitize filename to prevent directory traversal and special characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = path.basename(filename);
  
  // Replace special characters except dots, dashes, and underscores
  return basename.replace(/[^a-zA-Z0-9.-_]/g, '_');
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): void {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Validate file extension
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new FileValidationError(
      `File type not allowed. Accepted formats: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }

  // Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new FileValidationError(
      `Invalid file type. Expected: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Save uploaded file to local storage
 * 
 * @param file - File to save
 * @param category - Category directory (pricelists, invoices, etc.)
 * @param subPath - Subdirectory path (e.g., supplierId, userId)
 * @returns Relative file path
 */
export async function saveFile(
  file: File,
  category: string,
  subPath: string
): Promise<string> {
  // Validate file
  validateFile(file);

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);
  const timestamp = Date.now();
  const filename = `${timestamp}_${sanitizedFilename}`;

  // Build directory path
  const categoryDir = path.join(UPLOADS_DIR, category);
  const targetDir = path.join(categoryDir, subPath);
  
  // Ensure directory exists
  await ensureDirectory(targetDir);

  // Full file path
  const filePath = path.join(targetDir, filename);

  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Write file
  await fs.writeFile(filePath, buffer);

  // Return relative path from uploads directory
  const relativePath = path.relative(UPLOADS_DIR, filePath);
  return relativePath;
}

/**
 * Read file from local storage
 * 
 * @param relativePath - Relative path from uploads directory
 * @returns File buffer
 */
export async function readFile(relativePath: string): Promise<Buffer> {
  const filePath = path.join(UPLOADS_DIR, relativePath);
  
  // Security check: ensure path is within uploads directory
  const resolvedPath = path.resolve(filePath);
  const uploadsPath = path.resolve(UPLOADS_DIR);
  
  if (!resolvedPath.startsWith(uploadsPath)) {
    throw new Error('Invalid file path: path traversal detected');
  }

  return await fs.readFile(filePath);
}

/**
 * Delete file from local storage
 * 
 * @param relativePath - Relative path from uploads directory
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, relativePath);
  
  // Security check: ensure path is within uploads directory
  const resolvedPath = path.resolve(filePath);
  const uploadsPath = path.resolve(UPLOADS_DIR);
  
  if (!resolvedPath.startsWith(uploadsPath)) {
    throw new Error('Invalid file path: path traversal detected');
  }

  await fs.unlink(filePath);
}

/**
 * Get absolute path for a relative path
 * 
 * @param relativePath - Relative path from uploads directory
 * @returns Absolute file path
 */
export function getAbsolutePath(relativePath: string): string {
  const filePath = path.join(UPLOADS_DIR, relativePath);
  
  // Security check: ensure path is within uploads directory
  const resolvedPath = path.resolve(filePath);
  const uploadsPath = path.resolve(UPLOADS_DIR);
  
  if (!resolvedPath.startsWith(uploadsPath)) {
    throw new Error('Invalid file path: path traversal detected');
  }

  return resolvedPath;
}

/**
 * Check if file exists
 * 
 * @param relativePath - Relative path from uploads directory
 * @returns True if file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const filePath = path.join(UPLOADS_DIR, relativePath);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size
 * 
 * @param relativePath - Relative path from uploads directory
 * @returns File size in bytes
 */
export async function getFileSize(relativePath: string): Promise<number> {
  const filePath = path.join(UPLOADS_DIR, relativePath);
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * List files in directory
 * 
 * @param category - Category directory
 * @param subPath - Subdirectory path (optional)
 * @returns Array of relative file paths
 */
export async function listFiles(
  category: string,
  subPath?: string
): Promise<string[]> {
  const targetDir = subPath
    ? path.join(UPLOADS_DIR, category, subPath)
    : path.join(UPLOADS_DIR, category);

  try {
    const files = await fs.readdir(targetDir, { recursive: true });
    return files
      .filter(file => {
        const fullPath = path.join(targetDir, file);
        return fs.stat(fullPath).then(s => s.isFile()).catch(() => false);
      })
      .map(file => path.relative(UPLOADS_DIR, path.join(targetDir, file)));
  } catch {
    return [];
  }
}

/**
 * Clean up old files (older than specified days)
 * 
 * @param category - Category directory
 * @param daysOld - Delete files older than this many days
 * @returns Number of files deleted
 */
export async function cleanupOldFiles(
  category: string,
  daysOld: number = 90
): Promise<number> {
  const categoryDir = path.join(UPLOADS_DIR, category);
  const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  
  let deletedCount = 0;

  try {
    const files = await fs.readdir(categoryDir, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && stats.mtimeMs < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
  } catch (error) {
    console.error('Error cleaning up old files:', error);
  }

  return deletedCount;
}

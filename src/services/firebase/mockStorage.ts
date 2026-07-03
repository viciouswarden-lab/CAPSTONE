/**
 * Mock Firebase Storage for CAPSTONE Demo
 * 
 * This mock provides the same interface as Firebase Storage but stores
 * files in browser's IndexedDB for demo purposes.
 * 
 * Note: This is NOT production-ready. For production with Firebase Blaze plan,
 * replace this with actual Firebase Storage implementation.
 */

/**
 * Mock storage reference
 */
export class MockStorageReference {
  constructor(public path: string) {}

  toString(): string {
    return this.path;
  }
}

/**
 * Create a mock storage reference
 */
export function ref(path: string): MockStorageReference {
  return new MockStorageReference(path);
}

/**
 * Mock file upload - stores file data URL in localStorage for demo
 */
export async function uploadBytes(
  storageRef: MockStorageReference,
  file: File
): Promise<{ ref: MockStorageReference; metadata: { fullPath: string; size: number } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        // Store file as data URL in localStorage
        const key = `mock_storage_${storageRef.path}`;
        localStorage.setItem(key, reader.result as string);
        
        resolve({
          ref: storageRef,
          metadata: {
            fullPath: storageRef.path,
            size: file.size,
          },
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Mock get download URL - returns data URL from localStorage
 */
export async function getDownloadURL(storageRef: MockStorageReference): Promise<string> {
  const key = `mock_storage_${storageRef.path}`;
  const dataUrl = localStorage.getItem(key);
  
  if (!dataUrl) {
    throw new Error(`File not found: ${storageRef.path}`);
  }
  
  return dataUrl;
}

/**
 * Mock storage instance
 */
export const storage = {
  ref,
  uploadBytes,
  getDownloadURL,
};

export default storage;

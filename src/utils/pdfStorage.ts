/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */

const DB_NAME = 'cecil_pines_documents_db';
const DB_VERSION = 1;
const STORE_NAME = 'uploaded_pdfs';

function openPdfDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function savePdfToStorage(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(dataUrl, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to save PDF to IndexedDB:', err);
  }
}

export async function getPdfFromStorage(key: string): Promise<string | null> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve PDF from IndexedDB:', err);
    return null;
  }
}

export async function removePdfFromStorage(key: string): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to delete PDF from IndexedDB:', err);
  }
}

export async function clearAllNewsletterPdfStorage(): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to clear PDF storage from IndexedDB:', err);
  }
}

export async function saveNewsletterPageImagesToIndexedDb(
  newsletterId: string,
  images: string[]
): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(images, `newsletter_pages_${newsletterId}`);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to save newsletter page images to IndexedDB:', err);
  }
}

export async function getNewsletterPageImagesFromIndexedDb(
  newsletterId: string
): Promise<string[] | null> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(`newsletter_pages_${newsletterId}`);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve newsletter page images from IndexedDB:', err);
    return null;
  }
}

/**
 * Converts a base64 data URL into an in-memory same-origin Blob URL.
 * Browsers block data: URLs inside embedded <object> and <iframe> elements for security,
 * whereas Blob URLs render natively without sandbox or navigation restrictions.
 */
export function convertDataUrlToBlobUrl(sourceUrl: string): string {
  if (!sourceUrl) return '';
  if (
    sourceUrl.startsWith('blob:') ||
    sourceUrl.startsWith('http://') ||
    sourceUrl.startsWith('https://') ||
    sourceUrl.startsWith('/')
  ) {
    return sourceUrl;
  }
  if (sourceUrl.startsWith('data:')) {
    try {
      const parts = sourceUrl.split(',');
      const header = parts[0];
      const base64Data = parts[1];
      if (!base64Data) return sourceUrl;
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const binaryString = atob(base64Data.trim());
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn('Failed to convert base64 data URL to Blob URL:', err);
      return sourceUrl;
    }
  }
  return sourceUrl;
}


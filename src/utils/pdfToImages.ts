/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */

export interface ConvertedPageImage {
  pageNumber: number;
  blob?: Blob;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface ConvertPdfProgress {
  currentPage: number;
  totalPages: number;
  status: 'loading' | 'rendering' | 'completed';
}

/**
 * Standard PDF Reader and direct document helper
 */
export async function convertPdfToPageImages(
  input: File | Blob | ArrayBuffer | Uint8Array | string,
  _options?: {
    scale?: number;
    quality?: number;
    imageType?: string;
    onProgress?: (progress: ConvertPdfProgress) => void;
  }
): Promise<ConvertedPageImage[]> {
  // Direct file URL / data URL resolution
  if (typeof input === 'string') {
    return [{ pageNumber: 1, dataUrl: input }];
  }
  if (input instanceof File || input instanceof Blob) {
    return [{ pageNumber: 1, blob: input, dataUrl: URL.createObjectURL(input) }];
  }
  return [];
}

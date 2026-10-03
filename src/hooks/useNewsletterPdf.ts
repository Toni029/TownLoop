import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadNewsletterPdfFromFirestore } from '../services/storage';
import { convertDataUrlToBlobUrl, getPdfFromStorage, clearAllNewsletterPdfStorage } from '../utils/pdfStorage';
import type { NewsletterConfig } from '../types';

/** Only the server-confirmed current edition may be opened, including from local cache. */
export function useNewsletterPdf() {
  const [state, setState] = useState({ activePdfUrl: '', isLoading: true });
  useEffect(() => {
    let generation = 0;
    let ownedBlob = '';
    const clearBlob = () => {
      if (ownedBlob) URL.revokeObjectURL(ownedBlob);
      ownedBlob = '';
    };
    if (!db) { setState({ activePdfUrl: '', isLoading: false }); return; }
    const stop = onSnapshot(doc(db, 'newsletters', 'current'), { includeMetadataChanges: true }, async (snap) => {
      // Cached metadata cannot establish that an admin has not since removed the PDF.
      if (snap.metadata.fromCache) return;
      const currentGeneration = ++generation;
      clearBlob();
      setState({ activePdfUrl: '', isLoading: true });
      const config = snap.exists() ? snap.data() as NewsletterConfig : null;
      if (!config || config.isRemoved) {
        void clearAllNewsletterPdfStorage();
        setState({ activePdfUrl: '', isLoading: false });
        return;
      }
      try {
        let source = config.pdfUrl || config.fileUrl || '';
        let downloaded: Blob | null = null;
        if (/^(https?:|\/)/.test(source)) {
          try {
            const response = await fetch(source, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
            if (response.ok) {
              const file = await response.blob();
              if ((await file.slice(0, 5).text()) === '%PDF-') downloaded = file;
            }
          } catch { /* The confirmed current edition may still be available in Firestore. */ }
          if (!downloaded) source = '';
        }
        if (!source || source.startsWith('indexeddb:') || source.startsWith('blob:')) {
          source = config.id ? await getPdfFromStorage(`newsletter_pdf_${config.id}`) || '' : '';
          if (!source) source = await downloadNewsletterPdfFromFirestore(config.id || 'current') || '';
        }
        if (currentGeneration !== generation) return;
        const url = downloaded ? URL.createObjectURL(downloaded) : convertDataUrlToBlobUrl(source);
        if (downloaded || (url.startsWith('blob:') && !source.startsWith('blob:'))) ownedBlob = url;
        setState({ activePdfUrl: url, isLoading: false });
      } catch {
        if (currentGeneration === generation) setState({ activePdfUrl: '', isLoading: false });
      }
    }, () => { ++generation; clearBlob(); setState({ activePdfUrl: '', isLoading: false }); });
    return () => { ++generation; stop(); clearBlob(); };
  }, []);
  return state;
}

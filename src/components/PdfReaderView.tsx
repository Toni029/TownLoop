/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  BookOpen,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { getPdfFromStorage, convertDataUrlToBlobUrl } from '../utils/pdfStorage';

interface PdfReaderViewProps {
  fileUrl: string;
  pdfUrl?: string;
  fileName?: string;
  fileType?: string;
  title?: string;
  onClose?: () => void;
}

export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  fileUrl,
  pdfUrl,
  fileName = 'Newsletter.pdf',
  title = 'Community Newsletter',
  onClose,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(pdfUrl || fileUrl || '');
  const [isLoading, setIsLoading] = useState<boolean>(!resolvedUrl);
  const [blobUrl, setBlobUrl] = useState<string>(() => convertDataUrlToBlobUrl(pdfUrl || fileUrl || ''));

  useEffect(() => {
    let active = true;
    const initial = pdfUrl || fileUrl || '';

    if (initial && !initial.startsWith('indexeddb:')) {
      setResolvedUrl(initial);
      setIsLoading(false);
      return;
    }

    getPdfFromStorage('current_newsletter_pdf')
      .then((saved) => {
        if (active) {
          if (saved) {
            setResolvedUrl(saved);
          } else if (initial) {
            setResolvedUrl(initial);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedUrl(initial);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fileUrl, pdfUrl]);

  // Convert base64 data URLs to same-origin Blob URLs so browser security permits inline rendering
  useEffect(() => {
    if (!resolvedUrl) {
      setBlobUrl('');
      return;
    }

    const converted = convertDataUrlToBlobUrl(resolvedUrl);
    setBlobUrl(converted);

    return () => {
      if (converted && converted.startsWith('blob:') && !resolvedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(converted);
      }
    };
  }, [resolvedUrl]);

  const activePdfUrl = blobUrl || resolvedUrl;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[130] w-screen h-screen bg-stone-950 text-stone-100 flex flex-col select-none overflow-hidden"
    >
      {/* Top Header */}
      <header className="shrink-0 h-16 px-4 sm:px-6 flex items-center justify-between bg-stone-900/95 border-b border-stone-800 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-wide text-stone-200 truncate max-w-[220px] sm:max-w-md">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activePdfUrl && (
            <button
              type="button"
              onClick={async () => {
                try {
                  if (activePdfUrl.startsWith('blob:') || activePdfUrl.startsWith('data:')) {
                    const a = document.createElement('a');
                    a.href = activePdfUrl;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    return;
                  }
                  const res = await fetch(activePdfUrl);
                  const blob = await res.blob();
                  const bUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = bUrl;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(bUrl);
                } catch {
                  // Fallback
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition flex items-center gap-1.5 cursor-pointer"
              title="Download PDF to device"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white flex items-center justify-center transition border border-stone-700 cursor-pointer ml-1"
              title="Close Reader (Esc)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Embedded PDF View */}
      <main className="flex-1 w-full h-full p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-700 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-base font-bold text-stone-200">Opening newsletter...</p>
          </div>
        ) : activePdfUrl ? (
          <div className="w-full max-w-6xl mx-auto flex flex-col bg-white rounded-2xl border border-stone-800 shadow-2xl overflow-hidden relative">
            <object
              data={`${activePdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              type="application/pdf"
              width="100%"
              height="720px"
              className="w-full h-[720px] border-0 rounded-2xl bg-white shadow-inner"
              title={title}
            >
              <iframe
                src={`${activePdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                width="100%"
                height="720px"
                className="w-full h-[720px] border-0 rounded-2xl bg-white shadow-inner"
                title={title}
              >
                <embed
                  src={`${activePdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  type="application/pdf"
                  width="100%"
                  height="720px"
                  className="w-full h-[720px]"
                />
              </iframe>
            </object>
          </div>
        ) : (
          <div className="max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-700 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-stone-100">Document Notice</h4>
            <p className="text-xs text-stone-400">No document file was found to display.</p>
          </div>
        )}
      </main>
    </div>
  );
};



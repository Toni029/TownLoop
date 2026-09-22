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
  ExternalLink,
  BookOpen,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { getPdfFromStorage } from '../utils/pdfStorage';

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
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Open document in a separate browser tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open in New Tab</span>
            </a>
          )}

          {resolvedUrl && (
            <a
              href={resolvedUrl}
              download={fileName}
              className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition flex items-center gap-1.5 cursor-pointer"
              title="Download PDF to device"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
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
      <main className="flex-1 w-full h-full p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-700 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-base font-bold text-stone-200">Opening newsletter...</p>
          </div>
        ) : resolvedUrl ? (
          <div className="w-full h-full max-w-6xl mx-auto flex flex-col bg-white rounded-2xl border border-stone-800 shadow-2xl overflow-hidden">
            <object
              data={resolvedUrl}
              type="application/pdf"
              className="w-full flex-1 border-0 rounded-2xl bg-white min-h-[500px]"
            >
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-stone-900 text-stone-200 h-full">
                <FileText className="w-10 h-10 text-emerald-400 mb-2" />
                <p className="text-sm font-semibold">Unable to display PDF preview directly.</p>
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open PDF in New Tab
                </a>
              </div>
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

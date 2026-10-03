import { InAppPdfDocument } from './InAppPdfDocument';
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
  Upload,
  AlertCircle,
} from 'lucide-react';
import { useNewsletterPdf } from '../hooks/useNewsletterPdf';
import type { NewsletterConfig } from '../types';

interface NewsletterGalleryViewProps {
  pageImages?: string[];
  fileUrl?: string;
  pdfUrl?: string;
  fileName?: string;
  title?: string;
  monthEdition?: string;
  newsletterConfig?: NewsletterConfig;
  onClose: () => void;
  onOpenUploadModal?: () => void;
  canManage?: boolean;
}

export const NewsletterGalleryView: React.FC<NewsletterGalleryViewProps> = ({
  fileUrl,
  pdfUrl,
  fileName = 'Newsletter.pdf',
  title = 'Community Newsletter',
  monthEdition,
  newsletterConfig,
  onClose,
  onOpenUploadModal,
  canManage = false,
}) => {
  const { activePdfUrl, isLoading } = useNewsletterPdf();

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 h-[100dvh] z-[120] bg-stone-950/90 backdrop-blur-md flex flex-col overflow-hidden select-none animate-in fade-in duration-200"
      id="newsletter-reader-modal"
    >
      {/* Top Liquid Glass Navigation Header */}
      <header className="shrink-0 bg-stone-900/95 border-b border-stone-800/80 px-2 sm:px-3 py-1 text-white flex items-center justify-between gap-3 shadow-lg z-20 backdrop-blur-xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-stone-100 truncate serif-title leading-snug">
              {title}
            </h1>
            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              {monthEdition && <span className="font-semibold text-emerald-400">{monthEdition}</span>}
              <span>•</span>
              <span className="text-stone-400">Official Resident Edition</span>
            </div>
          </div>
        </div>

        {/* Action Controls (Download, Upload New, Close) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Download Original PDF Button */}
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
                  if (!res.ok) throw new Error('This newsletter is no longer available.');
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
              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Download PDF to your device"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Download</span>
            </button>
          )}

          {/* Admin Manage/Upload Button */}
          {canManage && onOpenUploadModal && (
            <button
              onClick={() => {
                onClose();
                onOpenUploadModal();
              }}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
              title="Upload new edition PDF"
            >
              <Upload className="w-3.5 h-3.5 text-stone-400" />
              <span>Upload Edition</span>
            </button>
          )}

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer ml-1"
            title="Close Reader (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main PDF Frame Viewer Area */}
      <main className="flex-1 min-h-0 w-full overflow-hidden p-0.5 sm:p-1 flex flex-col items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-stone-200">Loading newsletter document...</p>
          </div>
        ) : activePdfUrl ? (
          <InAppPdfDocument key={activePdfUrl} url={activePdfUrl} />
        ) : (
          <div className="max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-700 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-stone-100">Newsletter Document Notice</h4>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                No active PDF document found. If you are a community administrator, you can upload a new edition PDF.
              </p>
            </div>
            {canManage && onOpenUploadModal && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenUploadModal();
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Upload Newsletter PDF
                </button>
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
};


/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  BookOpen,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type {
  NewsletterConfig,
  ExtractedRsvpEventInput,
  ExtractedPinnedHighlightInput,
  UserProfile,
} from '../types';
import { savePdfToStorage } from '../utils/pdfStorage';
import { uploadNewsletterPdfToStorage } from '../services/storage';
import { saveNewsletterConfigToFirestore } from '../services/firestoreSync';

interface UploadNewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: NewsletterConfig;
  onSaveConfig: (newConfig: NewsletterConfig) => void;
  onRemoveNewsletter: () => void;
  onExtractContent?: (data: {
    rsvp_events: ExtractedRsvpEventInput[];
    pinned_highlights: ExtractedPinnedHighlightInput[];
  }) => void;
  currentUser?: UserProfile | null;
}

export const UploadNewsletterModal: React.FC<UploadNewsletterModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveConfig,
  onRemoveNewsletter,
  onExtractContent,
  currentUser,
}) => {
  const [editionTitle, setEditionTitle] = useState(
    currentConfig.editionTitle || 'The Breeze: September 2026'
  );
  const [monthEdition, setMonthEdition] = useState(
    currentConfig.monthEdition || 'September 2026'
  );
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    dataUrl: string;
    type: string;
  } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file) return;

    // Verify PDF type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF document (.pdf).');
      return;
    }

    // Size check: up to 30MB
    if (file.size > 30 * 1024 * 1024) {
      setError('File size exceeds 30MB limit. Please choose a smaller PDF.');
      return;
    }

    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;

    setRawFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      savePdfToStorage('current_newsletter_pdf', dataUrl).catch(() => {});
      setSelectedFile({
        name: file.name,
        size: sizeStr,
        dataUrl,
        type: 'application/pdf',
      });

      // Auto-detect Month and Year from file name
      const nameLower = file.name.toLowerCase();
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      let detectedMonth: string | null = null;
      for (const m of monthNames) {
        if (nameLower.includes(m)) {
          detectedMonth = m.charAt(0).toUpperCase() + m.slice(1);
          break;
        }
      }
      const yearMatch = file.name.match(/\b(202\d)\b/);
      const detectedYear = yearMatch ? yearMatch[1] : '2026';

      if (detectedMonth) {
        setMonthEdition(`${detectedMonth} ${detectedYear}`);
        setEditionTitle(`The Breeze: ${detectedMonth} ${detectedYear}`);
      } else if (!editionTitle || editionTitle === 'The Breeze: September 2026') {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setEditionTitle(cleanName);
      }
    };
    reader.onerror = () => {
      setError('Failed to read PDF file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editionTitle.trim()) {
      setError('Please provide an edition title.');
      return;
    }

    const newsletterId = `newsletter-${Date.now()}`;
    setIsProcessing(true);
    setError(null);
    setStatusMessage('Preparing upload...');
    setProgressPercent(10);

    try {
      // 1. Direct PDF Upload to Firebase Storage under /newsletters/{id}/document.pdf
      let finalPdfUrl: string = selectedFile?.dataUrl || currentConfig.pdfUrl || currentConfig.fileUrl || '';

      if (rawFile) {
        setStatusMessage('Uploading raw PDF document (/newsletters/' + newsletterId + '/document.pdf)...');
        setProgressPercent(25);

        try {
          finalPdfUrl = await uploadNewsletterPdfToStorage({
            newsletterId,
            pdfFile: rawFile,
            currentUser,
            onProgress: ({ percent, message }) => {
              setProgressPercent(percent);
              setStatusMessage(message);
            },
          });
        } catch (uploadErr) {
          console.warn('Direct upload notice, falling back to local cached document:', uploadErr);
          if (selectedFile?.dataUrl) {
            finalPdfUrl = selectedFile.dataUrl;
          }
        }
      }

      // 2. Multimodal Gemini Intelligent Analysis (runs on PDF document data)
      let extractedData: {
        rsvp_events: ExtractedRsvpEventInput[];
        pinned_highlights: ExtractedPinnedHighlightInput[];
      } | null = null;

      if (onExtractContent && (selectedFile?.dataUrl || currentConfig.fileUrl)) {
        setStatusMessage('AI scanning all newsletter pages & sidebars for monthly RSVP events...');
        setProgressPercent(70);

        try {
          const res = await fetch('/api/newsletter/extract-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileDataUrl: selectedFile?.dataUrl || currentConfig.fileUrl,
              fileName: selectedFile?.name || currentConfig.fileName || 'document.pdf',
              fileType: 'application/pdf',
              editionTitle: editionTitle.trim(),
              monthEdition: monthEdition.trim(),
              textContent: textContent.trim(),
              isReanalysis: true,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (
              (Array.isArray(data.rsvp_events) && data.rsvp_events.length > 0) ||
              (Array.isArray(data.pinned_highlights) && data.pinned_highlights.length > 0)
            ) {
              extractedData = {
                rsvp_events: data.rsvp_events || [],
                pinned_highlights: data.pinned_highlights || [],
              };
              setStatusMessage(
                `Extracted ${extractedData.rsvp_events.length} monthly RSVP events & ${extractedData.pinned_highlights.length} highlights!`
              );
            }
          }
        } catch (extractErr) {
          console.warn('AI extraction notice:', extractErr);
        }
      }

      // 3. Save new newsletter document to Firestore
      setStatusMessage('Saving newsletter publication to Firestore...');
      setProgressPercent(90);

      const newConfig: NewsletterConfig = {
        id: newsletterId,
        editionTitle: editionTitle.trim(),
        monthEdition: monthEdition.trim() || 'Latest Edition',
        description:
          currentConfig.description ||
          'Official monthly publication for Cecil Pines Adult Living Community.',
        pdfUrl: finalPdfUrl,
        fileUrl: finalPdfUrl,
        fileName: selectedFile?.name || currentConfig.fileName || 'document.pdf',
        fileType: 'application/pdf',
        fileSize: selectedFile?.size || currentConfig.fileSize,
        uploadedAt: Date.now(),
        uploadedBy: currentUser?.name || 'Admin',
        isCustomUpload: true,
        isRemoved: false,
      };

      await saveNewsletterConfigToFirestore(newConfig).catch((err) => {
        console.warn('Firestore newsletter save notice:', err);
      });

      // Apply extracted events and highlights immediately
      if (extractedData && onExtractContent) {
        onExtractContent(extractedData);
      }

      onSaveConfig(newConfig);
      setProgressPercent(100);
      setStatusMessage('Published successfully!');

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 300);
    } catch (err: any) {
      console.error('Newsletter upload error:', err);
      setError(err?.message || 'Failed to upload and process newsletter. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleRemove = async () => {
    try {
      setIsProcessing(true);
      await onRemoveNewsletter();
      setSelectedFile(null);
      setRawFile(null);
      onClose();
    } catch (err) {
      console.warn('Remove newsletter error:', err);
    } finally {
      setIsProcessing(false);
      setConfirmingRemove(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="upload-newsletter-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            key="upload-newsletter-modal"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                  <BookOpen className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight serif-title">
                    Upload Community Newsletter
                  </h2>
                  <p className="text-[11px] text-emerald-200 font-medium">
                    Standard PDF Storage & Intelligent Gemini AI Extraction
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="p-5 overflow-y-auto space-y-4 text-stone-900 dark:text-stone-100"
            >
              {error && (
                <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Upload Drop Zone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Select Newsletter PDF (.pdf)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-stone-300 dark:border-stone-700 hover:border-emerald-500 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                  } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={isProcessing}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFile(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Click to browse or drag and drop your .pdf file
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      Direct upload to Firebase Storage with embedded PDF viewer & AI event extraction
                    </p>
                  </div>
                </div>

                {/* Selected File Badge */}
                {selectedFile && (
                  <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          {selectedFile.size} • PDF Document ready for upload
                        </p>
                      </div>
                    </div>
                    {!isProcessing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setRawFile(null);
                        }}
                        className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Remove selected file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Publication Title & Month Edition Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Publication Title *
                  </label>
                  <input
                    type="text"
                    value={editionTitle}
                    onChange={(e) => setEditionTitle(e.target.value)}
                    disabled={isProcessing}
                    placeholder="e.g. The Breeze: October 2026"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600 disabled:opacity-60"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Month / Edition Label
                  </label>
                  <input
                    type="text"
                    value={monthEdition}
                    onChange={(e) => setMonthEdition(e.target.value)}
                    disabled={isProcessing}
                    placeholder="e.g. October 2026"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Optional Text Notes / Content */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Additional Newsletter Text or Notice Content (Optional)
                  </label>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">
                    Supplemental text or notes
                  </span>
                </div>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isProcessing}
                  rows={2}
                  placeholder="Paste any supplemental newsletter text, manager notes, or bulletin highlights here..."
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600 disabled:opacity-60 resize-y"
                />
              </div>

              {/* Gemini AI Automatic Extraction Feature */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-stone-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-stone-900/40 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                <div className="flex items-start gap-3 select-none">
                  <div className="mt-0.5 w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                        Automatic Monthly RSVP & Highlight Extraction
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                        Guaranteed on Upload
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-300 font-medium mt-1 leading-relaxed">
                      Every time you upload or update the newsletter, the AI thoroughly scans all pages, sidebars, and calendars to extract every RSVP event and community highlight for that month.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Progress Status Banner */}
              {isProcessing && (
                <div className="p-4 rounded-2xl bg-emerald-950/10 dark:bg-emerald-950/60 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-emerald-900 dark:text-emerald-200 truncate">
                        {statusMessage || 'Processing newsletter...'}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        Uploading PDF and running Gemini extraction
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(5, Math.min(100, progressPercent))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-stone-200 dark:border-stone-800">
                {!currentConfig?.isRemoved ? (
                  confirmingRemove ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={handleRemove}
                        disabled={isProcessing}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
                        title="Confirm removal of current newsletter PDF"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Confirm Remove?</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRemove(false)}
                        disabled={isProcessing}
                        className="min-h-[44px] px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingRemove(true)}
                      disabled={isProcessing}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Remove Current Newsletter PDF"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove Current PDF</span>
                    </button>
                  )
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading & Processing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Upload & Publish PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

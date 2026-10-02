/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useRef, useEffect } from 'react';
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
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ArrowRight,
  Eye,
  Check,
} from 'lucide-react';
import type {
  NewsletterConfig,
  ExtractedRsvpEventInput,
  ExtractedPinnedHighlightInput,
  UserProfile,
} from '../types';
import { savePdfToStorage, saveNewsletterConfigToStorage } from '../utils/pdfStorage';
import { uploadNewsletterPdfToStorage } from '../services/storage';
import {
  saveNewsletterConfigToFirestore,
  deleteOldAiEventsFromFirestore,
  deleteOldAiHighlightsFromFirestore,
} from '../services/firestoreSync';
import {
  extractNewsletterClientSide,
  getGeminiApiKey,
  formatGeminiError,
  type ExtractedPreviewEvent,
  type ExtractedPreviewHighlight,
} from '../services/geminiNewsletter';

export type { ExtractedPreviewEvent, ExtractedPreviewHighlight };

interface ReviewPayload {
  newsletterId: string;
  monthEdition: string;
  editionTitle: string;
  events: ExtractedPreviewEvent[];
  highlights: ExtractedPreviewHighlight[];
  rsvp_events: ExtractedRsvpEventInput[];
  pinned_highlights: ExtractedPinnedHighlightInput[];
  finalPdfUrl: string;
  cleanBase64: string;
}

interface UploadNewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: NewsletterConfig;
  onSaveConfig: (newConfig: NewsletterConfig) => void;
  onRemoveNewsletter: () => void;
  onExtractContent?: (
    data: {
      rsvp_events: ExtractedRsvpEventInput[];
      pinned_highlights: ExtractedPinnedHighlightInput[];
    },
    editionContext?: {
      id: string;
      monthEdition: string;
      editionTitle: string;
    }
  ) => void;
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
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [editionTitle, setEditionTitle] = useState(
    currentConfig.editionTitle || 'The Breeze: Community Edition'
  );
  const [monthEdition, setMonthEdition] = useState(
    currentConfig.monthEdition || ''
  );
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    dataUrl: string;
    base64Data: string;
    type: string;
  } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewPayload | null>(null);
  const [reviewTab, setReviewTab] = useState<'events' | 'highlights'>('events');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<number>(0);
  const aiIntervalRef = useRef<any>(null);

  const updateProgress = (targetPct: number, message?: string) => {
    const nextPct = Math.max(progressRef.current, Math.min(100, Math.round(targetPct)));
    progressRef.current = nextPct;
    setProgressPercent(nextPct);
    if (message) {
      setStatusMessage(message);
    }
  };

  useEffect(() => {
    return () => {
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
      }
    };
  }, []);

  // Reset modal state when reopening
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setReviewData(null);
      setError(null);
      setIsProcessing(false);
      setProgressPercent(0);
      progressRef.current = 0;
    }
  }, [isOpen]);

  const handleFile = (file: File) => {
    setError(null);
    if (!file) return;

    // Verify PDF type or image
    const validMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    const isPdfName = file.name.toLowerCase().endsWith('.pdf');
    if (!validMimes.includes(file.type) && !isPdfName) {
      setError('Please select a valid PDF document (.pdf) or image.');
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
      const cleanBase64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
      const fileMime = file.type || 'application/pdf';

      savePdfToStorage('current_newsletter_pdf', dataUrl).catch(() => {});
      setSelectedFile({
        name: file.name,
        size: sizeStr,
        dataUrl,
        base64Data: cleanBase64,
        type: fileMime,
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
      } else {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setEditionTitle(cleanName || 'Community Newsletter');
        if (!monthEdition || monthEdition.toLowerCase().includes('september')) {
          const nowMonth = new Date().toLocaleString('en-US', { month: 'long' });
          const nowYear = new Date().getFullYear();
          setMonthEdition(`${nowMonth} ${nowYear}`);
        }
      }
    };
    reader.onerror = () => {
      setError('Failed to read document file. Please try again.');
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

  // Phase 1: Upload file & trigger multimodal Gemini extraction (leads to Review step)
  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !rawFile) {
      setError('Please select a newsletter PDF file to upload.');
      return;
    }
    if (!editionTitle.trim()) {
      setError('Please provide an edition title.');
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      setError('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY.');
      return;
    }

    const newsletterId = `newsletter-${Date.now()}`;
    setIsProcessing(true);
    setError(null);
    progressRef.current = 5;
    setProgressPercent(5);
    setStatusMessage('Reading and preparing document...');

    try {
      // 1. Direct PDF Upload to storage
      let finalPdfUrl: string = selectedFile?.dataUrl || '';

      if (rawFile) {
        updateProgress(15, 'Securing document in storage...');
        try {
          finalPdfUrl = await uploadNewsletterPdfToStorage({
            newsletterId,
            pdfFile: rawFile,
            currentUser,
            onProgress: ({ percent, message }) => {
              const mapped = 15 + Math.round((Math.max(0, Math.min(100, percent)) / 100) * 25);
              updateProgress(mapped, message);
            },
          });
        } catch (uploadErr) {
          console.warn('Direct upload notice, falling back to data URL:', uploadErr);
          if (selectedFile?.dataUrl) {
            finalPdfUrl = selectedFile.dataUrl;
          }
        }
        updateProgress(42, 'Document prepared.');
      }

      // 2. Multimodal Gemini Direct File Processing Client-Side
      updateProgress(45, 'Sending document directly to client-side Gemini AI parser...');

      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      aiIntervalRef.current = setInterval(() => {
        if (progressRef.current < 85) {
          updateProgress(progressRef.current + 1);
        }
      }, 350);

      const base64Clean = selectedFile?.base64Data || '';
      const mime = selectedFile?.type || rawFile?.type || 'application/pdf';

      console.log(
        `[Newsletter Pipeline] Dispatching client-side Gemini extraction - base64 length: ${base64Clean.length}, MIME: ${mime}`
      );

      const extractionResult = await extractNewsletterClientSide({
        base64Data: base64Clean,
        mimeType: mime,
        fileName: selectedFile?.name || rawFile?.name || 'document.pdf',
        editionTitle: editionTitle.trim(),
        monthEditionHint: monthEdition.trim(),
        textContent: textContent.trim(),
        onProgress: (status) => {
          updateProgress(Math.min(progressRef.current + 4, 88), status);
        },
      });

      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
        aiIntervalRef.current = null;
      }

      console.log('[Newsletter Pipeline] Received Gemini extracted JSON:', extractionResult);

      const parsedEvents: ExtractedPreviewEvent[] = Array.isArray(extractionResult.events) ? extractionResult.events : [];
      const parsedHighlights: ExtractedPreviewHighlight[] = Array.isArray(extractionResult.highlights) ? extractionResult.highlights : [];

      if (parsedEvents.length === 0 && parsedHighlights.length === 0 && (!extractionResult.rsvp_events || extractionResult.rsvp_events.length === 0)) {
        throw new Error('Failed to extract content from uploaded newsletter. Please check file format.');
      }

      updateProgress(100, 'Analysis complete! Review extracted items below.');

      // Populate review state
      const detectedMonth = extractionResult.monthEdition || monthEdition.trim() || 'Latest Edition';
      const effectiveTitle = editionTitle.trim() || `The Breeze: ${detectedMonth}`;

      setReviewData({
        newsletterId,
        monthEdition: detectedMonth,
        editionTitle: effectiveTitle,
        events: parsedEvents,
        highlights: parsedHighlights,
        rsvp_events: extractionResult.rsvp_events || [],
        pinned_highlights: extractionResult.pinned_highlights || [],
        finalPdfUrl,
        cleanBase64: base64Clean,
      });

      // Transition smoothly to review step
      setTimeout(() => {
        setIsProcessing(false);
        setStep('review');
      }, 400);
    } catch (err: any) {
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
        aiIntervalRef.current = null;
      }
      console.error('[Newsletter Pipeline] Extraction error:', err);
      const userMessage = formatGeminiError(err);
      setError(userMessage);
      setIsProcessing(false);
    }
  };

  // Phase 2: Confirm & Publish clean-slate to Firestore and portal state
  const handleConfirmPublish = async () => {
    if (!reviewData) return;

    setIsProcessing(true);
    setError(null);
    updateProgress(10, 'Initiating clean-slate portal sync...');

    try {
      // 1. Clear stale localStorage keys holding old events and highlights
      try {
        localStorage.removeItem('portal_rsvp_events_list');
        localStorage.removeItem('portal_pinned_highlights_list');
        console.log('[Newsletter Pipeline] Cleared stale localStorage event & highlight keys');
      } catch (lsErr) {
        console.warn('Notice clearing localStorage:', lsErr);
      }

      // 2. Delete prior AI-generated events and highlights from Firestore
      updateProgress(35, 'Cleaning prior edition events from Firestore...');
      await deleteOldAiEventsFromFirestore(reviewData.newsletterId);
      await deleteOldAiHighlightsFromFirestore(reviewData.newsletterId);

      // 3. Save new newsletter configuration
      updateProgress(65, 'Saving publication metadata...');
      const newConfig: NewsletterConfig = {
        id: reviewData.newsletterId,
        editionTitle: reviewData.editionTitle,
        monthEdition: reviewData.monthEdition,
        description: currentConfig.description || 'Official monthly publication for community residents.',
        pdfUrl: reviewData.finalPdfUrl,
        fileUrl: reviewData.finalPdfUrl,
        fileName: selectedFile?.name || rawFile?.name || 'document.pdf',
        fileType: 'application/pdf',
        fileSize: selectedFile?.size ? undefined : rawFile?.size,
        uploadedAt: Date.now(),
        uploadedBy: currentUser?.name || 'Admin',
        isCustomUpload: true,
        isRemoved: false,
      };

      await saveNewsletterConfigToFirestore(newConfig).catch((err) => {
        console.warn('Firestore newsletter config save notice:', err);
      });

      await saveNewsletterConfigToStorage(newConfig).catch((err) => {
        console.warn('IndexedDB newsletter config save notice:', err);
      });

      // 4. Dispatch clean-slate events and highlights with fresh editionContext
      updateProgress(85, 'Updating community calendar & announcements...');
      if (onExtractContent) {
        onExtractContent(
          {
            rsvp_events: reviewData.rsvp_events,
            pinned_highlights: reviewData.pinned_highlights,
          },
          {
            id: reviewData.newsletterId,
            monthEdition: reviewData.monthEdition,
            editionTitle: reviewData.editionTitle,
          }
        );
      }

      onSaveConfig(newConfig);

      updateProgress(100, 'Published successfully to community portal!');

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 500);
    } catch (publishErr: any) {
      console.error('[Newsletter Pipeline] Error publishing extracted newsletter:', publishErr);
      setError('Failed to publish extracted content. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleRemovePreviewEvent = (index: number) => {
    setReviewData((prev) => {
      if (!prev) return null;
      const updatedEvents = prev.events.filter((_, i) => i !== index);
      const updatedRsvp = prev.rsvp_events.filter((_, i) => i !== index);
      return {
        ...prev,
        events: updatedEvents,
        rsvp_events: updatedRsvp,
      };
    });
  };

  const handleRemovePreviewHighlight = (index: number) => {
    setReviewData((prev) => {
      if (!prev) return null;
      const updatedHighlights = prev.highlights.filter((_, i) => i !== index);
      const updatedPinned = prev.pinned_highlights.filter((_, i) => i !== index);
      return {
        ...prev,
        highlights: updatedHighlights,
        pinned_highlights: updatedPinned,
      };
    });
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
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/65 backdrop-blur-xl z-[110] flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            key="upload-newsletter-modal"
            initial={{ opacity: 0, scale: 0.84, y: -24, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              scale: 0.88,
              y: -16,
              filter: 'blur(8px)',
              transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 280,
              mass: 0.75,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] gpu-layer antialiased [text-rendering:optimizeLegibility] relative"
          >
            {/* Dynamic Specular Light Flare Sweep on open */}
            <motion.div
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: '180%', opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-emerald-500/10 dark:via-white/10 to-transparent w-full h-full"
            />
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                  {step === 'upload' ? (
                    <BookOpen className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <Eye className="w-5 h-5 text-emerald-300" />
                  )}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight serif-title flex items-center gap-2">
                    <span>{step === 'upload' ? 'Upload Community Newsletter' : 'Review Extracted Content'}</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-700/80 text-emerald-200">
                      {step === 'upload' ? 'Step 1 of 2' : 'Step 2 of 2'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-emerald-200 font-medium">
                    {step === 'upload'
                      ? 'Multimodal Gemini AI Extraction directly from your PDF document'
                      : 'Verify newly parsed events and highlights before publishing clean-slate'}
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

            {/* Error Banner */}
            {error && (
              <div className="mx-5 mt-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Explicit API Key Notice */}
            {!getGeminiApiKey() && !error && (
              <div className="mx-5 mt-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold">
                  Gemini API key is not configured. Please add VITE_GEMINI_API_KEY.
                </span>
              </div>
            )}

            {/* Step 1: Upload Form */}
            {step === 'upload' && (
              <form
                onSubmit={handleStartExtraction}
                className="p-5 overflow-y-auto space-y-4 text-stone-900 dark:text-stone-100 flex-1"
              >
                {/* Upload Drop Zone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                    Select Newsletter Document (.pdf) *
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
                      accept="application/pdf,.pdf,image/png,image/jpeg"
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
                        Click to browse or drag and drop your newsletter file
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        Direct multimodal processing with Gemini AI: parses raw PDF text, calendar grids & bulletins
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
                            {selectedFile.size} • Ready for direct multimodal AI extraction
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
                      Additional Notes / Flyer Details (Optional)
                    </label>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">
                      Supplemental details
                    </span>
                  </div>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    disabled={isProcessing}
                    rows={2}
                    placeholder="Paste any extra bulletin notices, event times, or coordinator contacts..."
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600 disabled:opacity-60 resize-y"
                  />
                </div>

                {/* AI Processing Banner */}
                {isProcessing && (
                  <div className="p-4 rounded-2xl bg-emerald-950/10 dark:bg-emerald-950/60 border border-emerald-500/40 space-y-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 truncate">
                          {statusMessage || 'Processing newsletter document...'}
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                          {progressPercent < 45
                            ? 'Phase 1: Securing document buffer'
                            : progressPercent < 85
                            ? 'Phase 2: Gemini multimodal AI scanning all pages & columns'
                            : 'Phase 3: Parsing structured RSVP events & highlights'}
                        </p>
                      </div>
                      <span className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                        {progressPercent}%
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden p-0.5 border border-emerald-500/20">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-300 ease-out rounded-full shadow-xs"
                        style={{ width: `${Math.max(5, Math.min(100, progressPercent))}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload Form Action Buttons */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-stone-200 dark:border-stone-800">
                  {!currentConfig?.isRemoved ? (
                    confirmingRemove ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                        <button
                          type="button"
                          onClick={handleRemove}
                          disabled={isProcessing}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Confirm Remove?</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingRemove(false)}
                          disabled={isProcessing}
                          className="min-h-[44px] px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 transition cursor-pointer"
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
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Remove Current</span>
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
                      disabled={isProcessing || !selectedFile}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing Document...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Scan & Extract with AI</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Step 2: Extraction Review & Clean-Slate Publish */}
            {step === 'review' && reviewData && (
              <div className="p-5 overflow-y-auto space-y-4 text-stone-900 dark:text-stone-100 flex-1">
                {/* Review Header Banner */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-200/80 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full">
                        {reviewData.monthEdition}
                      </span>
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        {reviewData.editionTitle}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-1">
                      Direct multimodal Gemini extraction completed. Verify the extracted events and announcements below before publishing.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200">
                      {reviewData.events.length} Events
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200">
                      {reviewData.highlights.length} Highlights
                    </span>
                  </div>
                </div>

                {/* Review Tabs */}
                <div className="flex items-center border-b border-stone-200 dark:border-stone-800 gap-4">
                  <button
                    type="button"
                    onClick={() => setReviewTab('events')}
                    className={`pb-2 text-xs font-bold cursor-pointer transition border-b-2 flex items-center gap-1.5 ${
                      reviewTab === 'events'
                        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>RSVP Upcoming Events ({reviewData.events.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTab('highlights')}
                    className={`pb-2 text-xs font-bold cursor-pointer transition border-b-2 flex items-center gap-1.5 ${
                      reviewTab === 'highlights'
                        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Pinned Highlights ({reviewData.highlights.length})</span>
                  </button>
                </div>

                {/* Tab Content: Events */}
                {reviewTab === 'events' && (
                  <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
                    {reviewData.events.length === 0 ? (
                      <div className="text-center py-8 text-stone-500 text-xs">
                        No RSVP events detected in this document.
                      </div>
                    ) : (
                      reviewData.events.map((ev, idx) => (
                        <div
                          key={`ev-${idx}`}
                          className="p-3.5 bg-stone-50 dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-start justify-between gap-3 shadow-xs hover:border-emerald-500/40 transition"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                                {ev.title}
                              </h4>
                              {ev.requiresRsvp && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  RSVP Required
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 flex-wrap">
                              {ev.date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>{ev.date}</span>
                                </span>
                              )}
                              {ev.time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>{ev.time}</span>
                                </span>
                              )}
                              {ev.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>{ev.location}</span>
                                </span>
                              )}
                            </div>
                            {ev.description && (
                              <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                                {ev.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePreviewEvent(idx)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                            title="Exclude this event from publish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Content: Highlights */}
                {reviewTab === 'highlights' && (
                  <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
                    {reviewData.highlights.length === 0 ? (
                      <div className="text-center py-8 text-stone-500 text-xs">
                        No pinned highlights detected in this document.
                      </div>
                    ) : (
                      reviewData.highlights.map((hl, idx) => (
                        <div
                          key={`hl-${idx}`}
                          className="p-3.5 bg-stone-50 dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-start justify-between gap-3 shadow-xs hover:border-emerald-500/40 transition"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                                {hl.title}
                              </h4>
                              {hl.category && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                                  {hl.category}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                              {hl.summary}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePreviewHighlight(idx)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                            title="Exclude this highlight from publish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Progress bar during confirm publish */}
                {isProcessing && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                      {statusMessage || 'Publishing clean-slate edition...'}
                    </span>
                  </div>
                )}

                {/* Review Step Actions */}
                <div className="pt-3 flex items-center justify-between gap-3 border-t border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    disabled={isProcessing}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back / Re-scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmPublish}
                    disabled={isProcessing}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Publishing Clean-Slate...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Confirm & Publish to Portal</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

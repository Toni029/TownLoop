/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'motion/react';
import {
  X,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  Trash2,
  Loader2,
  CloudUpload,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { WorkOrdersState } from '../../hooks/useWorkOrders';
import { WORK_ORDER_CATEGORIES } from '../../data/workOrderCategories';
import { UserProfile } from '../../types';
import { uploadMediaToStorage } from '../../services/storage';
import { auth } from '../../firebase';
import { saveWorkOrderToFirestore } from '../../services/firestoreSync';

type WorkOrderModalProps = Pick<
  WorkOrdersState,
  | 'setIsWorkOrderModalOpen'
  | 'handleWorkOrderSubmit'
  | 'newWoTitle'
  | 'setNewWoTitle'
  | 'newWoDescription'
  | 'setNewWoDescription'
  | 'newWoCategory'
  | 'setNewWoCategory'
  | 'newWoPhotos'
  | 'setNewWoPhotos'
> & {
  currentUser?: UserProfile | null;
};

export function WorkOrderModal({
  setIsWorkOrderModalOpen,
  handleWorkOrderSubmit,
  newWoTitle,
  setNewWoTitle,
  newWoDescription,
  setNewWoDescription,
  newWoCategory,
  setNewWoCategory,
  newWoPhotos,
  setNewWoPhotos,
  currentUser,
}: WorkOrderModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragControls = useDragControls();
  const pendingUploadsRef = useRef(0);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClosing(false);
    setIsFullScreen(false);
    setErrorMessage(null);
    setIsUploading(false);
    setIsSubmitting(false);
    setUploadProgress(0);
    setUploadingFileName('');
  }, []);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsWorkOrderModalOpen(false);
    }, 220);
  };

  // Visual Upload State & Progress percentage tracker
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');

  // Validate that ONLY pictures (no videos) are added & upload directly to Firebase Storage /work_orders
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Explicitly disallow videos
      if (
        file.type.startsWith('video/') ||
        file.name.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i)
      ) {
        setErrorMessage('❌ Videos are not allowed. Please upload pictures only.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        setErrorMessage('❌ Unsupported file type. Please upload images only.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Session Safeguard
      const hasAuth = Boolean(auth?.currentUser || currentUser?.id);
      if (!hasAuth) {
        setErrorMessage('Session Safeguard: You must be logged in to upload photos to Cloud Storage.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      pendingUploadsRef.current += 1;
      setIsUploading(true);
      setUploadProgress(0);
      setUploadingFileName(file.name);

      try {
        const result = await uploadMediaToStorage({
          file,
          folder: 'work_orders',
          currentUser,
          onProgress: (percent) => {
            setUploadProgress(percent);
          },
        });

        // Attach live photo URL to work order photos list (do not write to Firestore until user submits)
        setNewWoPhotos((prev) => [...prev, result.url]);
      } catch (err: any) {
        console.warn('Work order photo upload notice:', err);
        setErrorMessage(err?.message || 'Failed to upload photo to Firebase Cloud Storage.');
      } finally {
        pendingUploadsRef.current -= 1;
        setIsUploading(pendingUploadsRef.current > 0);
        setUploadProgress(0);
        setUploadingFileName('');
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || pendingUploadsRef.current > 0) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await handleWorkOrderSubmit(e);
    } catch (err) {
      console.error('Failed to submit work order:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not submit your work order. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setNewWoPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <motion.div
      key="workorder-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 bg-stone-950/65 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <motion.div
        key="workorder-modal-sheet"
        drag={isClosing ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: isFullScreen ? 0 : 0.2, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;
          if (offset.y > 60 || velocity.y > 250) {
            if (isFullScreen) {
              setIsFullScreen(false);
            } else {
              handleClose();
            }
          } else if (offset.y < -40 || velocity.y < -250) {
            setIsFullScreen(true);
          }
        }}
        initial={{ y: '100%' }}
        animate={isClosing ? { y: '100%' } : { y: 0 }}
        exit={{ y: '100%' }}
        transition={
          isClosing
            ? { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
            : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
        }
        onAnimationComplete={() => {
          if (isClosing) {
            setIsWorkOrderModalOpen(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 shadow-2xl gpu-layer flex flex-col antialiased [text-rendering:optimizeLegibility] overflow-hidden relative ${
          isFullScreen
            ? 'fixed inset-0 w-full h-full max-w-none max-h-none rounded-none z-50 p-4 sm:p-6 border-0'
            : 'w-full max-w-lg rounded-t-[32px] sm:rounded-[28px] p-5 sm:p-6 border-t sm:border border-stone-200 dark:border-slate-800 max-h-[92vh] sm:max-h-[90vh]'
        }`}
      >
        {/* Dynamic Specular Light Flare Sweep on open */}
        <motion.div
          initial={{ x: '-100%', opacity: 0.6 }}
          animate={{ x: '180%', opacity: 0 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-amber-500/10 dark:via-white/10 to-transparent w-full h-full"
        />
        {/* Interactive iOS pull/grab bar: drag down to close, drag up for full screen */}
        <div
          onPointerDown={(e) => {
            dragControls.start(e);
          }}
          onClick={() => setIsFullScreen((prev) => !prev)}
          className="w-full py-2.5 -mt-2 mb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0 group"
          style={{ touchAction: 'none' }}
          title={
            isFullScreen
              ? 'Drag down to collapse • Click to exit full screen'
              : 'Drag up for full screen • Drag down to close • Click to toggle'
          }
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-200 ${
              isFullScreen
                ? 'w-16 bg-emerald-600'
                : 'w-12 bg-stone-300 dark:bg-slate-700 hover:bg-stone-400 dark:hover:bg-slate-600 group-hover:w-16'
            }`}
          />
        </div>

        {/* Header */}
        <div
          onPointerDown={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('button') && !target.closest('input')) {
              dragControls.start(e);
            }
          }}
          style={{ touchAction: 'none' }}
          className="flex justify-between items-center border-b border-stone-100 dark:border-slate-800 pb-3 shrink-0 cursor-grab active:cursor-grabbing select-none"
        >
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100 flex items-center gap-2">
              <span>🛠️</span>
              <span>New Work Order Request</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
              Submit an issue to the maintenance crew
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-500 hover:text-stone-800 dark:hover:text-slate-200 flex items-center justify-center font-bold transition cursor-pointer"
              title={isFullScreen ? 'Exit full screen' : 'Expand to full screen'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-500 hover:text-stone-800 dark:hover:text-slate-200 flex items-center justify-center font-bold transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

          {/* Form with scrollable body */}
          <form
            onSubmit={handleFormSubmit}
            className="space-y-4 pt-3 overflow-y-auto hide-scrollbar native-scroll overscroll-contain touch-pan-y text-xs sm:text-sm flex-1 px-0.5"
          >
            {/* 1. Category Selection (at least 7 categories with emojis) */}
            <div>
              <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1 text-xs uppercase tracking-wider">
                Category
              </label>
              <div className="relative">
                <select
                  value={newWoCategory}
                  onChange={(e) => setNewWoCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/90 text-stone-800 dark:text-slate-100 text-sm font-medium focus:outline-emerald-600 appearance-none pr-8 cursor-pointer"
                >
                  {WORK_ORDER_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.emoji} {cat.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">
                  ▼
                </div>
              </div>
              <p className="text-[11px] text-stone-400 dark:text-slate-500 mt-1">
                {WORK_ORDER_CATEGORIES.find((c) => c.name === newWoCategory)?.description}
              </p>
            </div>

            {/* 2. What needs fixing? (Title) */}
            <div>
              <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1 text-xs uppercase tracking-wider">
                What Needs Fixing? <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={newWoTitle}
                onChange={(e) => setNewWoTitle(e.target.value)}
                placeholder="e.g. Master bathroom sink dripping constantly"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 text-sm focus:outline-emerald-600 placeholder:text-stone-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* 3. Detailed Description */}
            <div>
              <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1 text-xs uppercase tracking-wider">
                Description of Issue
              </label>
              <textarea
                rows={3}
                value={newWoDescription}
                onChange={(e) => setNewWoDescription(e.target.value)}
                placeholder="Provide details about the issue (exact room, how long it has been happening, accessibility instructions)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 text-sm focus:outline-emerald-600 placeholder:text-stone-400 dark:placeholder:text-slate-500 resize-none"
              />
            </div>

            {/* 4. PICTURES UPLOAD BOX AT THE BOTTOM */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-stone-700 dark:text-slate-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Attach Pictures</span>
                </label>
                <span className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 bg-stone-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-stone-200 dark:border-slate-700">
                  Photos Only • No Videos
                </span>
              </div>

              {/* Error Banner if user tries video */}
              {errorMessage && (
                <div className="p-2.5 mb-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Upload Box Dropzone */}
              <div
                onClick={() => {
                  if (!isUploading) fileInputRef.current?.click();
                }}
                className={`group relative border-2 border-dashed rounded-2xl p-4 transition text-center ${
                  isUploading
                    ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-wait'
                    : 'border-stone-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-stone-50/60 dark:bg-slate-800/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition group-hover:scale-110">
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  {isUploading && (
                    <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                      Uploading photo...
                    </p>
                  )}
                </div>
              </div>

              {/* Visual Upload State & Progress Percentage Tracker adjacent to upload button */}
              {isUploading && (
                <div className="mt-2.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 space-y-1.5 shadow-2xs animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5 truncate max-w-[240px]">
                      <CloudUpload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
                      <span className="truncate">{uploadingFileName}</span>
                    </span>
                    <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/80 px-2 py-0.5 rounded-full">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-emerald-200 dark:bg-emerald-800/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-150 rounded-full"
                      style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Uploaded Thumbnails Grid */}
              {newWoPhotos.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500 mb-1.5">
                    Attached Photos ({newWoPhotos.length})
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {newWoPhotos.map((photoUrl, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 shadow-xs"
                      >
                        <img
                          src={photoUrl}
                          alt={`Attached photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-md opacity-90 group-hover:opacity-100 transition cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center gap-2.5">
              {isUploading && (
                <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold shrink-0 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isUploading || isSubmitting}
                className={`flex-1 font-bold py-3 rounded-2xl text-sm transition shadow-sm flex items-center justify-center gap-2 ${
                  isUploading || isSubmitting
                    ? 'bg-stone-300 dark:bg-slate-800 text-stone-500 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white cursor-pointer active:scale-98'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading Photos ({uploadProgress}%)...</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Work Order</span>
                    {newWoPhotos.length > 0 && (
                      <span className="bg-emerald-600/90 text-white text-[11px] px-2 py-0.5 rounded-full">
                        {newWoPhotos.length} {newWoPhotos.length === 1 ? 'photo' : 'photos'}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
  );
}

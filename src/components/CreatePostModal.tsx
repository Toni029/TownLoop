/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  X,
  Image,
  Video,
  Film,
  Upload,
  Trash2,
  Tag,
  MessageSquare,
  DollarSign,
  AlertCircle,
  Loader2,
  Check,
  CloudUpload,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { MediaAttachment, UserProfile } from '../types';
import { uploadMediaToStorage } from '../services/storage';
import { auth } from '../firebase';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'chat' | 'market';
  currentUser?: UserProfile | null;
  onSubmit: (data: {
    type: 'chat' | 'market';
    title: string;
    description: string;
    price?: string;
    media: MediaAttachment[];
    mediaUrl?: string;
  }) => void | Promise<void>;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'chat',
  currentUser,
  onSubmit,
}) => {
  const [type, setType] = useState<'chat' | 'market'>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mediaList, setMediaList] = useState<MediaAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Visual Upload State & Progress percentage tracker
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');

  // Submission lock to prevent duplicate records
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragControls = useDragControls();

  const submittingRef = useRef(false);
  const pendingUploadsRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setType(defaultType);
      setUploadError(null);
      setIsUploading(pendingUploadsRef.current > 0);
      setIsSubmitting(submittingRef.current);
      setUploadProgress(0);
      setUploadingFileName('');
      setIsFullScreen(false);
    }
  }, [isOpen, defaultType]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const formatPriceValue = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed || trimmed.toUpperCase() === 'FREE') return 'FREE';
    if (trimmed.startsWith('$')) return trimmed;
    // If it starts with digits, auto-prefix with $
    if (/^\d/.test(trimmed)) {
      return `$${trimmed}`;
    }
    return trimmed;
  };

  const handleFileProcess = async (file: File) => {
    setUploadError(null);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setUploadError('Please select an image (JPG, PNG, WebP) or video (MP4, MOV).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds 25MB limit.');
      return;
    }

    // Session Safeguard - explicitly verify login state before attempting upload
    const hasAuthSession = Boolean(auth?.currentUser || currentUser?.id);
    if (!hasAuthSession) {
      setUploadError(
        'Session Safeguard: You must be logged in to an active account before uploading media files to Cloud Storage.'
      );
      return;
    }

    pendingUploadsRef.current += 1;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);

    try {
      const folder = type === 'market' ? 'marketplace' : 'feed';
      const result = await uploadMediaToStorage({
        file,
        folder,
        currentUser,
        onProgress: (percent) => {
          setUploadProgress(percent);
        },
      });

      // Attach uploaded media to list (do NOT write database document prematurely until form submission)
      setMediaList((prev) => [
        ...prev,
        {
          type: result.type,
          url: result.url,
          name: result.originalName,
        },
      ]);
    } catch (err: any) {
      console.warn('Upload notice:', err);
      setUploadError(
        err?.message ||
          'Failed to upload file to Firebase Cloud Storage. Please verify connection and authentication.'
      );
    } finally {
      pendingUploadsRef.current -= 1;
      setIsUploading(pendingUploadsRef.current > 0);
      if (pendingUploadsRef.current === 0) {
        setUploadProgress(0);
        setUploadingFileName('');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file) handleFileProcess(file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file) handleFileProcess(file);
      }
    }
  };

  const removeMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || pendingUploadsRef.current > 0) return;
    if (!title.trim() || !description.trim()) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    const formattedPrice = type === 'market' ? formatPriceValue(price) : undefined;
    const firstMediaUrl = mediaList.length > 0 ? mediaList[0].url : '';

    try {
      await onSubmit({
        type,
        title: title.trim(),
        description: description.trim(),
        price: formattedPrice,
        media: mediaList,
        mediaUrl: firstMediaUrl || undefined,
      });

      // Reset fields upon successful submission
      setTitle('');
      setDescription('');
      setPrice('');
      setMediaList([]);
      onClose();
    } catch (err) {
      console.error('Error submitting post:', err);
      setUploadError(err instanceof Error ? err.message : 'Could not publish your post. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-post-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleClose}
          className="fixed inset-0 bg-stone-950/65 backdrop-blur-xl z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            key="create-post-modal"
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
                ? { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
                : { duration: 0.44, ease: [0.22, 1, 0.36, 1] }
            }
            onAnimationComplete={() => {
              if (isClosing) {
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-slate-900 shadow-2xl gpu-layer flex flex-col antialiased [text-rendering:optimizeLegibility] [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale] overflow-hidden relative ${
              isFullScreen
                ? 'fixed inset-0 w-full h-full max-w-none max-h-none rounded-none z-[106] p-4 sm:p-6 border-0'
                : 'w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 border-t sm:border border-stone-200 dark:border-slate-800 max-h-[92vh] sm:max-h-[90vh]'
            }`}
          >
            {/* Dynamic Specular Light Flare Sweep on open */}
            <motion.div
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: '180%', opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-emerald-500/10 dark:via-white/10 to-transparent w-full h-full"
            />
            {/* Interactive iOS pull/grab indicator bar: drag down to close, drag up for full screen */}
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
              className="flex justify-between items-center border-b border-stone-200 dark:border-slate-800 pb-3 shrink-0 cursor-grab active:cursor-grabbing select-none"
            >
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-white serif-title tracking-tight">
                  {type === 'chat' ? 'Create Community Post' : 'Post Item for Sale / Free'}
                </h3>
                <p className="text-xs font-medium text-stone-600 dark:text-slate-300 mt-0.5">
                  {type === 'chat'
                    ? 'Share announcements, stories, pictures & videos with TownLoop neighbors.'
                    : 'Share items, furniture, tools & giveaways with TownLoop neighbors.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullScreen((prev) => !prev)}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
                  title={isFullScreen ? 'Exit full screen' : 'Expand to full screen'}
                >
                  {isFullScreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  id="close-create-post-modal"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-3.5 text-xs sm:text-sm overflow-y-auto hide-scrollbar native-scroll overscroll-contain touch-pan-y flex-1 pt-1.5 px-0.5"
            >
          {/* Post Type Selector - Discussion Feed on Left, Buy/Free/Sell on Right */}
          <div>
            <label className="font-bold text-xs sm:text-sm text-stone-900 dark:text-slate-100 block mb-1.5">
              Post Category
            </label>
            <div className="grid grid-cols-2 gap-2 bg-stone-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-stone-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setType('chat')}
                className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  type === 'chat'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                <span>Discussion Feed</span>
              </button>
              <button
                type="button"
                onClick={() => setType('market')}
                className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  type === 'market'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Tag className="w-4 h-4 stroke-[2.5]" />
                <span>Buy / Free / Sell</span>
              </button>
            </div>
          </div>

          {/* Title / Subject */}
          <div>
            <label className="font-bold text-xs sm:text-sm text-stone-900 dark:text-slate-100 block mb-1.5">
              {type === 'chat' ? 'Subject / Title' : 'Item Name'}
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'chat'
                  ? 'e.g. Garden Club meeting this Friday'
                  : 'e.g. Vintage Rocking Chair, Wooden Chess Set...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white dark:bg-slate-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-slate-500 shadow-2xs"
            />
          </div>

          {/* Price (Market only) */}
          {type === 'market' && (
            <div>
              <label className="font-bold text-xs sm:text-sm text-stone-900 dark:text-slate-100 block mb-1.5">
                Price (Type FREE or $ amount)
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={() => {
                  if (price.trim()) {
                    setPrice(formatPriceValue(price));
                  }
                }}
                placeholder="e.g. FREE, $15, 25, $25 OBO"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white dark:bg-slate-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-slate-500 shadow-2xs"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="font-bold text-xs sm:text-sm text-stone-900 dark:text-slate-100 block mb-1.5">
              {type === 'chat' ? 'Post Content & Discussion Details' : 'Details & Pickup Information'}
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'chat'
                  ? 'Share details, updates, or stories with your neighbors...'
                  : 'Describe condition, pickup instructions (e.g., Apt 208 porch), or item specifications...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white dark:bg-slate-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-slate-500 shadow-2xs leading-relaxed"
            />
          </div>

          {/* Media Upload Area (Pictures and Videos) */}
          <div>
            <label className="font-bold text-xs sm:text-sm text-stone-900 dark:text-slate-100 flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Image className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Photos & Videos</span>
              </span>
            </label>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => {
                if (!isUploading) fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                  : isUploading
                    ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-wait'
                    : 'border-stone-300 dark:border-slate-600 hover:border-emerald-600 dark:hover:border-emerald-500 bg-stone-50/90 dark:bg-slate-800/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileInputChange}
                disabled={isUploading}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-2xs">
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 stroke-current animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 stroke-current" />
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-stone-800 dark:text-slate-100">
                    {isUploading ? 'Uploading media...' : 'Tap to upload photos or videos'}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                    Supports JPG, PNG, WebP, MP4, MOV up to 25MB
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Upload State & Progress Percentage Tracker adjacent to the input button */}
            {isUploading && (
              <div className="mt-2.5 p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-800 space-y-1.5 shadow-2xs animate-in fade-in">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5 truncate max-w-[240px]">
                    <CloudUpload className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 animate-pulse shrink-0" />
                    <span className="truncate">{uploadingFileName}</span>
                  </span>
                  <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                    {uploadProgress}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-emerald-200/80 dark:bg-emerald-900/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-150 rounded-full"
                    style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-2 flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Uploaded media previews */}
            {mediaList.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-slate-400">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Attached ({mediaList.length})</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {mediaList.map((m, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-emerald-300/60 aspect-video bg-black/90 group shadow-xs"
                    >
                      {m.type === 'image' ? (
                        <img
                          src={m.url}
                          alt="upload preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <video src={m.url} className="w-full h-full object-cover" />
                      )}
                      {m.type === 'video' && (
                        <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Film className="w-2.5 h-2.5" /> Video
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMedia(idx);
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition"
                        title="Remove file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            {isUploading && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-mono">{uploadProgress}%</span>
              </div>
            )}
            <button
              id="publish-post-submit-btn"
              type="submit"
              disabled={isUploading || isSubmitting}
              className={`flex-1 font-black py-3 px-4 rounded-xl text-sm sm:text-base transition shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                isUploading || isSubmitting
                  ? 'bg-stone-300 dark:bg-slate-800 text-stone-500 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white active:scale-98'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading Media ({uploadProgress}%)...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>
                  {type === 'chat'
                    ? 'Publish Post to Discussion Feed'
                    : 'Publish Item to Marketplace'}
                </span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
);
};


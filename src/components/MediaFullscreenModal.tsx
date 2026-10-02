/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Film,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';
import { MediaAttachment } from '../types';

interface MediaFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaAttachment[];
  initialIndex?: number;
  title?: string;
  author?: string;
}

export const MediaFullscreenModal: React.FC<MediaFullscreenModalProps> = ({
  isOpen,
  onClose,
  media,
  initialIndex = 0,
  title,
  author,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Gesture state tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when opening or when active media changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, media.length - 1)));
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setShowControls(true);
    }
  }, [isOpen, initialIndex, media.length]);

  // Reset zoom & pan on slide change
  const handleSelectIndex = (idx: number) => {
    setCurrentIndex(idx);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Keyboard navigation & escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && media.length > 1) {
        handleSelectIndex((currentIndex + 1) % media.length);
      } else if (e.key === 'ArrowLeft' && media.length > 1) {
        handleSelectIndex((currentIndex - 1 + media.length) % media.length);
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, media.length, onClose]);

  // Auto-hide controls after inactivity
  const pingControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (scale > 1) {
        setShowControls(false);
      }
    }, 3500);
  }, [scale]);

  // Zoom manipulation functions
  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
    pingControls();
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
    pingControls();
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    pingControls();
  };

  // Double tap / click to toggle zoom
  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (scale > 1) {
      resetZoom();
    } else {
      // Zoom into tapped coordinate
      const rect = contentRef.current?.getBoundingClientRect();
      if (rect) {
        const tapX = clientX - (rect.left + rect.width / 2);
        const tapY = clientY - (rect.top + rect.height / 2);
        setPosition({ x: -tapX * 1.2, y: -tapY * 1.2 });
      }
      setScale(2.5);
    }
    pingControls();
  };

  // Wheel zoom (mouse wheel / trackpad pinch)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = -e.deltaY * 0.003;
    setScale((prev) => {
      const next = Math.min(Math.max(1, prev + zoomDelta), 5);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
    pingControls();
  };

  // Pointer Event Handlers for unified Touch & Mouse support
  const handlePointerDown = (e: React.PointerEvent) => {
    pingControls();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Double tap detection
    const now = Date.now();
    if (pointersRef.current.size === 1 && now - lastTapTimeRef.current < 300) {
      handleDoubleTap(e.clientX, e.clientY);
      lastTapTimeRef.current = 0;
      return;
    }
    lastTapTimeRef.current = now;

    if (pointersRef.current.size === 2) {
      // Pinch gesture start
      const points = Array.from(pointersRef.current.values()) as Array<{ x: number; y: number }>;
      const [p1, p2] = points;
      if (p1 && p2) {
        pinchStartDistRef.current = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        pinchStartScaleRef.current = scale;
        setIsDragging(false);
      }
    } else if (pointersRef.current.size === 1) {
      // Pan gesture start
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      lastPanRef.current = { ...position };
      if (scale > 1) {
        setIsDragging(true);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartDistRef.current) {
      // Multi-touch pinch zoom
      const points = Array.from(pointersRef.current.values()) as Array<{ x: number; y: number }>;
      const [p1, p2] = points;
      if (p1 && p2) {
        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ratio = currentDist / pinchStartDistRef.current;
        const newScale = Math.min(Math.max(0.9, pinchStartScaleRef.current * ratio), 5);
        setScale(newScale);
      }
    } else if (pointersRef.current.size === 1 && isDragging && scale > 1) {
      // Single pointer pan
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      
      // Calculate max bounds based on zoom
      const maxPanX = (window.innerWidth * (scale - 1)) / 2 + 50;
      const maxPanY = (window.innerHeight * (scale - 1)) / 2 + 50;

      const newX = Math.min(Math.max(-maxPanX, lastPanRef.current.x + dx), maxPanX);
      const newY = Math.min(Math.max(-maxPanY, lastPanRef.current.y + dy), maxPanY);

      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    if (pointersRef.current.size < 2) {
      pinchStartDistRef.current = null;
      // Bounce back to 1 if pinched too small
      if (scale < 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }
    if (pointersRef.current.size === 0) {
      setIsDragging(false);
    }
  };

  // Toggle browser native fullscreen mode if permitted
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentMedia = media[currentIndex] || media[0];
  const isVideo = currentMedia?.type === 'video';

  return (
    <AnimatePresence>
      {isOpen && media.length > 0 && currentMedia && (
        <motion.div
          ref={containerRef}
          key="media-fullscreen-lightbox"
          initial={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)', transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 280,
            mass: 0.75,
          }}
          id="media-fullscreen-viewer"
          className="fixed inset-0 z-[100] bg-black/95 select-none overflow-hidden flex flex-col justify-between"
          onMouseMove={pingControls}
          onClick={pingControls}
        >
      {/* Top Header Bar */}
      <div
        className={`relative z-50 flex items-center justify-between px-4 py-3 sm:px-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="min-w-0 pr-4">
          {title && (
            <h3 className="text-white text-sm sm:text-base font-bold truncate drop-shadow-md">
              {title}
            </h3>
          )}
          <div className="flex items-center gap-2 text-xs text-stone-300">
            {author && <span>By {author}</span>}
            {media.length > 1 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                {currentIndex + 1} / {media.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Native Fullscreen Button */}
          <button
            id="toggle-fullscreen-btn"
            onClick={toggleFullscreen}
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          {/* Close Lightbox Button */}
          <button
            id="close-fullscreen-btn"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Image or Video with Pinch-to-Zoom */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={contentRef}
          className="relative max-w-full max-h-full flex items-center justify-center will-change-transform transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {isVideo ? (
            <div className="relative max-w-[95vw] max-h-[80vh] rounded-xl overflow-hidden shadow-2xl bg-black">
              <video
                ref={videoRef}
                src={currentMedia.url}
                className="w-full h-full max-h-[80vh] object-contain rounded-xl"
                playsInline
                autoPlay
                loop
                controls={false}
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Video Overlay Action Bar */}
              <div
                className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full text-white border border-white/20 transition-opacity duration-300 ${
                  showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                    }
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-full transition cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-full transition cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ) : (
            <img
              src={currentMedia.url}
              alt={currentMedia.name || title || 'Fullscreen picture'}
              className="max-w-[95vw] max-h-[85vh] object-contain select-none pointer-events-none rounded-lg shadow-2xl"
              draggable={false}
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {/* Previous Carousel Button */}
        {media.length > 1 && (
          <button
            id="fullscreen-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectIndex((currentIndex - 1 + media.length) % media.length);
            }}
            className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-lg transition-opacity duration-300 cursor-pointer ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Carousel Button */}
        {media.length > 1 && (
          <button
            id="fullscreen-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectIndex((currentIndex + 1) % media.length);
            }}
            className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-lg transition-opacity duration-300 cursor-pointer ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Controls Bar: Zoom Controls, Thumbnails & Reset */}
      <div
        className={`relative z-50 flex flex-col items-center gap-3 pb-5 pt-3 px-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Floating Zoom Bar with Touch/Click buttons */}
        <div className="flex items-center gap-2 bg-neutral-900/90 text-white px-3.5 py-1.5 rounded-full border border-white/20 shadow-xl backdrop-blur-md">
          <button
            id="zoom-out-btn"
            onClick={zoomOut}
            disabled={scale <= 1}
            className={`p-1.5 rounded-full transition ${
              scale <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 active:bg-white/30 cursor-pointer'
            }`}
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span
            onClick={resetZoom}
            className="text-xs font-mono font-bold px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer transition text-stone-200"
            title="Click to reset zoom"
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            id="zoom-in-btn"
            onClick={zoomIn}
            disabled={scale >= 5}
            className={`p-1.5 rounded-full transition ${
              scale >= 5 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 active:bg-white/30 cursor-pointer'
            }`}
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {scale > 1 && (
            <>
              <div className="w-px h-4 bg-white/20 mx-0.5" />
              <button
                id="reset-zoom-btn"
                onClick={resetZoom}
                className="p-1.5 hover:bg-white/20 rounded-full transition text-stone-300 hover:text-white cursor-pointer"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <p className="text-[11px] text-stone-400 font-medium tracking-wide">
          Pinch to zoom in/out • Double-tap to zoom • Drag to pan
        </p>

        {/* Thumbnail strip if multiple media attachments */}
        {media.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-[90vw] pb-1 pt-1">
            {media.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectIndex(idx)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                  currentIndex === idx
                    ? 'border-emerald-500 scale-105 shadow-md ring-2 ring-emerald-500/40'
                    : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt="thumbnail"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-900 flex items-center justify-center text-white">
                    <Film className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
);
};

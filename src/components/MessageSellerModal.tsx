/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { X, Send, User, MapPin, Tag, CheckCircle2 } from 'lucide-react';
import { MarketItem, UserProfile } from '../types';

interface MessageSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MarketItem | null;
  onSendMessage: (item: MarketItem, messageText: string) => void | boolean | Promise<void | boolean>;
  currentUser?: UserProfile | null;
}

export const MessageSellerModal: React.FC<MessageSellerModalProps> = ({
  isOpen,
  onClose,
  item,
  onSendMessage,
  currentUser
}) => {
  const [message, setMessage] = useState('');
  const [includePhone, setIncludePhone] = useState(true);
  const [isSent, setIsSent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const submittingRef = useRef(false);
  const dragControls = useDragControls();

  useEffect(() => {
    if (isOpen && item) {
      setIsClosing(false);
      const firstName = item.author.split(' ')[0] || 'Neighbor';
      setMessage(
        `Hi ${firstName}, I saw your listing for "${item.title}" and would love to arrange porch pickup! Is it still available?`
      );
      setIsSent(false);
    }
  }, [isOpen, item]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 190);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || !message.trim() || !item) return;
    submittingRef.current = true;

    let finalMessage = message.trim();
    if (includePhone) {
      const senderName = currentUser?.name || 'Resident';
      const senderDetails = [
        senderName,
        currentUser?.address || currentUser?.wing,
        currentUser?.phone ? `Phone: ${currentUser.phone}` : null
      ].filter(Boolean).join(' • ');
      finalMessage += `\n\n— ${senderDetails}`;
    }

    try {
      if (await onSendMessage(item, finalMessage) === false) return;
      setIsSent(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      console.warn('Could not send inquiry:', error);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && item && (
        <motion.div
          key="message-seller-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={handleClose}
          className="fixed inset-0 bg-stone-950/75 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            key="message-seller-modal"
            drag={isClosing ? false : "y"}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.2, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              const { offset, velocity } = info;
              if (offset.y > 60 || velocity.y > 250) {
                handleClose();
              }
            }}
            initial={{ y: '100%' }}
            animate={isClosing ? { y: '100%' } : { y: 0 }}
            exit={{ y: '100%' }}
            transition={
              isClosing
                ? { duration: 0.18, ease: [0.32, 0.72, 0, 1] }
                : {
                    type: 'spring',
                    damping: 28,
                    stiffness: 450,
                    mass: 0.35,
                  }
            }
            onAnimationComplete={() => {
              if (isClosing) {
                onClose();
              }
            }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[32px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto will-change-transform"
          >
            {/* iOS pull/grab indicator bar */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onClick={handleClose}
              style={{ touchAction: 'none' }}
              className="w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing sm:hidden shrink-0 group select-none -mt-2 mb-1"
            >
              <div className="w-12 h-1.5 bg-stone-300 dark:bg-slate-700 group-hover:bg-stone-400 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-slate-100 serif-title">
                  Message Seller
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-slate-400">
                  Direct message to your TownLoop neighbor
                </p>
              </div>
              <button
                id="close-message-seller-modal"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

        {/* Item & Seller Card Preview */}
        <div className="bg-stone-50 dark:bg-slate-800/70 border border-stone-200/80 dark:border-slate-700/80 rounded-2xl p-3.5 space-y-2.5">
          {/* Seller details */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-200 dark:bg-slate-700 border border-stone-300 dark:border-slate-600 shrink-0 flex items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
              {item.authorAvatar ? (
                <img
                  src={item.authorAvatar}
                  alt={item.author}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-stone-600 dark:text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-100 truncate">
                  {item.author}
                </h4>
                <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  Neighbor
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-slate-400">
                <MapPin className="w-3 h-3 text-stone-400 dark:text-slate-500 shrink-0" />
                <span>Porch pickup at {item.unit}</span>
              </div>
            </div>
          </div>

          {/* Item snippet */}
          <div className="pt-2 border-t border-stone-200/60 dark:border-slate-700/60 flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 dark:bg-slate-700 border border-stone-200 dark:border-slate-600 shrink-0 flex items-center justify-center">
              {item.media && item.media.length > 0 && item.media[0].type === 'image' ? (
                <img
                  src={item.media[0].url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Tag className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-xs font-bold text-stone-900 dark:text-slate-100 truncate">{item.title}</h5>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                {item.price}
              </span>
            </div>
          </div>
        </div>

        {isSent ? (
          <div className="py-6 text-center space-y-2 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-slate-100">Message Sent!</h4>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Your inquiry was sent to {item.author}. Check your Mail (Inbox) for any updates!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                Your Message
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your note to the neighbor..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-slate-700 text-xs focus:outline-emerald-600 bg-stone-50/50 dark:bg-slate-800/70 text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 leading-relaxed"
              />
            </div>

            {/* Include phone checkbox */}
            <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300 select-none cursor-pointer bg-stone-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-stone-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={includePhone}
                onChange={e => setIncludePhone(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-[11px] leading-tight">
                Include my resident info{' '}
                <strong className="text-stone-800 dark:text-slate-100">
                  (
                  {[
                    currentUser?.name || 'Resident',
                    currentUser?.address || currentUser?.wing,
                    currentUser?.phone || ''
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                  )
                </strong>
              </span>
            </label>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-slate-700 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-message-to-seller-btn"
                type="submit"
                disabled={!message.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
);
};

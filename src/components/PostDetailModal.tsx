/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  X,
  Heart,
  MessageSquare,
  Share2,
  Tag,
  Clock,
  User,
  Send,
  Check,
  Play,
  Film,
  Sparkles,
  ShieldCheck,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Trash2,
  MapPin,
  Maximize2
} from 'lucide-react';
import { PostItem, MarketItem, CommentItem } from '../types';
import { UserAvatar } from './UserAvatar';
import { MediaFullscreenModal } from './MediaFullscreenModal';

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostItem | null;
  marketItem: MarketItem | null;
  isOwner?: boolean;
  onToggleLikePost?: (postId: number) => void;
  onAddComment: (itemId: number, isMarket: boolean, text: string) => void | boolean | Promise<void | boolean>;
  onToggleSoldMarketItem?: (itemId: number) => void;
  onMessageSeller?: (item: MarketItem) => void;
  onClaimMarketItem?: (itemId: number) => void;
  onDeletePost?: (itemId: number, isMarket: boolean) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  isOpen,
  onClose,
  post,
  marketItem,
  isOwner,
  onToggleLikePost,
  onAddComment,
  onToggleSoldMarketItem,
  onMessageSeller,
  onClaimMarketItem,
  onDeletePost
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFullscreenMediaOpen, setIsFullscreenMediaOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const submittingRef = useRef(false);
  const dragControls = useDragControls();

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setConfirmDelete(false);
      setActiveMediaIndex(0);
      setIsFullscreenMediaOpen(false);
    }
  }, [isOpen, post?.id, marketItem?.id]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 190);
  };

  const isMarket = !!marketItem;
  const currentItem = isMarket ? marketItem : post;

  const title = currentItem?.title || '';
  const author = currentItem?.author || '';
  const unit = currentItem?.unit;
  const authorAvatar = currentItem?.authorAvatar;
  const timeAgo = isMarket ? marketItem?.timeAgo || 'Recently' : post?.timeAgo;
  const description = isMarket ? marketItem?.description : post?.content;
  const media = currentItem?.media || [];
  const comments = currentItem?.comments || [];
  const itemOwner = isOwner !== undefined ? isOwner : (isMarket ? Boolean(marketItem?.isOwner) : false);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || !newCommentText.trim() || !currentItem) return;
    submittingRef.current = true;
    const text = newCommentText.trim();
    try {
      if (await onAddComment(currentItem.id, isMarket, text) !== false) {
        setNewCommentText(value => value.trim() === text ? '' : value);
      }
    } catch (error) {
      console.warn('Could not add comment:', error);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleShare = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && currentItem && (
        <motion.div
          key="post-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={handleClose}
          className="fixed inset-0 bg-stone-950/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            key="post-detail-modal"
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
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl border-t sm:border border-stone-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] will-change-transform"
          >
            {/* iOS pull/grab indicator bar */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onClick={handleClose}
              style={{ touchAction: 'none' }}
              className="w-full py-2 flex items-center justify-center cursor-grab active:cursor-grabbing sm:hidden shrink-0 group select-none"
            >
              <div className="w-12 h-1.5 bg-stone-300 dark:bg-slate-700 group-hover:bg-stone-400 rounded-full" />
            </div>

            {/* Modal Header */}
        <div className="px-5 py-3.5 bg-stone-50/90 dark:bg-slate-800/80 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              src={authorAvatar}
              name={author}
              size="md"
              className="w-9 h-9 border border-emerald-600/30"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-100 truncate">{author}</h3>
                {isMarket ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                      marketItem?.sold || marketItem?.claimed
                        ? 'bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border border-stone-300 dark:border-slate-700'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        marketItem?.sold || marketItem?.claimed
                          ? 'bg-stone-500'
                          : 'bg-emerald-600'
                      }`}
                    />
                    {marketItem?.sold || marketItem?.claimed ? 'Sold' : 'Available'}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                    {post!.tag}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-slate-400 font-medium truncate">
                {unit} • {timeAgo}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            {/* Trashcan icon to delete post for post owner */}
            {itemOwner && onDeletePost && (
              confirmDelete ? (
                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-full px-2 py-1 animate-in fade-in">
                  <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">Delete?</span>
                  <button
                    id="confirm-delete-post-btn"
                    onClick={() => {
                      onDeletePost(currentItem.id, isMarket);
                      setConfirmDelete(false);
                      onClose();
                    }}
                    className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-2xs"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-1.5 py-0.5 rounded-full text-[11px] font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  id="modal-delete-post-btn"
                  onClick={() => setConfirmDelete(true)}
                  className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/50 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                  title="Delete post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
            <button
              onClick={handleShare}
              className="p-2 rounded-full hover:bg-stone-200/70 dark:hover:bg-slate-800 text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 transition cursor-pointer"
              title="Share post"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-slate-800 text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Post Title & Price */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-slate-100 serif-title leading-snug flex-1">
                {title}
              </h2>
              {isMarket && marketItem && (
                <div className="shrink-0 pt-0.5">
                  <span
                    className="text-base sm:text-lg font-extrabold px-3 py-1 rounded-xl shadow-xs border-2 border-[#e17100] bg-[#e17100] text-white inline-block"
                  >
                    {marketItem.price}
                  </span>
                </div>
              )}
            </div>
            <p className="text-stone-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {description}
            </p>
            {isMarket && unit && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-50 dark:bg-slate-800/70 border border-stone-200/80 dark:border-slate-700 rounded-xl text-xs text-stone-700 dark:text-slate-300 w-fit">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-stone-900 dark:text-slate-100">Porch pickup:</span>
                <span className="text-stone-600 dark:text-slate-400">{unit}</span>
              </div>
            )}
          </div>

          {/* Media Attachments Preview (Pictures & Videos) */}
          {media.length > 0 && (
            <div className="space-y-2 pt-1">
              <div
                onClick={() => setIsFullscreenMediaOpen(true)}
                className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-200 shadow-sm aspect-video flex items-center justify-center cursor-pointer group/media hover:ring-2 hover:ring-emerald-600/40 transition"
                title="Click to view full screen & pinch-to-zoom"
              >
                {media[activeMediaIndex].type === 'image' ? (
                  <img
                    src={media[activeMediaIndex].url}
                    alt={media[activeMediaIndex].name || 'Post attachment'}
                    className="w-full h-full object-contain group-hover/media:scale-101 transition duration-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full relative">
                    <video
                      controls={false}
                      src={media[activeMediaIndex].url}
                      className="w-full h-full object-contain"
                      playsInline
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/media:bg-black/35 transition">
                      <div className="w-12 h-12 rounded-full bg-white/90 text-stone-900 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
                {media[activeMediaIndex].type === 'video' && (
                  <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 pointer-events-none">
                    <Film className="w-3 h-3" />
                    Video
                  </div>
                )}

                {/* Full Screen Button Badge */}
                <button
                  type="button"
                  id="detail-view-fullscreen-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreenMediaOpen(true);
                  }}
                  className="absolute top-2.5 right-2.5 bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer z-10"
                  title="Open full screen with pinch-to-zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full Screen</span>
                </button>
              </div>

              {/* Thumbnails if multiple */}
              {media.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {media.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveMediaIndex(idx)}
                      className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                        activeMediaIndex === idx
                          ? 'border-emerald-600 shadow-xs ring-2 ring-emerald-600/30'
                          : 'border-stone-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {m.type === 'image' ? (
                        <img
                          src={m.url}
                          alt="thumb"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-800 flex items-center justify-center text-white">
                          <Play className="w-4 h-4 fill-current text-emerald-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Bar (Like, Claim, Comments count) */}
          <div className="pt-3 pb-2 border-y border-stone-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-stone-600 dark:text-slate-400">
            <div className="flex items-center gap-3">
              {!isMarket && onToggleLikePost && post && (
                <button
                  onClick={() => onToggleLikePost(post.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition font-medium ${
                    post.liked
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 font-bold'
                      : 'bg-stone-50 dark:bg-slate-800 border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${post.liked ? 'fill-rose-600 stroke-rose-600' : ''}`}
                  />
                  <span>
                    {post.likes} {post.likes === 1 ? 'Like' : 'Likes'}
                  </span>
                </button>
              )}

              {isMarket && marketItem && (
                <div className="flex items-center gap-2">
                  {itemOwner ? (
                    <button
                      id="modal-toggle-sold-btn"
                      onClick={() =>
                        onToggleSoldMarketItem && onToggleSoldMarketItem(marketItem.id)
                      }
                      className={`liquid-glass-pill ${
                        marketItem.sold || marketItem.claimed ? 'sold-state' : ''
                      }`}
                    >
                      {marketItem.sold || marketItem.claimed ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-stone-600 dark:text-slate-400 shrink-0" />
                          <span>Mark as Available</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Mark as Sold</span>
                        </>
                      )}
                    </button>
                  ) : marketItem.sold || marketItem.claimed ? (
                    <span className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-slate-400 font-semibold text-xs italic">
                      Item is Sold
                    </span>
                  ) : (
                    <button
                      id="modal-message-seller-btn"
                      onClick={() => onMessageSeller && onMessageSeller(marketItem)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message Seller</span>
                    </button>
                  )}
                </div>
              )}

              <span className="flex items-center gap-1.5 font-medium text-stone-500 dark:text-slate-400">
                <MessageSquare className="w-4 h-4" />
                {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
              </span>
            </div>
          </div>

          {/* Enhanced Comments Thread */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-stone-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Neighbor Conversation</span>
              <span className="text-[10px] bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 px-1.5 py-0.2 rounded-full">
                {comments.length}
              </span>
            </h4>

            {comments.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-2xl bg-stone-50 dark:bg-slate-800/40 border border-dashed border-stone-200 dark:border-slate-700 text-stone-500 dark:text-slate-400 text-xs">
                <p className="font-semibold text-stone-700 dark:text-slate-300">No comments yet</p>
                <p className="text-[11px] text-stone-400 dark:text-slate-500 mt-0.5">
                  Be the first neighbor to reply or say hello!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {comments.map(c => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-[#faf8f5] dark:bg-slate-800/70 border border-stone-200/70 dark:border-slate-700/80 space-y-1 transition hover:bg-stone-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={c.authorAvatar}
                          name={c.author}
                          size="xs"
                          className="w-6 h-6 border border-emerald-600/20 text-[10px]"
                        />
                        <span className="text-xs font-bold text-stone-800 dark:text-slate-200">{c.author}</span>
                        {c.unit && (
                          <span className="text-[10px] text-stone-400 dark:text-slate-500 font-medium">({c.unit})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 dark:text-slate-500 font-medium">{c.timeAgo}</span>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-slate-300 pl-8 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comment Input Footer */}
        <form
          onSubmit={handleSendComment}
          className="p-3 bg-stone-50 dark:bg-slate-900 border-t border-stone-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            placeholder={`Reply to ${author.split(' ')[0]}...`}
            className="flex-1 px-4 py-2.5 rounded-full border border-stone-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-stone-800 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600/40"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim()}
            className="px-4 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <span>Reply</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </motion.div>

      {/* Full Screen Zoomable Media Viewer */}
      <MediaFullscreenModal
        isOpen={isFullscreenMediaOpen}
        onClose={() => setIsFullscreenMediaOpen(false)}
        media={media}
        initialIndex={activeMediaIndex}
        title={title}
        author={author}
      />
    </motion.div>
  )}
</AnimatePresence>
);
};

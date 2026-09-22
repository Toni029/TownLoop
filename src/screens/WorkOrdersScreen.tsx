/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useRef } from 'react';
import {
  Plus,
  Truck,
  Wrench,
  CheckCircle2,
  Trash2,
  Camera,
  ChevronDown,
  Check,
  RotateCcw,
  AlertCircle,
  Maximize2,
  Loader2,
  CloudUpload,
  X,
  Languages,
  Globe,
  Sparkles,
} from 'lucide-react';
import type { WorkOrdersState } from '../hooks/useWorkOrders';
import { UserProfile, MediaAttachment, WorkOrderItem, WorkOrderComment } from '../types';
import {
  canCommentOnWorkOrder,
  canDeleteWorkOrder,
  canViewWorkOrder,
  canViewAllWorkOrders,
  isWorkOrderCreator,
  canCreateWorkOrder,
  isCrew,
  isAdmin,
  isVip,
} from '../utils/permissions';
import { getCategoryEmoji } from '../data/workOrderCategories';
import { MediaFullscreenModal } from '../components/MediaFullscreenModal';
import { uploadMediaToStorage } from '../services/storage';
import { auth } from '../firebase';
import { WorkOrderTicket } from '../components/workorders/WorkOrderTicket';
import { translateWorkOrder, TranslatedContent } from '../services/translator';

interface WorkOrdersScreenProps
  extends Pick<
    WorkOrdersState,
    | 'setIsWorkOrderModalOpen'
    | 'workOrders'
    | 'handleMarkAsDone'
    | 'handleCompleteWithReply'
    | 'handleReopenWorkOrder'
    | 'handleDeleteWorkOrder'
    | 'handleDeleteWorkOrderWithProof'
    | 'handleAddWorkOrderComment'
    | 'handleAddWorkOrderPhoto'
  > {
  currentUser?: UserProfile | null;
}

export function WorkOrdersScreen({
  setIsWorkOrderModalOpen,
  workOrders,
  handleMarkAsDone,
  handleCompleteWithReply,
  handleReopenWorkOrder,
  handleDeleteWorkOrder,
  handleDeleteWorkOrderWithProof,
  handleAddWorkOrderComment,
  currentUser,
}: WorkOrdersScreenProps) {
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);

  // Translation State for Crew / Spanish-speaking staff
  const [translatedMap, setTranslatedMap] = useState<{ [woId: string]: TranslatedContent }>({});
  const [translatingMap, setTranslatingMap] = useState<{ [woId: string]: boolean }>({});
  const [activeLanguageMap, setActiveLanguageMap] = useState<{ [woId: string]: 'es' | 'en' }>({});

  // Crew reply + photo state for marking as done
  const [crewReplyText, setCrewReplyText] = useState<{ [woId: string]: string }>({});
  const [crewReplyPhoto, setCrewReplyPhoto] = useState<{ [woId: string]: string }>({});
  const [crewReplyError, setCrewReplyError] = useState<{ [woId: string]: string | null }>({});
  const [crewUploadProgress, setCrewUploadProgress] = useState<{ [woId: string]: number }>({});
  const [crewIsUploading, setCrewIsUploading] = useState<{ [woId: string]: boolean }>({});
  const [crewUploadingFileName, setCrewUploadingFileName] = useState<{ [woId: string]: string }>({});

  // Regular comment input
  const [commentInputs, setCommentInputs] = useState<{ [woId: string]: string }>({});

  // Fullscreen zoomable image viewer state
  const [fullscreenData, setFullscreenData] = useState<{
    media: MediaAttachment[];
    initialIndex: number;
    title: string;
  } | null>(null);

  const isUserCrew = isCrew(currentUser);
  const isUserAdmin = isAdmin(currentUser);
  const isUserVip = isVip(currentUser) && !isUserAdmin;
  const seesAllWorkOrders = canViewAllWorkOrders(currentUser);
  const allowCreate = canCreateWorkOrder(currentUser);
  const allowComment = canCommentOnWorkOrder(currentUser);
  // Only Admin, VIP, and Crew roles are permitted to see and use the translation features
  const canTranslate = isUserAdmin || isUserCrew || isVip(currentUser);

  // Filter visible work orders: Admin, VIP, and Crew see all; regular residents only see their own
  const visibleWorkOrders = workOrders.filter((wo) => canViewWorkOrder(wo, currentUser));

  // Helper to open full-screen zoom lightbox on any picture
  const openFullscreenPhotos = (photos: string[], initialIndex = 0, title = 'Work Order Photo') => {
    if (!photos || photos.length === 0) return;
    const media: MediaAttachment[] = photos.map((url, i) => ({
      type: 'image',
      url,
      name: `${title} (${i + 1}/${photos.length})`,
    }));
    setFullscreenData({
      media,
      initialIndex,
      title,
    });
  };

  // Helper to check if a work order already has a crew reply with photo
  const hasCrewReplyWithPhoto = (wo: (typeof workOrders)[0]) => {
    return (
      wo.comments?.some((c) => !!c.photoUrl && c.text?.trim().length > 0) ||
      false
    );
  };

  // Crew file upload for reply directly to Firebase Storage /work_orders
  const handleCrewReplyFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    woId: number | string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i)
    ) {
      setCrewReplyError((prev) => ({
        ...prev,
        [String(woId)]: '❌ Videos are not allowed. Please upload a picture only.',
      }));
      if (e.target) e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      setCrewReplyError((prev) => ({
        ...prev,
        [String(woId)]: '❌ Please select a valid picture file (JPG, PNG, WebP).',
      }));
      if (e.target) e.target.value = '';
      return;
    }

    // Requirement 1: Session Safeguard
    const hasAuth = Boolean(auth?.currentUser || currentUser?.id);
    if (!hasAuth) {
      setCrewReplyError((prev) => ({
        ...prev,
        [String(woId)]: 'Session Safeguard: Crew member must be signed in to upload resolution proof photos.',
      }));
      if (e.target) e.target.value = '';
      return;
    }

    setCrewReplyError((prev) => ({ ...prev, [String(woId)]: null }));
    setCrewIsUploading((prev) => ({ ...prev, [String(woId)]: true }));
    setCrewUploadProgress((prev) => ({ ...prev, [String(woId)]: 0 }));
    setCrewUploadingFileName((prev) => ({ ...prev, [String(woId)]: file.name }));

    try {
      // Requirement 2: Dedicated /work_orders folder and unique naming timestamp_userId_filename
      const result = await uploadMediaToStorage({
        file,
        folder: 'work_orders',
        currentUser,
        onProgress: (percent) => {
          setCrewUploadProgress((prev) => ({ ...prev, [String(woId)]: percent }));
        },
      });

      // Requirement 3: Live secure web token string from getDownloadURL()
      setCrewReplyPhoto((prev) => ({ ...prev, [String(woId)]: result.url }));
    } catch (err: any) {
      console.warn('Crew photo upload notice:', err);
      setCrewReplyError((prev) => ({
        ...prev,
        [String(woId)]: err?.message || 'Failed to upload photo to Firebase Storage.',
      }));
    } finally {
      setCrewIsUploading((prev) => ({ ...prev, [String(woId)]: false }));
      setCrewUploadProgress((prev) => ({ ...prev, [String(woId)]: 0 }));
      setCrewUploadingFileName((prev) => ({ ...prev, [String(woId)]: '' }));
      if (e.target) e.target.value = '';
    }
  };

  // Submit crew reply + photo and mark as done
  const handleSubmitCrewCompletion = (woId: number | string) => {
    const text = (crewReplyText[String(woId)] || '').trim();
    const photo = (crewReplyPhoto[String(woId)] || '').trim();

    if (!text || !photo) {
      setCrewReplyError((prev) => ({
        ...prev,
        [String(woId)]: '⚠️ Both a reply note and a picture are required before marking as done.',
      }));
      return;
    }

    setCrewReplyError((prev) => ({ ...prev, [String(woId)]: null }));
    handleCompleteWithReply(woId, text, photo);
  };

  // Toggle English <-> Spanish translation for a single work order
  const handleToggleTranslate = async (wo: WorkOrderItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const idStr = String(wo.id);
    const currentLang = activeLanguageMap[idStr] || 'en';

    if (currentLang === 'es') {
      // Toggle back to original English
      setActiveLanguageMap((prev) => ({ ...prev, [idStr]: 'en' }));
      return;
    }

    // If already translated and cached
    if (translatedMap[idStr]) {
      setActiveLanguageMap((prev) => ({ ...prev, [idStr]: 'es' }));
      return;
    }

    // Fetch translation dynamically
    setTranslatingMap((prev) => ({ ...prev, [idStr]: true }));
    try {
      const result = await translateWorkOrder(wo);
      setTranslatedMap((prev) => ({ ...prev, [idStr]: result }));
      setActiveLanguageMap((prev) => ({ ...prev, [idStr]: 'es' }));
    } catch (error) {
      console.error('Failed to translate work order:', error);
    } finally {
      setTranslatingMap((prev) => ({ ...prev, [idStr]: false }));
    }
  };

  return (
    <section className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800 dark:text-stone-100 serif-title">
              Work Orders
            </h2>
            {isUserCrew ? (
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border border-blue-300 dark:border-blue-700 px-2 py-0.5 rounded-full">
                Crew Maintenance Mode
              </span>
            ) : isUserAdmin ? (
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full">
                Admin Queue Oversight
              </span>
            ) : isUserVip ? (
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-300 dark:border-purple-700 px-2 py-0.5 rounded-full">
                VIP Access
              </span>
            ) : (
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-full">
                My Requests
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
            {seesAllWorkOrders
              ? `All community maintenance tickets (${visibleWorkOrders.length}) • Live tracking & photo verification`
              : `Your maintenance requests (${visibleWorkOrders.length}) • Live tracking & photo verification`}
          </p>
        </div>

        {/* New Work Order Request button: ONLY for residents, VIP and Admin roles */}
        {allowCreate && (
          <button
            onClick={() => setIsWorkOrderModalOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-semibold text-xs px-3.5 py-2 rounded-2xl flex items-center gap-1.5 shadow-sm transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Request</span>
          </button>
        )}
      </div>

      {/* Live Worker Position Indicator Banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Truck className="w-5 h-5 stroke-current" />
        </div>
        <div className="text-xs">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">
            Maintenance Crew is currently on Job #1
          </p>
          <p className="text-emerald-700 dark:text-emerald-300">
            Building 2 • Estimated response: 15–20 mins
          </p>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {visibleWorkOrders.length === 0 ? (
          <div className="text-center py-10 px-4 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-1">
              <Wrench className="w-6 h-6" />
            </div>
            <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">
              {seesAllWorkOrders ? 'No work orders in queue' : 'You have no active work orders'}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              {seesAllWorkOrders
                ? 'All maintenance tickets have been resolved or deleted.'
                : 'As a resident, you only see the requests you create. Tap "New Request" above to submit a maintenance issue.'}
            </p>
          </div>
        ) : (
          (() => {
            const activeNonDoneOrders = workOrders.filter((w) => w.status !== 'Done');

            return visibleWorkOrders.map((wo) => {
              const idStr = String(wo.id);
              const isSpanish = activeLanguageMap[idStr] === 'es';
              const isTranslating = Boolean(translatingMap[idStr]);
              const trans = isSpanish ? translatedMap[idStr] : null;

              const displayTitle = trans?.title || wo.title;
              const displayDescription =
                trans && trans.description !== undefined && trans.description !== ''
                  ? trans.description
                  : wo.description;

              const isDone = wo.status === 'Done';
              const activeIndex = isDone
                ? -1
                : activeNonDoneOrders.findIndex((w) => String(w.id) === String(wo.id));
              const isInProgress =
                !isDone &&
                (activeIndex === 0 || (activeIndex === -1 && wo.placeInLine === 1));
              const placeInLine =
                activeIndex >= 0 ? activeIndex + 1 : wo.placeInLine || 1;
              const aheadCount =
                activeIndex >= 0 ? activeIndex : Math.max(0, (wo.placeInLine || 1) - 1);

              const isExpanded = expandedId === wo.id;
              const emoji = wo.categoryEmoji || getCategoryEmoji(wo.category);
              const hasReplyWithPic = hasCrewReplyWithPhoto(wo);
              const isCreator = isWorkOrderCreator(wo, currentUser);
              const canDelete = canDeleteWorkOrder(wo, currentUser);

              return (
                <div
                  key={wo.id}
                  id={`work-order-${wo.id}`}
                  data-original-title={wo.title}
                  data-original-description={wo.description || ''}
                  data-translated-title={trans?.title || ''}
                  data-translated-description={trans?.description || ''}
                  data-language={isSpanish ? 'es' : 'en'}
                  onClick={() => setExpandedId(isExpanded ? null : wo.id)}
                  className={`rounded-2xl transition-all duration-200 relative overflow-hidden cursor-pointer select-none ${
                    isExpanded ? 'p-3.5 sm:p-4 space-y-3.5 shadow-sm' : 'pl-0.5 sm:pl-1 pr-2 sm:pr-3 py-1.5 sm:py-2 shadow-xs'
                  } ${
                    isDone
                      ? 'bg-stone-100/90 dark:bg-stone-900/90 border border-stone-300 dark:border-stone-800 text-stone-500 dark:text-stone-400 opacity-60 grayscale hover:opacity-85'
                      : isInProgress
                      ? 'bg-white dark:bg-stone-900 border-2 border-emerald-500/80 ring-2 ring-emerald-100 dark:ring-emerald-950'
                      : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-300 dark:hover:border-emerald-700/60'
                  }`}
                >
                  {/* ======================================================== */}
                  {/* COLLAPSED / HEADER ROW: Work Order # in Ticket Graphic on Left */}
                  {/* ======================================================== */}
                  <div className={`justify-between gap-1 sm:gap-2 ${isExpanded ? 'flex items-start' : 'flex items-center'}`}>
                    {/* Left Section: Ticket + Category & Title shifted to the far left */}
                    <div className={`min-w-0 flex-1 gap-1.5 sm:gap-2 ${isExpanded ? 'flex items-start' : 'flex items-center'}`}>
                      {/* Work Order Ticket Icon moved further left */}
                      <div className="shrink-0 flex items-center">
                        <WorkOrderTicket code={wo.code} isDone={isDone} />
                      </div>

                      {/* Category Badge & Title moved further left */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                              isDone
                                ? 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-700'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{wo.category}</span>
                          </span>
                          {seesAllWorkOrders && wo.userName && (
                            <span className="text-[10px] text-stone-500 dark:text-stone-400 hidden sm:inline">
                              • Requested by <span className="font-semibold text-stone-700 dark:text-stone-200">{isCreator ? 'You' : wo.userName}</span>
                            </span>
                          )}
                        </div>

                        <h3
                          className={`font-bold text-sm sm:text-base leading-snug transition ${
                            isExpanded ? 'break-words whitespace-normal' : 'line-clamp-1'
                          } ${
                            isDone
                              ? 'text-stone-500 dark:text-stone-400 line-through decoration-stone-400'
                              : 'text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400'
                          }`}
                        >
                          {displayTitle}
                        </h3>
                      </div>
                    </div>

                    {/* Right Action Section: Translator (when collapsed) & Expand Arrow */}
                    <div className="flex items-center shrink-0 gap-1 sm:gap-1.5">
                      {/* Small translator button visible when collapsed (Only Admin, VIP, and Crew) */}
                      {canTranslate && !isExpanded && (
                        <button
                          type="button"
                          id={`collapsed-translate-btn-${wo.id}`}
                          onClick={(e) => handleToggleTranslate(wo, e)}
                          disabled={isTranslating}
                          title={
                            isTranslating
                              ? 'Translating to Spanish...'
                              : isSpanish
                              ? 'Show original English / Ver original'
                              : 'Translate to Spanish / Traducir al español'
                          }
                          aria-label={
                            isSpanish
                              ? 'Show original English'
                              : 'Translate to Spanish'
                          }
                          className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 shadow-2xs border cursor-pointer active:scale-90 ${
                            isTranslating
                              ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                              : isSpanish
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200'
                              : 'bg-stone-100/90 dark:bg-stone-800/90 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-200 dark:hover:border-blue-800'
                          }`}
                        >
                          {isTranslating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                          ) : isSpanish ? (
                            <span className="text-[10px] font-extrabold leading-none tracking-tight">ES</span>
                          ) : (
                            <Languages className="w-3.5 h-3.5 stroke-[2.2]" />
                          )}
                        </button>
                      )}

                      {/* Big cool modern arrow button on the far right */}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 shadow-xs border cursor-pointer ${
                          isExpanded
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/25 rotate-180 scale-105'
                            : isDone
                            ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-300 dark:border-stone-700'
                            : 'bg-stone-100/90 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 hover:border-emerald-300'
                        }`}
                        title={isExpanded ? 'Collapse' : 'Expand work order details'}
                      >
                        <ChevronDown className="w-5 h-5 stroke-[2.5] transition-transform duration-300" />
                      </div>
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* EXPANDED CONTENT: Revealed only when isExpanded is true  */}
                  {/* ======================================================== */}
                  {isExpanded && (
                    <div
                      className="space-y-3.5 pt-2 animate-in fade-in duration-150 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Meaningful Unified Status Tag, Translation Badge & Trashcan Delete Row */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-700/80">
                        {/* Left: Status Badge & Translation */}
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          {isDone ? (
                            <span className="text-xs font-bold bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-3 py-1 rounded-full flex items-center gap-1.5 border border-stone-300 dark:border-stone-700 shadow-2xs shrink-0">
                              <Check className="w-3.5 h-3.5 text-stone-500 stroke-[3]" />
                              Completed (Done)
                            </span>
                          ) : isInProgress ? (
                            <span className="text-xs font-bold bg-emerald-700 text-white px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs shrink-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping"></span>
                              In Progress
                            </span>
                          ) : (
                            <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 shadow-2xs shrink-0">
                              Queued #{placeInLine}
                            </span>
                          )}

                          {/* Translation Toggle in Expanded View (Only Admin, VIP, and Crew) */}
                          {canTranslate && (
                            <button
                              type="button"
                              onClick={(e) => handleToggleTranslate(wo, e)}
                              disabled={isTranslating}
                              className={`px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0 ${
                                isSpanish
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200'
                                  : 'bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                              }`}
                            >
                              {isTranslating ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                                  <span>Translating...</span>
                                </>
                              ) : isSpanish ? (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                  <span>Show Original</span>
                                </>
                              ) : (
                                <>
                                  <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>Translate</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Right: Trashcan Delete button strictly on the opposite right side of the same row */}
                        {canDelete && (
                          <div className="shrink-0 flex items-center justify-end">
                            {confirmDeleteId === wo.id ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl px-2.5 py-1 animate-in fade-in"
                              >
                                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                  Delete?
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWorkOrder(wo.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-0.5 rounded-lg cursor-pointer transition shadow-2xs"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="text-[11px] text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 font-medium px-1.5 py-0.5 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(wo.id);
                                }}
                                title="Delete work order"
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Detailed Description with small thin line frame */}
                      {displayDescription && (
                        <div className="p-3 sm:p-3.5 rounded-xl border border-stone-200 dark:border-stone-700/80 bg-stone-50/70 dark:bg-stone-800/50 shadow-2xs">
                          <p
                            className={`text-sm sm:text-base leading-relaxed font-medium whitespace-pre-wrap ${
                              isDone
                                ? 'text-stone-500 dark:text-stone-400'
                                : 'text-stone-800 dark:text-stone-100'
                            }`}
                          >
                            {displayDescription}
                          </p>
                        </div>
                      )}

                    {/* Resident Attached Photos (Directly under description, no subtitles/zoom notes) */}
                    {wo.photos && wo.photos.length > 0 && (
                      <div className="pt-1 flex gap-2.5 overflow-x-auto pb-1">
                        {wo.photos.map((photo, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() =>
                              openFullscreenPhotos(
                                wo.photos || [],
                                pIdx,
                                `${wo.code}: ${wo.title}`
                              )
                            }
                            className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shrink-0 cursor-pointer shadow-xs hover:ring-2 hover:ring-emerald-500 transition"
                            title="Click to view full screen"
                          >
                            <img
                              src={photo}
                              alt={`work order photo ${pIdx + 1}`}
                              className="w-full h-full object-cover transition group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                              <Maximize2 className="w-5 h-5 drop-shadow" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Location / Address placed underneath resident pictures with location emoji */}
                    <div className="pt-0.5 flex items-center flex-wrap gap-2 text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <span className="text-base">📍</span>
                        <span>{wo.unit}</span>
                      </span>
                      {wo.userName && (
                        <>
                          <span className="text-stone-300 dark:text-stone-600 font-normal">•</span>
                          <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
                            Requested by{' '}
                            <span className="font-semibold text-stone-700 dark:text-stone-200">
                              {isCreator ? 'You' : wo.userName}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Crew Updates & Replies List */}
                    {wo.comments && wo.comments.length > 0 && (
                      <div
                        className={`pt-2 border-t space-y-2 ${
                          isDone
                            ? 'border-stone-300 dark:border-stone-700'
                            : 'border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                          <span>Crew Updates & Replies ({wo.comments.length})</span>
                          {isSpanish && (
                            <span className="text-blue-600 dark:text-blue-400 font-normal normal-case">
                              (Comentarios traducidos)
                            </span>
                          )}
                        </p>
                        {wo.comments.map((comm) => {
                          const commentText =
                            isSpanish && trans?.comments && trans.comments[comm.id]
                              ? trans.comments[comm.id]
                              : comm.text;

                          return (
                            <div
                              key={comm.id}
                              className={`p-3 rounded-2xl text-xs space-y-1.5 border ${
                                isDone
                                  ? 'bg-stone-300/60 dark:bg-stone-700/60 border-stone-400/60 text-stone-600'
                                  : 'bg-stone-50 dark:bg-stone-800/80 border-stone-200/60 dark:border-stone-700 text-stone-800 dark:text-stone-200'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] text-stone-500">
                                <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1">
                                  <Wrench className="w-3 h-3 text-blue-700 dark:text-blue-400" />
                                  {comm.author} ({comm.role})
                                </span>
                                <span>{comm.timestamp}</span>
                              </div>
                              <p className="text-stone-800 dark:text-stone-200 font-medium">
                                {commentText}
                              </p>

                              {/* Comment Photo (Clickable for zoom in / out) */}
                              {comm.photoUrl && (
                                <div className="pt-1">
                                  <div
                                    onClick={() =>
                                      openFullscreenPhotos(
                                        [comm.photoUrl!],
                                        0,
                                        `Crew Reply Photo by ${comm.author}`
                                      )
                                    }
                                    className="group relative inline-block w-24 h-24 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-600 bg-stone-100 cursor-pointer shadow-xs hover:ring-2 hover:ring-blue-500 transition"
                                    title="Click to view full screen with zoom in/out"
                                  >
                                    <img
                                      src={comm.photoUrl}
                                      alt="Crew attached photo"
                                      className="w-full h-full object-cover transition group-hover:scale-105"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                                      <Maximize2 className="w-4 h-4 drop-shadow" />
                                    </div>
                                  </div>
                                  <span className="block text-[10px] text-stone-400 mt-0.5">
                                    Verified Crew Resolution Picture
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* CREW COMMENTS SECTION (ONLY Crew Role can see & use)       */}
                    {/* ========================================================= */}
                    {isUserCrew && (
                      <div className="space-y-3 pt-1">
                        {/* Improved Dotted Line Division */}
                        <div className="border-t-2 border-dotted border-stone-300 dark:border-stone-700 my-2 pt-2" />

                        {/* Crew Comments Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Crew Comments</span>
                          </span>

                          {/* Completed / Reopen status */}
                          {isDone ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1">
                                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                <span>Marked as Done</span>
                              </span>
                              <button
                                onClick={() => handleReopenWorkOrder(wo.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-300 dark:bg-stone-700 hover:bg-stone-400 text-stone-800 dark:text-stone-200 text-xs font-bold transition cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reopen</span>
                              </button>
                            </div>
                          ) : (
                            hasReplyWithPic && (
                              <button
                                onClick={() => handleMarkAsDone(wo.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Mark as Done (Photo Verified ✓)</span>
                              </button>
                            )
                          )}
                        </div>

                        {/* Reply with a picture before marking as done box (when not done) */}
                        {!isDone && (
                          <div className="bg-stone-50 dark:bg-stone-800/80 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
                            <p className="text-xs font-bold text-stone-700 dark:text-stone-200">
                              Reply with a picture before marking as done
                            </p>

                            {/* Error message if validation fails */}
                            {crewReplyError[wo.id] && (
                              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{crewReplyError[wo.id]}</span>
                              </div>
                            )}

                            {/* 1. Reply Description */}
                            <div>
                              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1">
                                Resolution Note / Description <span className="text-rose-500">*</span>
                              </label>
                              <textarea
                                rows={2}
                                value={crewReplyText[wo.id] || ''}
                                onChange={(e) =>
                                  setCrewReplyText((prev) => ({
                                    ...prev,
                                    [wo.id]: e.target.value,
                                  }))
                                }
                                placeholder="e.g. Replaced faulty washer, pressure tested at 45 PSI, tested lines."
                                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-emerald-600 resize-none"
                              />
                            </div>

                            {/* 2. Reply Picture Upload (Pictures only, NO videos) */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                                  Resolution Picture <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[10px] text-stone-500 bg-white dark:bg-stone-800 px-2 py-0.5 rounded-full border border-stone-200 dark:border-stone-700">
                                  Photos Only • No Videos
                                </span>
                              </div>

                              {/* Hidden file input for crew picture */}
                              <input
                                type="file"
                                id={`crew-photo-file-${wo.id}`}
                                accept="image/*"
                                onChange={(e) => handleCrewReplyFileUpload(e, wo.id)}
                                className="hidden"
                              />

                              {/* Picture Preview or Upload Button */}
                              {crewReplyPhoto[wo.id] ? (
                                <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                                  <div
                                    onClick={() =>
                                      openFullscreenPhotos(
                                        [crewReplyPhoto[wo.id]],
                                        0,
                                        'Resolution Picture Preview'
                                      )
                                    }
                                    className="group relative w-16 h-16 rounded-lg overflow-hidden border border-stone-300 shrink-0 cursor-pointer shadow-xs"
                                    title="Click to zoom in full screen"
                                  >
                                    <img
                                      src={crewReplyPhoto[wo.id]}
                                      alt="Crew resolution preview"
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                                      <Maximize2 className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Photo Attached</span>
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCrewReplyPhoto((prev) => ({
                                        ...prev,
                                        [wo.id]: '',
                                      }))
                                    }
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-md text-xs font-bold cursor-pointer"
                                  >
                                    Change
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    if (!crewIsUploading[wo.id]) {
                                      document
                                        .getElementById(`crew-photo-file-${wo.id}`)
                                        ?.click();
                                    }
                                  }}
                                  className={`border-2 border-dashed rounded-xl p-3 text-center transition ${
                                    crewIsUploading[wo.id]
                                      ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-wait'
                                      : 'border-stone-300 dark:border-stone-700 hover:border-emerald-500 bg-white dark:bg-stone-800/50 cursor-pointer hover:bg-emerald-50/20'
                                  }`}
                                >
                                  {crewIsUploading[wo.id] ? (
                                    <Loader2 className="w-5 h-5 text-emerald-600 mx-auto mb-1 animate-spin" />
                                  ) : (
                                    <Camera className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                                  )}
                                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                    {crewIsUploading[wo.id]
                                      ? 'Uploading proof photo...'
                                      : 'Click to upload resolution picture'}
                                  </p>
                                </div>
                              )}

                              {/* Requirement 4: Visual Upload State & Progress Tracker adjacent to Crew upload button */}
                              {crewIsUploading[wo.id] && (
                                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 space-y-1 shadow-2xs animate-in fade-in">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5 truncate max-w-[200px]">
                                      <CloudUpload className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                                      <span className="truncate">
                                        Uploading {crewUploadingFileName[wo.id]}
                                      </span>
                                    </span>
                                    <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded text-[10px]">
                                      {crewUploadProgress[wo.id] || 0}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-emerald-200 dark:bg-emerald-800/80 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-emerald-600 h-full transition-all duration-150 rounded-full"
                                      style={{
                                        width: `${Math.max(crewUploadProgress[wo.id] || 0, 5)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Submit Reply & Complete Button */}
                            <div className="pt-1 flex items-center gap-2">
                              {crewIsUploading[wo.id] && (
                                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold shrink-0 animate-pulse">
                                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="font-mono">{crewUploadProgress[wo.id] || 0}%</span>
                                </div>
                              )}
                              <button
                                type="button"
                                disabled={crewIsUploading[wo.id]}
                                onClick={() => handleSubmitCrewCompletion(wo.id)}
                                className={`flex-1 font-bold py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 ${
                                  crewIsUploading[wo.id]
                                    ? 'bg-stone-300 dark:bg-stone-700 text-stone-500 cursor-not-allowed'
                                    : 'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white cursor-pointer active:scale-98'
                                }`}
                              >
                                {crewIsUploading[wo.id] ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>
                                      Uploading Proof ({crewUploadProgress[wo.id] || 0}%)...
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Submit Reply & Mark as Done</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Standard Crew Comment Log Box */}
                        {allowComment && !isDone && (
                          <div className="flex gap-1.5 pt-1">
                            <input
                              value={commentInputs[wo.id] || ''}
                              onChange={(e) =>
                                setCommentInputs({
                                  ...commentInputs,
                                  [wo.id]: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const text = (commentInputs[wo.id] || '').trim();
                                  if (text) {
                                    handleAddWorkOrderComment(wo.id, text);
                                    setCommentInputs({ ...commentInputs, [wo.id]: '' });
                                  }
                                }
                              }}
                              placeholder="Add general maintenance note..."
                              className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-blue-600"
                            />
                            <button
                              onClick={() => {
                                const text = (commentInputs[wo.id] || '').trim();
                                if (text) {
                                  handleAddWorkOrderComment(wo.id, text);
                                  setCommentInputs({ ...commentInputs, [wo.id]: '' });
                                }
                              }}
                              disabled={!(commentInputs[wo.id] || '').trim()}
                              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                            >
                              Log Note
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()
      )}
    </div>

      {/* Fullscreen Zoomable Lightbox for any work order picture */}
      {fullscreenData && (
        <MediaFullscreenModal
          isOpen={!!fullscreenData}
          onClose={() => setFullscreenData(null)}
          media={fullscreenData.media}
          initialIndex={fullscreenData.initialIndex}
          title={fullscreenData.title}
          author="Work Order Attachment"
        />
      )}
    </section>
  );
}

/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import {
  X,
  Users,
  Check,
  BookOpen,
  Clock,
  Download,
  Pin,
  CalendarPlus,
  CalendarCheck,
  MapPin,
  Upload,
  Trash2,
  Plus,
  FileText,
  RotateCcw,
  Edit3,
  Sparkles,
} from 'lucide-react';
import type { NewsState } from '../hooks/useNewsState';
import type { PortalDatesState } from '../hooks/usePortalDates';
import type { UserProfile } from '../types';
import { canManageNewsletter, canManagePinnedHighlights, isVip } from '../utils/permissions';
import { sortEventsEarlyFirst } from '../utils/eventSort';
import { convertDataUrlToBlobUrl } from '../utils/pdfStorage';
import { UploadNewsletterModal } from '../components/UploadNewsletterModal';
import { AddRsvpEventModal } from '../components/AddRsvpEventModal';
import { AddHighlightModal } from '../components/AddHighlightModal';

interface NewsScreenProps extends NewsState, Pick<PortalDatesState, 'currentMonthEdition'> {
  currentUser?: UserProfile | null;
  onShowToast?: (message: string) => void;
}

export function NewsScreen({
  rsvpToast,
  setRsvpToast,
  currentMonthEdition,
  newsletterConfig,
  setIsPdfModalOpen,
  isUploadNewsletterModalOpen,
  setIsUploadNewsletterModalOpen,
  handleSaveNewsletterConfig,
  handleRemoveNewsletter,
  handleRestoreDefaultNewsletter,
  setNewsSubView,
  newsSubView,
  rsvpEvents,
  handleToggleRsvp,
  handleAddRsvpEvent,
  handleUpdateRsvpEvent,
  handleDeleteRsvpEvent,
  isAddEventModalOpen,
  setIsAddEventModalOpen,
  editingRsvpEvent,
  handleOpenAddEventModal,
  handleOpenEditEventModal,
  pinnedHighlights,
  handleAddHighlight,
  handleDeleteHighlight,
  isAddHighlightModalOpen,
  setIsAddHighlightModalOpen,
  handleApplyAiExtraction,
  isReanalyzingAi,
  handleReanalyzeNewsletter,
  currentUser,
  onShowToast,
}: NewsScreenProps) {
  const hasNewsletterManagement = canManageNewsletter(currentUser);
  const hasHighlightManagement = canManagePinnedHighlights(currentUser);
  const hasEventManagement = isVip(currentUser);

  const isRemoved = Boolean(newsletterConfig?.isRemoved);
  const pdfUrl = newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl || '';
  const hasPdf = Boolean(!isRemoved && pdfUrl);
  const isCustom = Boolean(hasPdf && (newsletterConfig?.isCustomUpload || pdfUrl.length > 0));
  const editionTitle = newsletterConfig?.editionTitle || `The Breeze: ${currentMonthEdition}`;
  const effectiveDescription =
    newsletterConfig?.description ||
    'Featuring the 2026 Pet Gallery, Flu Shot Clinic, Continuum of Care Olive Garden Lunch, Make Your Own Sundae Social, Wii Bowling Results & Community Potlucks.';

  const handleOpenPdfInNewTab = () => {
    if (pdfUrl) {
      const targetUrl = convertDataUrlToBlobUrl(pdfUrl);
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    setIsPdfModalOpen(true);
  };

  // Events sorted from the beginning of the month to the last of the month (early first)
  const sortedEvents = useMemo(() => sortEventsEarlyFirst(rsvpEvents), [rsvpEvents]);

  // Forward toast to global floating toast so scroll position is never shifted by in-flow DOM elements
  useEffect(() => {
    if (rsvpToast) {
      onShowToast?.(rsvpToast);
      setRsvpToast(null);
    }
  }, [rsvpToast, onShowToast, setRsvpToast]);

  const [confirmingRemovePdf, setConfirmingRemovePdf] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const savedSelectorTopRef = useRef<number | null>(null);

  // Maintain completely static scroll position when switching subviews (prevents teleporting to middle of screen)
  useLayoutEffect(() => {
    if (savedSelectorTopRef.current !== null && selectorRef.current) {
      const targetTop = savedSelectorTopRef.current;
      savedSelectorTopRef.current = null;
      const mainEl = selectorRef.current.closest('main') || document.querySelector('main');
      const currentTop = selectorRef.current.getBoundingClientRect().top;
      const diff = currentTop - targetTop;
      if (Math.abs(diff) > 0.5) {
        if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
          mainEl.scrollTop += diff;
        } else {
          window.scrollBy(0, diff);
        }
      }
    }
  }, [newsSubView]);

  const handleSelectSubView = (
    e: React.MouseEvent<HTMLButtonElement>,
    subView: 'events' | 'highlights'
  ) => {
    e.currentTarget.blur();
    if (selectorRef.current) {
      savedSelectorTopRef.current = selectorRef.current.getBoundingClientRect().top;
    }
    setNewsSubView(subView);
  };

  return (
    <section className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 serif-title">
            Community Bulletin
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Announcements, upcoming events, and official gazette
          </p>
        </div>

        {hasNewsletterManagement && (
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
            Admin / VIP Management Mode
          </span>
        )}
      </div>

      {/* Official Publication — AT THE TOP OF NEWS */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[30px] p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl"></div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest font-extrabold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shadow-2xs">
              Official Publication
            </span>
            {isCustom && (
              <span className="text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800/80 px-2 py-0.5 rounded-full">
                Custom Upload
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            {newsletterConfig?.monthEdition || 'The Breeze'}
          </span>
        </div>

        {isRemoved ? (
          <div className="mt-3 py-2 space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold serif-title leading-tight text-rose-300">
              Newsletter Currently Removed
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              The publication was removed. Admins and VIP residents can upload a new edition (.pdf or document) to share with the community.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold serif-title leading-tight">
              {editionTitle}
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              {effectiveDescription}
            </p>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isRemoved && (
            <button
              type="button"
              onClick={handleOpenPdfInNewTab}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow transition cursor-pointer"
              title="Open newsletter PDF in new tab"
            >
              <BookOpen className="w-4 h-4" />
              <span>Open PDF in new tab</span>
            </button>
          )}

          {!isRemoved && (
            <button
              type="button"
              onClick={async () => {
                if (hasPdf && (newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl)) {
                  const targetUrl = newsletterConfig.pdfUrl || newsletterConfig.fileUrl || '';
                  try {
                    if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
                      const a = document.createElement('a');
                      a.href = targetUrl;
                      a.download = newsletterConfig.fileName || 'Newsletter.pdf';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      return;
                    }
                    const res = await fetch(targetUrl);
                    const blob = await res.blob();
                    const bUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = bUrl;
                    a.download = newsletterConfig.fileName || 'Newsletter.pdf';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(bUrl);
                  } catch {
                    // Fallback to opening reader directly so browser never navigates away
                    setIsPdfModalOpen(true);
                  }
                } else {
                  const text = `THE BREEZE - CECIL PINES COMMUNITY NEWSLETTER (${currentMonthEdition})\nFeaturing Pet Gallery, Flu Shot Clinic, CPAC Updates & Activities.`;
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Cecil-Pines-The-Breeze-${currentMonthEdition.replace(/\s+/g, '-')}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold text-xs px-3.5 py-2.5 rounded-2xl border border-white/20 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Edition</span>
            </button>
          )}

          {/* Admin / VIP Publishing Controls */}
          {hasNewsletterManagement && (
            <>
              <button
                type="button"
                onClick={() => setIsUploadNewsletterModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-sky-600/80 hover:bg-sky-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-2xl border border-sky-400/30 transition shadow-xs cursor-pointer"
                title="Upload or Replace Newsletter PDF"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isRemoved ? 'Upload PDF' : isCustom ? 'Replace PDF' : 'Upload New PDF'}</span>
              </button>

              {/* Stacked Admin Column: Re-analyze with AI strictly above Remove PDF */}
              {!isRemoved && (
                <div className="inline-flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleReanalyzeNewsletter?.()}
                    disabled={isReanalyzingAi}
                    className="inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-2 rounded-2xl border border-amber-400/40 transition shadow-xs cursor-pointer disabled:opacity-60"
                    title="Re-read and analyze thoroughly in depth to extract missed RSVP events & highlights"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isReanalyzingAi ? 'animate-spin' : ''}`} />
                    <span>{isReanalyzingAi ? 'Re-analyzing Thoroughly...' : 'Re-analyze with AI'}</span>
                  </button>

                  {confirmingRemovePdf ? (
                    <div className="inline-flex items-center gap-1.5 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={async () => {
                          setConfirmingRemovePdf(false);
                          await handleRemoveNewsletter();
                        }}
                        className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-rose-500 transition shadow-sm cursor-pointer animate-pulse"
                        title="Confirm removal of newsletter PDF"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirm Remove PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRemovePdf(false)}
                        className="inline-flex items-center px-2 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer border border-stone-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingRemovePdf(true)}
                      className="inline-flex items-center justify-center gap-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 font-bold text-xs px-3.5 py-1.5 rounded-2xl border border-rose-700/50 transition cursor-pointer"
                      title="Remove Current Newsletter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove PDF</span>
                    </button>
                  )}
                </div>
              )}

              {isRemoved && (
                <button
                  type="button"
                  onClick={handleRestoreDefaultNewsletter}
                  className="inline-flex items-center gap-1.5 bg-stone-700 hover:bg-stone-600 text-white text-xs font-semibold px-3 py-2 rounded-2xl transition cursor-pointer"
                  title="Restore September 2026 default edition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Default Edition</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pretty and simple 2-selection selector with signature greenish tone */}
      <div
        id="news-view-selector"
        ref={selectorRef}
        className="grid grid-cols-2 gap-2 sm:gap-3 p-2 bg-gradient-to-r from-emerald-50/95 via-[#f2f7f4] to-teal-50/95 dark:from-emerald-950/60 dark:via-slate-900 dark:to-teal-950/50 rounded-2xl border border-emerald-200/90 dark:border-emerald-800/70 shadow-2xs"
        role="tablist"
        aria-label="News view selector"
      >
        {/* Selection 1: RSVP Upcoming Events */}
        <button
          type="button"
          id="news-filter-events"
          role="tab"
          aria-selected={newsSubView !== 'highlights'}
          onClick={(e) => {
            e.stopPropagation();
            handleSelectSubView(e, 'events');
          }}
          className={`flex flex-col items-center justify-center gap-1.5 py-3 sm:py-3.5 px-2.5 sm:px-3 rounded-xl transition cursor-pointer text-center min-h-[78px] sm:min-h-[86px] ${
            newsSubView !== 'highlights'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-emerald-900/90 dark:text-emerald-200/90 hover:bg-white/80 dark:hover:bg-emerald-900/30 hover:text-emerald-950 dark:hover:text-emerald-100 font-semibold'
          }`}
          title="Show RSVP Upcoming Events"
        >
          <div className="flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-current" />
            <span
              className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-full transition ${
                newsSubView !== 'highlights'
                  ? 'bg-emerald-800 text-emerald-100'
                  : 'bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {sortedEvents.length}
            </span>
          </div>
          <span className="text-sm sm:text-base font-extrabold leading-snug">
            RSVP Upcoming Events
          </span>
        </button>

        {/* Selection 2: Pinned Highlights */}
        <button
          type="button"
          id="news-filter-highlights"
          role="tab"
          aria-selected={newsSubView === 'highlights'}
          onClick={(e) => {
            e.stopPropagation();
            handleSelectSubView(e, 'highlights');
          }}
          className={`flex flex-col items-center justify-center gap-1.5 py-3 sm:py-3.5 px-2.5 sm:px-3 rounded-xl transition cursor-pointer text-center min-h-[78px] sm:min-h-[86px] ${
            newsSubView === 'highlights'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-emerald-900/90 dark:text-emerald-200/90 hover:bg-white/80 dark:hover:bg-emerald-900/30 hover:text-emerald-950 dark:hover:text-emerald-100 font-semibold'
          }`}
          title="Show Pinned Highlights"
        >
          <div className="flex items-center gap-1.5">
            <Pin className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 rotate-12 text-current" />
            <span
              className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-full transition ${
                newsSubView === 'highlights'
                  ? 'bg-emerald-800 text-emerald-100'
                  : 'bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {pinnedHighlights.length}
            </span>
          </div>
          <span className="text-sm sm:text-base font-extrabold leading-snug">
            Pinned Highlights
          </span>
        </button>
      </div>

      {/* Selected View: RSVP Upcoming Events or Pinned Highlights */}
      <div className="space-y-4 pt-1">
        {/* View 1: RSVP Upcoming Events */}
        {newsSubView !== 'highlights' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-extrabold text-stone-900 dark:text-white text-sm sm:text-base">
                  Upcoming Events & RSVP
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">
                  Tap RSVP to reserve your spot
                </span>

                {hasEventManagement && (
                  <button
                    type="button"
                    onClick={handleOpenAddEventModal}
                    className="min-h-[36px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Add New RSVP Event (Admin/VIP)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Event</span>
                  </button>
                )}
              </div>
            </div>

            {sortedEvents.length === 0 ? (
              <div className="text-center py-8 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800">
                <CalendarCheck className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                  No upcoming RSVP events scheduled.
                </p>
                {hasEventManagement && (
                  <button
                    type="button"
                    onClick={handleOpenAddEventModal}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Event</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="relative bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition space-y-3"
                  >
                    {/* Top-Right Action buttons for Admin/VIP editing & deletion */}
                    {hasEventManagement && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                        <button
                          type="button"
                          onClick={() => handleOpenEditEventModal(event)}
                          className="w-8 h-8 rounded-xl text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition flex items-center justify-center cursor-pointer"
                          title={`Edit event "${event.title}"`}
                          aria-label={`Edit event "${event.title}"`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteRsvpEvent(event.id, event.title);
                            onShowToast?.(`Removed "${event.title}".`);
                          }}
                          className="w-8 h-8 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition flex items-center justify-center cursor-pointer active:scale-95"
                          title={`Delete event "${event.title}"`}
                          aria-label={`Delete event "${event.title}"`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-start gap-3 pr-16 sm:pr-0">
                      {/* Date Calendar Box */}
                      <div className="w-13 h-14 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                        <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                          {event.month}
                        </span>
                        <span className="text-lg font-black text-stone-900 dark:text-white leading-none">
                          {event.day}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-200/70 dark:border-emerald-800">
                            {event.category}
                          </span>
                          {event.deadline && (
                            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded border border-amber-200/70 dark:border-amber-800">
                              {event.deadline}
                            </span>
                          )}
                          {event.userRsvp && (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                              <Check className="w-2.5 h-2.5" /> You're Going
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-stone-900 dark:text-white text-sm leading-snug">
                          {event.title}
                        </h4>
                        <p className="text-xs text-stone-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {event.description}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-stone-500 dark:text-stone-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                            {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                            {event.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Attendees count & RSVP Action Button */}
                    <div className="pt-2.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 font-medium">
                        <Users className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          <strong className="text-stone-700 dark:text-stone-200 font-bold">
                            {event.attendeesCount}
                          </strong>{' '}
                          neighbors attending
                        </span>
                        {event.spotsLeft !== undefined && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                            ({event.spotsLeft} spots left)
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleRsvp(event.id, currentUser)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer min-h-[38px] ${
                          event.userRsvp
                            ? 'bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                        }`}
                      >
                        {event.userRsvp ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
                            <span>RSVP'd ✓</span>
                          </>
                        ) : (
                          <>
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>RSVP</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* View 2: Pinned Highlights */}
        {newsSubView === 'highlights' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Pinned Highlights Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Pin className="w-4 h-4 text-amber-600 fill-amber-600 rotate-12" />
                  <h3 className="font-extrabold text-stone-900 dark:text-white text-sm sm:text-base">
                    Pinned Highlights
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 border border-amber-300/80 dark:border-amber-800 px-2 py-0.5 rounded-full">
                    Priority Notices
                  </span>

                  {hasHighlightManagement && (
                    <button
                      type="button"
                      onClick={() => setIsAddHighlightModalOpen(true)}
                      className="min-h-[36px] px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Add New Pinned Highlight (Admin/VIP)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pin Notice</span>
                    </button>
                  )}
                </div>
              </div>

              {pinnedHighlights.length === 0 ? (
                <div className="text-center py-6 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800">
                  <Pin className="w-7 h-7 text-stone-400 mx-auto mb-2 rotate-12" />
                  <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                    No pinned highlights at this time.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {pinnedHighlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className="relative bg-gradient-to-br from-amber-50/90 via-[#fffdf9] to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 border border-amber-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1.5 overflow-hidden"
                    >
                      {/* Top-Right Trashcan for Admin/VIP deletion */}
                      {hasHighlightManagement && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteHighlight(highlight.id, highlight.title);
                            onShowToast?.(`Unpinned "${highlight.title}".`);
                          }}
                          className="absolute top-3 right-3 w-8 h-8 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition flex items-center justify-center cursor-pointer z-10 active:scale-95"
                          title={`Unpin highlight "${highlight.title}"`}
                          aria-label={`Unpin highlight "${highlight.title}"`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div className="flex items-center justify-between pr-8 sm:pr-0 flex-wrap gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            {highlight.category}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
                          {highlight.authorLabel}
                        </span>
                      </div>

                      <h4 className="font-bold text-stone-900 dark:text-white text-sm pr-8 sm:pr-0">
                        {highlight.title}
                      </h4>
                      <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                        {highlight.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Admin/VIP Upload Newsletter Modal */}
      <UploadNewsletterModal
        isOpen={isUploadNewsletterModalOpen}
        onClose={() => setIsUploadNewsletterModalOpen(false)}
        currentConfig={newsletterConfig}
        onSaveConfig={handleSaveNewsletterConfig}
        onRemoveNewsletter={handleRemoveNewsletter}
        onExtractContent={handleApplyAiExtraction}
        currentUser={currentUser}
      />

      {/* Admin/VIP Add/Edit RSVP Event Modal */}
      <AddRsvpEventModal
        isOpen={isAddEventModalOpen}
        onClose={() => setIsAddEventModalOpen(false)}
        onAddEvent={handleAddRsvpEvent}
        editingEvent={editingRsvpEvent}
        onUpdateEvent={handleUpdateRsvpEvent}
      />

      {/* Admin/VIP Add Highlight Modal */}
      <AddHighlightModal
        isOpen={isAddHighlightModalOpen}
        onClose={() => setIsAddHighlightModalOpen(false)}
        onAddHighlight={handleAddHighlight}
      />
    </section>
  );
}

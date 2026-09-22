/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useMemo } from 'react';
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
} from 'lucide-react';
import type { NewsState } from '../hooks/useNewsState';
import type { PortalDatesState } from '../hooks/usePortalDates';
import type { UserProfile } from '../types';
import { canManageNewsletter, canManagePinnedHighlights, isVip } from '../utils/permissions';
import { sortEventsEarlyFirst } from '../utils/eventSort';
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
  currentUser,
  onShowToast,
}: NewsScreenProps) {
  const hasNewsletterManagement = canManageNewsletter(currentUser);
  const hasHighlightManagement = canManagePinnedHighlights(currentUser);
  const hasEventManagement = isVip(currentUser);

  const isRemoved = newsletterConfig?.isRemoved;
  const isCustom = newsletterConfig?.isCustomUpload && !!newsletterConfig?.fileUrl;
  const editionTitle = newsletterConfig?.editionTitle || `The Breeze: ${currentMonthEdition}`;
  const effectiveDescription =
    newsletterConfig?.description ||
    'Featuring the 2026 Pet Gallery, Flu Shot Clinic, Continuum of Care Olive Garden Lunch, Make Your Own Sundae Social, Wii Bowling Results & Community Potlucks.';

  // Events sorted from the beginning of the month to the last of the month (early first)
  const sortedEvents = useMemo(() => sortEventsEarlyFirst(rsvpEvents), [rsvpEvents]);

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

      {/* Toast confirmation when RSVP / item is updated */}
      {rsvpToast && (
        <div className="bg-emerald-800 text-white text-xs px-4 py-2.5 rounded-2xl shadow-md flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="font-semibold">{rsvpToast}</span>
          </div>
          <button
            onClick={() => setRsvpToast(null)}
            className="text-white/70 hover:text-white transition cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Read Newsletter {isCustom ? '(PDF)' : '(The Breeze)'}</span>
            </button>
          )}

          {!isRemoved && (
            <button
              onClick={() => {
                if (isCustom && newsletterConfig?.fileUrl) {
                  const a = document.createElement('a');
                  a.href = newsletterConfig.fileUrl;
                  a.download = newsletterConfig.fileName || 'Newsletter.pdf';
                  a.click();
                } else {
                  const text = `THE BREEZE - CECIL PINES COMMUNITY NEWSLETTER (${currentMonthEdition})\nFeaturing Pet Gallery, Flu Shot Clinic, CPAC Updates & Activities.`;
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Cecil-Pines-The-Breeze-${currentMonthEdition.replace(/\s+/g, '-')}.txt`;
                  a.click();
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

              {!isRemoved && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Are you sure you want to remove the current newsletter PDF? Community residents will see an empty publication card until a new edition is published.'
                      )
                    ) {
                      handleRemoveNewsletter();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 font-bold text-xs px-3.5 py-2.5 rounded-2xl border border-rose-700/50 transition cursor-pointer"
                  title="Remove Current Newsletter"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove PDF</span>
                </button>
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

      {/* Two Option Buttons: RSVP Upcoming Events & Pinned Highlights */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-200/70 dark:bg-slate-800 rounded-2xl border border-stone-300/60 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setNewsSubView('events')}
          className={`flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            newsSubView === 'events'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <CalendarCheck className="w-4 h-4 shrink-0" />
          <span>RSVP Upcoming Events</span>
        </button>

        <button
          type="button"
          onClick={() => setNewsSubView('highlights')}
          className={`flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            newsSubView === 'highlights'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Pin className="w-4 h-4 shrink-0 rotate-12" />
          <span>Pinned Highlights</span>
        </button>
      </div>

      {/* View 1: RSVP Upcoming Events */}
      {newsSubView === 'events' && (
        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-bold text-stone-900 dark:text-white text-sm">
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
                      onClick={() => handleToggleRsvp(event.id)}
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
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          {/* Pinned Highlights Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Pin className="w-4 h-4 text-amber-600 fill-amber-600 rotate-12" />
                <h3 className="font-bold text-stone-900 dark:text-white text-sm">
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
                    className="relative bg-gradient-to-br from-amber-50/90 via-[#fffdf9] to-amber-50/50 dark:from-slate-900 dark:to-slate-800 border border-amber-200/90 dark:border-amber-900/50 rounded-2xl p-4 shadow-2xs space-y-1.5 overflow-hidden"
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

          {/* Facility Notices */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Recent Facility Notices
            </h3>

            <div className="bg-white dark:bg-slate-900 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-1">
                <span>MAIN COURTYARD</span>
                <span>2 hours ago</span>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                Irrigation Maintenance Notice
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Grounds crew will test courtyard sprinklers between 1:00 PM and
                3:00 PM. Walkways may be damp.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-1">
                <span>COMMUNITY CENTER</span>
                <span>Yesterday</span>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                Weekly Farmers Market Basket Delivery
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Fresh produce baskets arrive this Thursday morning at 9:30 AM in
                the North Foyer.
              </p>
            </div>
          </div>
        </div>
      )}

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

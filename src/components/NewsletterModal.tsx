/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Utensils,
  Check,
  Maximize2,
  Minimize2,
  Heart,
  Syringe,
  Award,
  Users,
  Coffee,
  Sparkles,
  Trophy,
  Phone,
  Cake,
  BookOpen,
  Home,
  Dog,
  Cat,
  Vote,
  Upload,
  Trash2,
  FileText,
} from 'lucide-react';
import type { NewsletterConfig } from '../types';
import { NewsletterGalleryView } from './NewsletterGalleryView';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthEdition?: string;
  newsletterConfig?: NewsletterConfig;
  onOpenUploadModal?: () => void;
  onRemoveNewsletter?: () => void;
  onReanalyzeNewsletter?: () => void;
  isReanalyzingAi?: boolean;
  canManage?: boolean;
}

export const NewsletterModal: React.FC<NewsletterModalProps> = ({
  isOpen,
  onClose,
  monthEdition = 'September 2026',
  newsletterConfig,
  onOpenUploadModal,
  onRemoveNewsletter,
  onReanalyzeNewsletter,
  isReanalyzingAi = false,
  canManage = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const dragControls = useDragControls();

  const isRemoved = Boolean(newsletterConfig?.isRemoved);
  const pdfUrl = newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl || '';
  const hasPdf = Boolean(!isRemoved && pdfUrl);
  const isCustom = Boolean(hasPdf && (newsletterConfig?.isCustomUpload || pdfUrl.length > 0));
  const editionTitle = newsletterConfig?.editionTitle || `The Breeze: ${monthEdition}`;
  const effectiveMonth = newsletterConfig?.monthEdition || monthEdition;

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsFullScreen(false);
      setCurrentPage(1);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 190);
  };

  // Allow closing via Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Full-screen direct standard PDF reader for custom uploaded documents or documents with PDF URL
  if (isOpen && hasPdf && !isRemoved) {
    return (
      <NewsletterGalleryView
        pdfUrl={pdfUrl}
        fileUrl={pdfUrl}
        fileName={newsletterConfig?.fileName || 'Newsletter.pdf'}
        title={editionTitle}
        monthEdition={effectiveMonth}
        newsletterConfig={newsletterConfig}
        onClose={handleClose}
        onOpenUploadModal={onOpenUploadModal}
        canManage={canManage}
      />
    );
  }

  const totalPages = 6;

  const handleDownload = () => {
    setDownloadSuccess(true);

    const textContent = `===================================================================
                       THE BREEZE - SEPTEMBER 2026
        Official Monthly Newsletter of Cecil Pines Adult Living Community
                 6008 Lake Cove Ave., Jacksonville, FL 32221
===================================================================

[PAGE 1]
* THE CECIL PINES PET GALLERY IS HERE!
  Our Furry, Four-legged Friends are Ready For Their Moment in the Spotlight!
  
* ARM YOURSELF! GET THE SHOT, NOT THE FLU!
  Tuesday, September 22nd | 10am - 1pm
  Walgreens will bring Flu & many other shots. Bring Your Card & I.D.
  *RSVP By Friday, September 18th *REQUIRED*

* CPAC COORDINATORS & COMMUNITY CONTACTS
  Facilitator: Office (771-8839)
  Secretary: Lori Stauffer (610-505-4396) | Treasurer: Tom Kemp (777-0604)
  Sunshine / Email: Veronica Thomas (573-0589) | Bingo: Gerry Sweeten (779-0098)
  Game Night: Gene Skidmore (716-4816) | Flag Master / Snapshot: Les Parkinson (710-9458)
  Road Walk: Dan Jowers (981-0097) | Social Saturday: Bill Anderson (778-1492)
  Travel Group: Tom Kemp (777-0604) | Reading in the Pines: Rhonda Jones (757-572-6004)
  Decorations & Exercise: Judy Koetitz (575-9979) | Potluck: Nancy Dickerson (229-251-8023)
  Wii Bowling: Dan Jowers (981-0097) | Gifted Hands: Lynnette Pease (236-8132)
  Ladies' Tripoli: Kathy Abdell (254-5895), Judy Hebzynski (763-367-0013)
  Koffee Klatch: Nancy Dickerson, Gene Skidmore, Paul Newbauer
  Librarian: Mary Forbes (771-6693) | Lunch Bunch: Gina Cristi (404-408-6727)
  Recycle: Bob Stauffer (610-316-9466) | Progressive Rummy: Kathy Abdell (254-5895)

* ADMINISTRATION & ZONE CAPTAINS
  General Manager: Christina Purdy | Sales/Marketing/Front Desk: Cayla McCubbin
  Accounts Payable/Receivable: Antonio Merlano | Housekeeper: Mary Lowry
  Maintenance: Jovino Alicea, Manoel Yepes, Cesar Montilla
  Zone 1: Les Parkinson | Zone 2: Bob Stauffer | Zone 3: Bob Bingenheimer
  Zone 4: Randy Randall | Zone 5: Larry Forbes | Sorters: Bob & Lori Stauffer

-------------------------------------------------------------------
[PAGE 2]
* CHRIS'S COMMUNICATIONS ZONE
  - CPAC Meeting: Tuesday, Sept 1st at 2:30pm in Community Center.
  - Gate Safety: DO NOT STOP at gate while opening. Proceed promptly & safely.
  - Key Roundup: Call the office if you hold any building key.
  - National POW/MIA Recognition Day: Saturday, Sept 19, 11am - 4:30pm.
  - Race Dates at Golf Course: Sept 4, Oct 16-17, Oct 22, Nov 6, Nov 13.
  - Deadlines: RSVP Shots by Sept 18th | Vote Cutest Pet by Sept 28th!

* CONTINUUM OF CARE PANEL DISCUSSION
  Tuesday, September 29th • 12pm
  Come Enjoy Lunch From Olive Garden!
  Presenters: Senior Living Placement, Castle Home Health, Vivo Healthcare,
  Gentiva Hospice, North Florida Rehab Hospital, Live 2 B Healthy Senior Fitness.
  **RSVP by Friday, Sept 25th**

-------------------------------------------------------------------
[PAGE 3]
* MAKE YOUR OWN SUNDAE!
  Friday, September 18th at 2:30pm
  Hosted by: Alivia Home Health & Community Hospice & Palliative Care.
  **RSVP By 9/14**

* CELEBRATING SEPTEMBER BIRTHDAYS
  Audrey E. (9/01), Kathleen M. (9/06), Les P. (9/14), Dan B. (9/17),
  Gina K. (9/19), Nancy A. (9/20), McArthur H. (9/22), Joseph P. (9/22),
  Jack J. (9/24), Brady W. (9/28).

* HAPPY ANNIVERSARY
  Dan & Ina B. (9/02), William & D. (9/07), Patrick & Christine S. (9/10),
  Bryan & Susan S. (9/25).

* WELCOME NEW NEIGHBORS: Lynne P. (Pine Links) & David & Marjorie V. (Pine Straw)
* 10 YEAR CLUB: Donna S.
* 15 YEAR CLUB: Herb & Gretta E.

-------------------------------------------------------------------
[PAGE 4]
* THE CECIL PINES PET GALLERY (Entries #1 - #12)
* COMMUNITY BIRTHDAY PARTY RECAP: Over 30 residents joined us for the fun!
* MEDICARE, DIZZINESS & BALANCE HEALTH TALK
  Friday, September 4th at 10am
  - Navigating Medicare (Natalie Healthcare Solutions)
  - Dizziness & Balance (Enhabit Home Health & Hospice)
  **RSVP By 9/3**

-------------------------------------------------------------------
[PAGE 5]
* HEY, IT'S CAYLA! FRONT DESK NOTE
  Back to school & track season updates. JEA water testing results confirmed safe!
* LIBRARY REOPENING UPDATE: Almost ready!
* MRS. MICHAELS' THANK YOU: Generous classroom school supplies donation from Cecil Pines!
* PET GALLERY (Entries #13 - #19) & VOTING
  Call office with entry number. Free voting. Donations benefit EveryPet.

-------------------------------------------------------------------
[PAGE 6]
* WII BOWLING SUMMER LEAGUE RESULTS
  1st: "What the Heck" (19-12) | 2nd: "Two 'N Two" (17-15)
  3rd: "Gutter Sweepers" (16-15) | 4th: "Spare Necessities" (16-16)
  5th: "Spare Me Not" (12-20)
  High Series: Gene Skidmore (826), Veronica Thomas (868)
  High Games: Billy Dickerson (300), Glenn Sikes (300), Kathy Abdell (300)
  Most Improved: Mike Smith (+14), Christine Smith (+2)

* RECURRING CLUBS & ACTIVITIES
  - Koffee Klatch: Thursdays 7:30am - 9:30am
  - Lunch Bunch: Friday, Sept 11th at 12pm (Green Papaya Thai & Sushi)
  - Total Potluck: Tuesday, Sept 15th at 5pm ($5 + 50/50 prizes)
  - Social Saturday Potluck: Saturday, Sept 26th at 5:30pm
  - Game Night & Blackjack: Mondays & Fridays at 5pm
  - Bingo: 2nd & 4th Tuesday at 6pm
  - Ladies' Tripoli: 3rd Saturday at 11am
  - Gifted Hands: Sept 16th & 30th at 10am
  - Wagging Woods Pup Play Date: Sept 1st at 3pm
===================================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cecil-Pines-The-Breeze-September-2026.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setDownloadSuccess(false);
    }, 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="newsletter-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={handleClose}
          className="fixed inset-0 bg-stone-950/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            key="newsletter-modal-sheet"
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
            onClick={(e) => e.stopPropagation()}
            className={`bg-stone-900 flex flex-col shadow-2xl overflow-hidden will-change-transform transition-[max-width,border-radius] duration-200 ${
              isFullScreen
                ? 'fixed inset-0 w-full h-full max-w-none max-h-none rounded-none z-[110] border-0 p-0'
                : 'w-full max-w-3xl h-[94vh] sm:h-[90vh] rounded-t-[28px] sm:rounded-[32px] border-t sm:border border-stone-800'
            }`}
          >
            {/* Top Bar with Navigation & Actions */}
            <div
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button')) {
                  dragControls.start(e);
                }
              }}
              style={{ touchAction: 'none' }}
              className="bg-stone-900 border-b border-stone-800 px-4 py-2.5 flex items-center justify-between shrink-0 select-none cursor-grab active:cursor-grabbing"
            >
              {/* Left: Magazine Title & Page Count */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase shrink-0">
                  {isCustom ? 'Uploaded Edition' : 'The Breeze'}
                </span>
                <span className="text-xs font-bold text-stone-300 truncate">
                  {isRemoved
                    ? 'No Active Edition'
                    : isCustom
                    ? editionTitle
                    : `${effectiveMonth} • Page ${currentPage} of ${totalPages}`}
                </span>
              </div>

              {/* Center: Pull Handle */}
              <div
                onClick={() => setIsFullScreen((prev) => !prev)}
                className="hidden sm:flex flex-1 justify-center py-1 group cursor-pointer"
                title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    isFullScreen
                      ? 'w-16 bg-emerald-600'
                      : 'w-12 bg-stone-600 hover:bg-stone-500'
                  }`}
                />
              </div>

              {/* Action Buttons: Management, Full Screen, Download, Close */}
              <div className="flex items-center gap-1.5 shrink-0">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenUploadModal?.();
                      }}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white text-[11px] font-bold transition border border-emerald-600/50 cursor-pointer shadow-xs"
                      title="Upload or replace newsletter document"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCustom ? 'Replace PDF' : 'Upload PDF'}</span>
                    </button>

                    {!isRemoved && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveNewsletter?.();
                          onClose();
                        }}
                        className="w-8 h-8 rounded-full bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white flex items-center justify-center transition border border-rose-800/50 cursor-pointer"
                        title="Remove Current Newsletter PDF"
                        aria-label="Remove Newsletter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}

                {!isRemoved && onReanalyzeNewsletter && (
                  <button
                    type="button"
                    onClick={() => onReanalyzeNewsletter()}
                    disabled={isReanalyzingAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    title="Extract all RSVP events and highlights with AI"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isReanalyzingAi ? 'animate-spin text-amber-400' : 'text-amber-300'}`} />
                    <span className="hidden sm:inline">
                      {isReanalyzingAi ? 'Extracting Events...' : 'Extract RSVP Events with AI'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullScreen((prev) => !prev)}
                  className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
                >
                  {isFullScreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>

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
                          } else {
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
                          }
                          setDownloadSuccess(true);
                          setTimeout(() => setDownloadSuccess(false), 2500);
                        } catch {
                          setDownloadSuccess(true);
                          setTimeout(() => setDownloadSuccess(false), 2500);
                        }
                      } else {
                        handleDownload();
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-emerald-400 hover:text-emerald-300 flex items-center justify-center transition cursor-pointer"
                    title={downloadSuccess ? 'Downloaded' : 'Download Edition'}
                  >
                    {downloadSuccess ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title="Close Reader"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Page Area */}
            <div className="flex-1 overflow-y-auto bg-stone-950/90 p-2 sm:p-4 flex justify-center">
              {isRemoved ? (
                /* Empty state when newsletter is removed */
                <div className="w-full max-w-lg my-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 text-center space-y-4 text-white shadow-2xl">
                  <div className="w-16 h-16 rounded-3xl bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto shadow-md">
                    <Trash2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-serif">No Active Newsletter</h3>
                    <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      The newsletter publication was removed by management. Admins and VIP residents can upload a new edition (.pdf, document, or scan) at any time.
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onOpenUploadModal?.()}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload New Edition</span>
                    </button>
                  )}
                </div>
              ) : isCustom ? (
                /* Custom Uploaded PDF / Document Viewer */
                <div
                  className={`w-full ${
                    isFullScreen ? 'max-w-6xl' : 'max-w-4xl'
                  } bg-white dark:bg-stone-900 rounded-3xl border border-stone-300 dark:border-stone-800 p-3 sm:p-5 space-y-3 shadow-2xl flex flex-col transition-all duration-200`}
                >
                  <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                          {newsletterConfig?.editionTitle || 'Uploaded Newsletter'}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {newsletterConfig?.fileName}{' '}
                          {newsletterConfig?.fileSize ? `• ${newsletterConfig.fileSize}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onReanalyzeNewsletter && (
                        <button
                          type="button"
                          onClick={() => onReanalyzeNewsletter()}
                          disabled={isReanalyzingAi}
                          className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Extract all RSVP events and highlights from this newsletter"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isReanalyzingAi ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">
                            {isReanalyzingAi ? 'Extracting...' : 'Extract RSVP Events'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsFullScreen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                        title={isFullScreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
                      >
                        {isFullScreen ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {isFullScreen ? 'Standard' : 'Expand'}
                        </span>
                      </button>

                      {(newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl) && (
                        <button
                          type="button"
                          onClick={async () => {
                            const target = newsletterConfig.pdfUrl || newsletterConfig.fileUrl || '';
                            try {
                              if (target.startsWith('blob:') || target.startsWith('data:')) {
                                const a = document.createElement('a');
                                a.href = target;
                                a.download = newsletterConfig.fileName || 'Newsletter.pdf';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              } else {
                                const res = await fetch(target);
                                const blob = await res.blob();
                                const bUrl = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = bUrl;
                                a.download = newsletterConfig.fileName || 'Newsletter.pdf';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(bUrl);
                              }
                            } catch {
                              // fallback
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {newsletterConfig?.description && (
                    <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                      {newsletterConfig.description}
                    </div>
                  )}

                  {/* Standard PDF Reader View */}
                  {newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl ? (
                    <div className="flex-1 w-full min-h-[540px] flex flex-col">
                      <NewsletterGalleryView
                        pdfUrl={newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl}
                        fileUrl={newsletterConfig?.pdfUrl || newsletterConfig?.fileUrl}
                        fileName={newsletterConfig?.fileName || 'Newsletter.pdf'}
                        title={newsletterConfig?.editionTitle || 'Community Newsletter'}
                        newsletterConfig={newsletterConfig}
                        onClose={handleClose}
                      />
                    </div>
                  ) : (
                    <div className="py-16 text-center text-stone-500 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-stone-200 dark:border-stone-700">
                      <FileText className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                        No document data available to display.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Default Standard 6-page Breeze Reader */
                <div className="w-full max-w-2xl bg-[#fffefb] shadow-2xl rounded-2xl border border-stone-300/80 text-stone-900 flex flex-col font-sans">
                
                {/* Masthead Header */}
                <div className="p-4 sm:p-5 border-b-2 border-stone-800 bg-[#fbf8f0]">
                  <div className="flex items-center justify-between border-b border-stone-300 pb-1.5 text-[9px] sm:text-[10px] uppercase font-bold text-stone-600 tracking-wider">
                    <span>Cecil Pines Adult Living Community</span>
                    <span className="font-extrabold text-emerald-800">September 2026 Edition</span>
                    <span>Jacksonville, FL</span>
                  </div>
                  <div className="text-center pt-3 pb-1">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-widest uppercase font-serif text-stone-900">
                      THE BREEZE
                    </h1>
                    <p className="text-[10px] sm:text-[11px] italic font-serif text-stone-600 mt-0.5">
                      "A monthly newsletter published jointly by the residents and the administration of Cecil Pines"
                    </p>
                  </div>
                </div>

                {/* ================= PAGE 1 ================= */}
                {currentPage === 1 && (
                  <div className="p-4 sm:p-6 space-y-5 flex-1">
                    {/* Hero Pet Gallery Banner */}
                    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border-2 border-emerald-600/40 rounded-2xl p-4 sm:p-5 shadow-xs text-center space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[11px] tracking-wide uppercase">
                        🐾 Special Spotlight
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-emerald-950 font-serif tracking-tight pt-1">
                        The Cecil Pines Pet Gallery Is Here!
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-emerald-800">
                        Our Furry, Four-Legged Friends Are Ready For Their Moment In The Spotlight!
                      </p>
                      <p className="text-[11px] text-emerald-700 pt-1">
                        👉 Flip to <strong>Pages 4 & 5</strong> to view all 19 pet contestants and cast your vote!
                      </p>
                    </div>

                    {/* Flu Shot Clinic Announcement */}
                    <div className="bg-amber-50/80 border-2 border-dashed border-amber-400/80 rounded-2xl p-4 sm:p-5 space-y-2">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-base sm:text-lg">
                        <Syringe className="w-5 h-5 text-amber-700 shrink-0" />
                        <span>Arm Yourself! Get the Shot, Not the Flu!</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-800 pt-1">
                        <div className="bg-white/80 p-3 rounded-xl border border-amber-200">
                          <p className="font-bold text-stone-900 text-sm">📅 Tuesday, Sept. 22nd</p>
                          <p className="font-semibold text-emerald-700 mt-0.5">⏰ 10:00 AM – 1:00 PM</p>
                          <p className="text-[11px] text-stone-600 mt-1">
                            Walgreens will bring Flu & many other vaccines to Cecil Pines!
                          </p>
                        </div>
                        <div className="bg-white/80 p-3 rounded-xl border border-amber-200 space-y-1">
                          <p className="font-bold text-rose-800 text-xs">
                            ⚠️ *RSVP By Friday, Sept. 18th *REQUIRED*
                          </p>
                          <p className="text-[11px] text-stone-600">
                            Please bring your insurance card and valid photo ID.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CPAC Coordinators Table */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-700" />
                        <span>Cecil Pines Activities Committee (CPAC) Coordinators</span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-stone-800">
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Office</p>
                          <p className="text-stone-600">771-8839</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Secretary: Lori Stauffer</p>
                          <p className="text-stone-600">610-505-4396</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Treasurer: Tom Kemp</p>
                          <p className="text-stone-600">777-0604</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Sunshine: Veronica Thomas</p>
                          <p className="text-stone-600">573-0589</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Bingo: Gerry Sweeten</p>
                          <p className="text-stone-600">779-0098</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Game Night: Gene Skidmore</p>
                          <p className="text-stone-600">716-4816</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Flag / Snapshot: Les Parkinson</p>
                          <p className="text-stone-600">710-9458</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Potluck: Nancy Dickerson</p>
                          <p className="text-stone-600">229-251-8023</p>
                        </div>
                        <div className="bg-stone-100/80 p-2 rounded-lg border border-stone-200">
                          <p className="font-bold text-stone-900">Wii Bowling: Dan Jowers</p>
                          <p className="text-stone-600">981-0097</p>
                        </div>
                      </div>
                    </div>

                    {/* Zone Captains & Admin */}
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-[10px] text-stone-600 space-y-1">
                      <p className="font-bold text-stone-800">
                        Administration: Christina Purdy (GM), Cayla McCubbin (Sales/Front Desk), Antonio Merlano (A/P & A/R), Mary Lowry (Housekeeping), Jovino Alicea, Manoel Yepes, Cesar Montilla (Maintenance).
                      </p>
                      <p>
                        Zone Captains: Zone 1 (Les Parkinson), Zone 2 (Bob Stauffer), Zone 3 (Bob Bingenheimer), Zone 4 (Randy Randall), Zone 5 (Larry Forbes). Sorters: Bob & Lori Stauffer.
                      </p>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 2 ================= */}
                {currentPage === 2 && (
                  <div className="p-4 sm:p-6 space-y-4 flex-1">
                    {/* Chris's Communications Zone */}
                    <div className="bg-[#fcfaf4] p-4 rounded-2xl border border-stone-300/80 space-y-3">
                      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                        <span className="text-lg">🚨</span>
                        <h2 className="text-base sm:text-lg font-bold font-serif text-stone-900">
                          Chris's Communications Zone
                        </h2>
                      </div>

                      <div className="space-y-2.5 text-xs text-stone-700">
                        <div>
                          <p className="font-bold text-emerald-900 text-[13px]">
                            • CPAC Meeting
                          </p>
                          <p className="leading-relaxed">
                            Join us for another CPAC meeting <strong>Tuesday, September 1st at 2:30pm</strong> in the Community Center. CPAC meets to plan activities and new ideas. Everyone is welcome!
                          </p>
                        </div>

                        <div>
                          <p className="font-bold text-amber-900 text-[13px]">
                            • Gate Safety Reminder
                          </p>
                          <p className="leading-relaxed">
                            Please remember <strong>DO NOT STOP</strong> at the gate while it is opening when entering or exiting the community. Once it begins to open, continue through promptly and safely.
                          </p>
                        </div>

                        <div>
                          <p className="font-bold text-stone-900 text-[13px]">
                            • Key Roundup!
                          </p>
                          <p className="leading-relaxed">
                            If you have a key to any Cecil Pines building, please call the office and let us know which key you have.
                          </p>
                        </div>

                        <div>
                          <p className="font-bold text-blue-900 text-[13px]">
                            • National POW/MIA Recognition Day (Saturday, Sept. 19)
                          </p>
                          <p className="leading-relaxed">
                            The National POW/MIA Memorial & Museum invites Cecil Pines residents on <strong>Saturday, Sept. 19 from 11am to 4:30pm</strong> for ceremony, military exhibits, live entertainment, and food.
                          </p>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                          <p className="font-bold text-stone-800 text-[11px]">
                            Updated Cecil Field Race Dates:
                          </p>
                          <p className="text-[10px] text-stone-600 leading-tight mt-0.5">
                            Sept 4 (UNF 3-7pm) • Oct 16 (3-7pm) & Oct 17 (6-11am) • Oct 22 (Gateway) • Nov 6 & Nov 13 (FHSAA championships).
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Continuum of Care Panel Discussion */}
                    <div className="bg-gradient-to-br from-sky-50 to-blue-50/70 p-4 sm:p-5 rounded-2xl border-2 border-sky-300/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-600 text-white px-2.5 py-0.5 rounded-full">
                          Community Health Event
                        </span>
                        <span className="text-xs font-bold text-sky-800">
                          Tuesday, Sept. 29th • 12:00 PM
                        </span>
                      </div>

                      <h3 className="text-lg sm:text-xl font-black text-sky-950 font-serif">
                        Continuum of Care Panel Discussion
                      </h3>

                      <div className="bg-white p-3 rounded-xl border border-sky-200 space-y-1">
                        <p className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                          <Utensils className="w-4 h-4 text-emerald-600" />
                          <span>Come Enjoy Lunch from Olive Garden!</span>
                        </p>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          Hear from local care and service providers (Senior Living Placement, Castle Home Health, Vivo Healthcare, Gentiva Hospice, North Florida Rehab Hospital, Live 2 B Healthy Senior Fitness) with Q&A assistance.
                        </p>
                      </div>

                      <p className="text-xs font-bold text-rose-700 text-center bg-rose-50 py-1.5 rounded-lg border border-rose-200">
                        **RSVP by Friday, Sept. 25th**
                      </p>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 3 ================= */}
                {currentPage === 3 && (
                  <div className="p-4 sm:p-6 space-y-4 flex-1">
                    {/* Make Your Own Sundae */}
                    <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 p-4 sm:p-5 rounded-2xl border-2 border-pink-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold bg-pink-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                          Sweet Social
                        </span>
                        <span className="text-xs font-bold text-pink-900">
                          Friday, Sept. 18th • 2:30 PM
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-pink-950 font-serif">
                        MAKE YOUR OWN SUNDAE! 🍨
                      </h3>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        Build your perfect ice cream sundae! Cool off and spend time with neighbors. Choose your ice cream and pile on sprinkles, syrups, whipped cream, cherries & more!
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px] font-bold text-stone-600">
                        <span>Hosted By: Alivia Home Health & Community Hospice</span>
                        <span className="text-rose-700">**RSVP By 9/14**</span>
                      </div>
                    </div>

                    {/* Birthdays & Anniversaries */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Happy Birthday */}
                      <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-sm">
                          <Cake className="w-4 h-4 text-amber-700" />
                          <span>Happy Birthday (September)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs text-stone-800">
                          <p><strong>9/01</strong> Audrey E.</p>
                          <p><strong>9/06</strong> Kathleen M.</p>
                          <p><strong>9/14</strong> Les P.</p>
                          <p><strong>9/17</strong> Dan B.</p>
                          <p><strong>9/19</strong> Gina K.</p>
                          <p><strong>9/20</strong> Nancy A.</p>
                          <p><strong>9/22</strong> McArthur H.</p>
                          <p><strong>9/22</strong> Joseph P.</p>
                          <p><strong>9/24</strong> Jack J.</p>
                          <p><strong>9/28</strong> Brady W.</p>
                        </div>
                      </div>

                      {/* Happy Anniversary */}
                      <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200 space-y-2">
                        <div className="flex items-center gap-1.5 text-rose-900 font-bold text-sm">
                          <Heart className="w-4 h-4 text-rose-600" />
                          <span>Happy Anniversary</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-stone-800">
                          <p><strong>9/02</strong> Dan & Ina B.</p>
                          <p><strong>9/07</strong> William & D.</p>
                          <p><strong>9/10</strong> Patrick & Christine S.</p>
                          <p><strong>9/25</strong> Bryan & Susan S.</p>
                        </div>
                      </div>
                    </div>

                    {/* New Neighbors & Loyalty Clubs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs">
                        <p className="font-bold text-emerald-900 flex items-center gap-1">
                          <Home className="w-3.5 h-3.5 text-emerald-700" />
                          <span>New Neighbors</span>
                        </p>
                        <p className="text-[11px] text-stone-700 mt-1">
                          • <strong>Lynne P.</strong> (Pine Links St.)<br/>
                          • <strong>David & Marjorie V.</strong> (Pine Straw Ln.)
                        </p>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-center">
                        <p className="font-bold text-stone-900">10 Year Club</p>
                        <p className="text-emerald-800 font-extrabold text-sm mt-1">Donna S.</p>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-center">
                        <p className="font-bold text-stone-900">15 Year Club</p>
                        <p className="text-emerald-800 font-extrabold text-sm mt-1">Herb & Gretta E.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 4 ================= */}
                {currentPage === 4 && (
                  <div className="p-4 sm:p-6 space-y-4 flex-1">
                    <div className="border-b border-stone-200 pb-2 flex items-center justify-between">
                      <h2 className="text-lg sm:text-xl font-black font-serif text-stone-900 flex items-center gap-2">
                        <span>🐾 Pet Gallery — Contestants #1 to #12</span>
                      </h2>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Vote for Cutest Pet!
                      </span>
                    </div>

                    {/* Pet Cards Grid 1-12 */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { num: 1, type: 'cat', name: 'Tabby Oliver' },
                        { num: 2, type: 'cat', name: 'Ginger Marmalade' },
                        { num: 3, type: 'cat', name: 'Tuxedo Oreo' },
                        { num: 4, type: 'cat', name: 'Luna Bell' },
                        { num: 5, type: 'cat', name: 'Shadow Mittens' },
                        { num: 6, type: 'cat', name: 'Spa Day Morris' },
                        { num: 7, type: 'dog', name: 'Scruffy Charlie' },
                        { num: 8, type: 'cat', name: 'Siamese Cleo' },
                        { num: 9, type: 'cat', name: 'Smokey Fluff' },
                        { num: 10, type: 'cat', name: 'Whiskers Winston' },
                        { num: 11, type: 'cat', name: 'Midnight Bear' },
                        { num: 12, type: 'dog', name: 'Ranger in Red' },
                      ].map(pet => (
                        <div key={pet.num} className="bg-stone-50 hover:bg-emerald-50/50 p-2 rounded-xl border border-stone-200 transition">
                          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold mb-1 shadow-2xs">
                            {pet.type === 'dog' ? <Dog className="w-5 h-5" /> : <Cat className="w-5 h-5" />}
                          </div>
                          <span className="inline-block bg-emerald-700 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                            #{pet.num}
                          </span>
                          <p className="text-[10px] font-semibold text-stone-700 truncate mt-0.5">{pet.name}</p>
                        </div>
                      ))}
                    </div>

                    {/* Birthday Party Recap & Health Talk */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#faf8f2] p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                        <p className="font-bold text-stone-900">🎂 Community Birthday Party!</p>
                        <p className="text-stone-600 text-[11px] leading-relaxed">
                          Over 30 residents joined us for the fun! This party is always a huge hit—thank you to all who celebrated!
                        </p>
                      </div>

                      <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 text-xs space-y-1">
                        <p className="font-bold text-sky-950">🩺 Medicare, Dizziness & Balance Talk</p>
                        <p className="text-sky-900 text-[11px]">
                          <strong>Friday, Sept. 4th at 10am</strong> • Navigating Medicare (Natalie Healthcare) & Balance (Enhabit). Light refreshments! *RSVP By 9/3*
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 5 ================= */}
                {currentPage === 5 && (
                  <div className="p-4 sm:p-6 space-y-4 flex-1">
                    {/* Cayla's Note */}
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-1.5">
                      <h3 className="font-bold font-serif text-amber-950 text-sm sm:text-base">
                        Hey, It's Cayla! Your friend at the front desk 💛
                      </h3>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        Well, we survived the back-to-school craziness and are finally getting back into our routine! School traffic, drop-offs, snacks, and planning for the week. And now we're adding track into the mix with two of mine racing this year!
                      </p>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        Hopefully September brings us some cooler weather. And before I go, the JEA water testing results are in, and thankfully the water is safe! See you soon... don't forget to drink your water!
                      </p>
                    </div>

                    {/* Thank You & Library */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs space-y-1">
                        <p className="font-bold text-emerald-950">📚 Cecil Pines Gets an A+!</p>
                        <p className="text-[11px] text-stone-600 leading-relaxed">
                          "A huge THANK YOU to all residents who donated school supplies for my classroom! Your kindness started our year stocked up and ready!" — <em>Mrs. Michaels</em>
                        </p>
                      </div>

                      <div className="bg-stone-100/80 p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                        <p className="font-bold text-stone-900">📖 The Library is Almost Ready!</p>
                        <p className="text-[11px] text-stone-600 leading-relaxed">
                          We appreciate your patience while finishing touches are completed. Reopening announcement coming soon!
                        </p>
                      </div>
                    </div>

                    {/* Pet Gallery 13-19 & Voting Instructions */}
                    <div className="bg-teal-50/60 p-3.5 rounded-2xl border border-teal-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-teal-950">Pet Gallery Entries #13 to #19</h4>
                        <span className="text-[10px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200">
                          Free Voting
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
                        {[
                          { num: 13, name: 'Snowball' },
                          { num: 14, name: 'Buddy' },
                          { num: 15, name: 'Rusty' },
                          { num: 16, name: 'Milo' },
                          { num: 17, name: 'Daisy' },
                          { num: 18, name: 'Professor Paws' },
                          { num: 19, name: 'Sunny' },
                        ].map(pet => (
                          <div key={pet.num} className="bg-white p-1.5 rounded-lg border border-teal-200">
                            <span className="bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              #{pet.num}
                            </span>
                            <p className="text-[9px] font-medium text-stone-700 truncate mt-0.5">{pet.name}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-stone-600 pt-1">
                        ☎️ <strong>Cast your vote:</strong> Call the office with your favorite entry number by <strong>Monday, Sept. 28th</strong>! Donations support <em>EveryPet</em>. Winner announced in October Breeze!
                      </p>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 6 ================= */}
                {currentPage === 6 && (
                  <div className="p-4 sm:p-6 space-y-4 flex-1">
                    {/* Wii Bowling Results */}
                    <div className="bg-gradient-to-r from-emerald-50 to-stone-50 p-4 rounded-2xl border-2 border-emerald-300 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider bg-emerald-700 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Wii Bowling Summer League Results</span>
                        </span>
                        <span className="text-[11px] text-stone-500 font-semibold">Final Standings</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200 space-y-1">
                          <p className="font-bold text-emerald-900 text-xs">🥇 1st: "What the Heck" (19-12)</p>
                          <p className="text-[11px] text-stone-600">Gene Skidmore, Christine Smith, Linda Jowers, Bob Pavek</p>
                          <p className="font-bold text-stone-800 text-xs pt-1">🥈 2nd: "Two 'N Two" (17-15)</p>
                          <p className="text-[11px] text-stone-600">Eloise Beyerle, Nancy Dickerson, Mike Smith, Billy Dickerson</p>
                          <p className="font-bold text-stone-800 text-xs pt-1">🥉 3rd: "Gutter Sweepers" (16-15)</p>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-[11px]">
                          <p className="font-bold text-amber-900">🌟 Individual Honors:</p>
                          <p>• High Series: Gene Skidmore (826) & Veronica Thomas (868)</p>
                          <p>• High Game 300: Billy Dickerson, Glenn Sikes, Kathy Abdell</p>
                          <p>• Most Improved: Mike Smith (+14), Christine Smith (+2)</p>
                          <p className="text-[10px] text-stone-500 italic pt-1">
                            Interested? Contact Dan Jowers, Gerry Sweeten, or Linda Sweeten!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Community Activities & Potlucks */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-stone-800">
                      <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                        <p className="font-bold text-amber-950 flex items-center gap-1">
                          <Coffee className="w-3.5 h-3.5 text-amber-700" />
                          <span>Koffee Klatch</span>
                        </p>
                        <p className="text-[11px] text-stone-600 mt-0.5">Thursdays 7:30–9:30am</p>
                      </div>

                      <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200">
                        <p className="font-bold text-rose-950 flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-rose-700" />
                          <span>Lunch Bunch</span>
                        </p>
                        <p className="text-[11px] text-stone-600 mt-0.5">Sept 11, 12pm (Green Papaya)</p>
                      </div>

                      <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                        <p className="font-bold text-emerald-950 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Total Potluck</span>
                        </p>
                        <p className="text-[11px] text-stone-600 mt-0.5">Sept 15, 5pm ($5 & 50/50)</p>
                      </div>

                      <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200">
                        <p className="font-bold text-purple-950">Game Night & Blackjack</p>
                        <p className="text-[11px] text-stone-600 mt-0.5">Mondays & Fridays 5pm</p>
                      </div>

                      <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200">
                        <p className="font-bold text-blue-950">Bingo</p>
                        <p className="text-[11px] text-stone-600 mt-0.5">2nd & 4th Tuesday 6pm</p>
                      </div>

                      <div className="bg-stone-100 p-2.5 rounded-xl border border-stone-200">
                        <p className="font-bold text-stone-900">Social Saturday</p>
                        <p className="text-[11px] text-stone-600 mt-0.5">Sept 26, 5:30pm (Appetizers)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Pinned Bottom Pagination Toolbar (Only shown for 6-page Breeze Reader) */}
            {!isRemoved && !isCustom && (
              <div className="bg-stone-900 border-t border-stone-800 px-4 py-3 flex items-center justify-between shrink-0">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:hover:bg-stone-800 text-stone-200 text-xs font-semibold transition cursor-pointer min-h-[38px]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        currentPage === page
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <span className="text-[11px] text-stone-400 ml-1 hidden sm:inline">
                    of {totalPages}
                  </span>
                </div>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-30 disabled:hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs cursor-pointer min-h-[38px]"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

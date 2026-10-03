import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  CommunityRsvpEvent,
  PinnedHighlight,
  NewsletterConfig,
  NewsletterAiExtractionResult,
  UserProfile,
  RsvpAttendee,
} from '../types';
import {
  DEFAULT_NEWSLETTER_CONFIG,
  createInitialRsvpEvents,
  createInitialHighlights,
} from '../data/rsvpEvents';
import {
  saveRsvpEventsToFirestore,
  savePinnedHighlightsToFirestore,
  saveNewsletterConfigToFirestore,
  getNewsletterConfigFromFirestore,
  getCommunityEventsFromFirestore,
  getCommunityHighlightsFromFirestore,
  deleteOldAiEventsFromFirestore,
  deleteOldAiHighlightsFromFirestore,
  deleteRsvpEventFromFirestore,
  deletePinnedHighlightFromFirestore,
  getNewsletterPdfFromFirestore,
} from '../services/firestoreSync';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { removeNewsletterPdfFromFirestore, removeNewsletterEditionFiles } from '../services/storage';
import {
  clearAllNewsletterPdfStorage,
  removePdfFromStorage,
  getPdfFromStorage,
  saveNewsletterConfigToStorage,
  getNewsletterConfigFromStorage,
  deleteNewsletterConfigFromStorage,
} from '../utils/pdfStorage';
import {
  extractNewsletter,
  formatGeminiError,
  parseRobustMonthAndDay,
} from '../services/geminiNewsletter';

const STORAGE_EVENTS_KEY = 'portal_rsvp_events_list';
const STORAGE_HIGHLIGHTS_KEY = 'portal_pinned_highlights_list';
const STORAGE_NEWSLETTER_KEY = 'portal_newsletter_config';

export interface NewsState {
  rsvpToast: string | null;
  setRsvpToast: React.Dispatch<React.SetStateAction<string | null>>;
  newsletterConfig: NewsletterConfig | null;
  setNewsletterConfig: React.Dispatch<React.SetStateAction<NewsletterConfig | null>>;
  isPdfModalOpen: boolean;
  setIsPdfModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isUploadNewsletterModalOpen: boolean;
  setIsUploadNewsletterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveNewsletterConfig: (config: NewsletterConfig) => Promise<void> | void;
  handleRemoveNewsletter: () => Promise<void> | void;
  handleRestoreDefaultNewsletter: () => Promise<void> | void;
  newsSubView: 'all' | 'events' | 'gazette' | 'highlights';
  setNewsSubView: React.Dispatch<React.SetStateAction<'all' | 'events' | 'gazette' | 'highlights'>>;
  rsvpEvents: CommunityRsvpEvent[];
  setRsvpEvents: React.Dispatch<React.SetStateAction<CommunityRsvpEvent[]>>;
  handleToggleRsvp: (eventId: number | string, user?: UserProfile | null) => void;
  handleAddRsvpEvent: (event: Omit<CommunityRsvpEvent, 'id' | 'attendeesCount' | 'userRsvp'>) => void;
  handleUpdateRsvpEvent: (event: CommunityRsvpEvent) => void;
  handleDeleteRsvpEvent: (eventId: number | string, eventTitle?: string) => void;
  handleDeleteRsvpAttendee: (eventId: number | string, attendeeId: string, attendeeName?: string) => void;
  isAddEventModalOpen: boolean;
  setIsAddEventModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingRsvpEvent: CommunityRsvpEvent | null;
  setEditingRsvpEvent: React.Dispatch<React.SetStateAction<CommunityRsvpEvent | null>>;
  handleOpenAddEventModal: () => void;
  handleOpenEditEventModal: (event: CommunityRsvpEvent) => void;
  pinnedHighlights: PinnedHighlight[];
  setPinnedHighlights: React.Dispatch<React.SetStateAction<PinnedHighlight[]>>;
  handleAddHighlight: (highlight: Omit<PinnedHighlight, 'id'>) => void;
  handleDeleteHighlight: (id: string, title?: string) => void;
  isAddHighlightModalOpen: boolean;
  setIsAddHighlightModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleApplyAiExtraction: (
    extracted: NewsletterAiExtractionResult,
    editionContext?: { id?: string; monthEdition?: string; editionTitle?: string }
  ) => void;
  isReanalyzingAi: boolean;
  handleReanalyzeNewsletter: () => Promise<void>;
}

export function useNewsState(currentUser?: UserProfile | null): NewsState {
  const [rsvpToast, setRsvpToast] = useState<string | null>(null);

  const [newsletterConfig, setNewsletterConfig] = useState<NewsletterConfig | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_NEWSLETTER_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse cached newsletter config:', e);
    }
    return DEFAULT_NEWSLETTER_CONFIG;
  });

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isUploadNewsletterModalOpen, setIsUploadNewsletterModalOpen] = useState(false);
  const [newsSubView, setNewsSubView] = useState<'all' | 'events' | 'gazette' | 'highlights'>('events');

  const [rsvpEvents, setRsvpEvents] = useState<CommunityRsvpEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EVENTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse cached events:', e);
    }
    return createInitialRsvpEvents();
  });

  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [editingRsvpEvent, setEditingRsvpEvent] = useState<CommunityRsvpEvent | null>(null);

  const [pinnedHighlights, setPinnedHighlights] = useState<PinnedHighlight[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HIGHLIGHTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse cached highlights:', e);
    }
    return createInitialHighlights();
  });

  const [isAddHighlightModalOpen, setIsAddHighlightModalOpen] = useState(false);
  const [isReanalyzingAi, setIsReanalyzingAi] = useState(false);

  useEffect(() => {
    if (!db || !currentUser) return;
    return onSnapshot(doc(db, 'newsletters', 'current'), (snapshot) => {
      if (snapshot.metadata.fromCache || !snapshot.exists()) return;
      const config = snapshot.data() as NewsletterConfig;
      setNewsletterConfig(config);
      if (config.isRemoved) {
        setIsPdfModalOpen(false);
        void clearAllNewsletterPdfStorage();
        navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PDF_CACHE' });
      }
    });
  }, [currentUser?.id]);

  // Auto-dismiss rsvpToast
  useEffect(() => {
    if (!rsvpToast) return;
    const timer = setTimeout(() => {
      setRsvpToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [rsvpToast]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(rsvpEvents));
    } catch (e) {
      console.warn('Failed to persist events:', e);
    }
  }, [rsvpEvents]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HIGHLIGHTS_KEY, JSON.stringify(pinnedHighlights));
    } catch (e) {
      console.warn('Failed to persist highlights:', e);
    }
  }, [pinnedHighlights]);

  useEffect(() => {
    try {
      if (newsletterConfig) {
        // Keep localStorage safe from multi-megabyte data URLs to prevent QuotaExceededError
        const storageSafeConfig: NewsletterConfig = {
          ...newsletterConfig,
          pdfUrl: newsletterConfig.pdfUrl?.startsWith('data:')
            ? 'indexeddb:current_newsletter_pdf'
            : newsletterConfig.pdfUrl,
          fileUrl: newsletterConfig.fileUrl?.startsWith('data:')
            ? 'indexeddb:current_newsletter_pdf'
            : newsletterConfig.fileUrl,
        };
        localStorage.setItem(STORAGE_NEWSLETTER_KEY, JSON.stringify(storageSafeConfig));
      }
    } catch (e) {
      console.warn('Failed to persist newsletter config to localStorage:', e);
    }
  }, [newsletterConfig]);

  // Robust multi-tier loader: Server Filesystem -> Firestore -> IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function loadPersistedNewsletter() {
      let resolvedConfig: NewsletterConfig | null = null;

      // 1. Check Server Filesystem (authoritative persistent storage)
      try {
        const serverResp = await fetch('/api/newsletter/current');
        if (serverResp.ok && serverResp.headers.get('content-type')?.includes('application/json')) {
          const serverData = await serverResp.json();
          if (serverData.exists && serverData.config && isMounted) {
            resolvedConfig = serverData.config;
            setNewsletterConfig(serverData.config);
          }
        }
      } catch (e) {
        // Offline or static hosting without Node server
      }

      // 2. Check Firestore if not yet found from server
      {
        try {
          const firestoreCfg = await getNewsletterConfigFromFirestore();
          if (firestoreCfg && isMounted) {
            resolvedConfig = firestoreCfg;
            setNewsletterConfig((prev) => {
              if (firestoreCfg.isRemoved || !prev || !prev.isCustomUpload || (firestoreCfg.uploadedAt || 0) >= (prev.uploadedAt || 0)) {
                return firestoreCfg;
              }
              return prev;
            });
          }
        } catch (e) {
          console.warn('Firestore newsletter fetch notice:', e);
        }
      }

      // 3. Check IndexedDB if still not resolved
      if (!resolvedConfig) {
        try {
          const idbCfg = await getNewsletterConfigFromStorage();
          if (idbCfg && isMounted) {
            resolvedConfig = idbCfg;
            setNewsletterConfig((prev) => {
              if (!prev || !prev.isCustomUpload || (idbCfg.uploadedAt || 0) >= (prev.uploadedAt || 0)) {
                return idbCfg;
              }
              return prev;
            });
          }
        } catch (e) {
          console.warn('IndexedDB newsletter fetch notice:', e);
        }
      }

      const activeId = resolvedConfig?.id || newsletterConfig?.id;

      // 4. Query Firestore for community RSVP events (ALWAYS runs, no early abort!)
      try {
        const firestoreEvents = await getCommunityEventsFromFirestore(activeId);
        if (firestoreEvents && firestoreEvents.length > 0 && isMounted) {
          console.log(
            `[Newsletter State] Loaded ${firestoreEvents.length} community RSVP events from Firestore for newsletter: ${activeId || 'all'}`
          );
          setRsvpEvents(firestoreEvents);
        }
      } catch (e) {
        console.warn('[Newsletter State] Notice loading events from Firestore:', e);
      }

      // 5. Query Firestore for pinned highlights (ALWAYS runs, no early abort!)
      try {
        const firestoreHighlights = await getCommunityHighlightsFromFirestore(activeId);
        if (firestoreHighlights && firestoreHighlights.length > 0 && isMounted) {
          console.log(
            `[Newsletter State] Loaded ${firestoreHighlights.length} pinned highlights from Firestore for newsletter: ${activeId || 'all'}`
          );
          setPinnedHighlights(firestoreHighlights);
        }
      } catch (e) {
        console.warn('[Newsletter State] Notice loading highlights from Firestore:', e);
      }
    }

    loadPersistedNewsletter();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveNewsletterConfig = useCallback(async (config: NewsletterConfig) => {
    setNewsletterConfig(config);
    setIsUploadNewsletterModalOpen(false);
    await saveNewsletterConfigToFirestore(config).catch(() => {});
    await saveNewsletterConfigToStorage(config).catch(() => {});
  }, []);

  const handleRemoveNewsletter = useCallback(async () => {
    const cleanConfig: NewsletterConfig = {
      id: newsletterConfig?.id || 'current_newsletter',
      editionTitle: 'Community Newsletter',
      monthEdition: '',
      description: 'The community newsletter was removed. Admins may upload a new edition at any time.',
      pdfUrl: '',
      fileUrl: '',
      fileName: '',
      fileType: 'application/pdf',
      fileSize: undefined,
      pageImages: [],
      isCustomUpload: false,
      isRemoved: true,
      uploadedAt: Date.now(),
    };

    setNewsletterConfig(cleanConfig);
    setIsPdfModalOpen(false);
    setIsUploadNewsletterModalOpen(false);

    // 1. Clean localStorage
    try {
      localStorage.setItem(STORAGE_NEWSLETTER_KEY, JSON.stringify(cleanConfig));
    } catch (e) {
      console.warn('Failed to update localStorage on newsletter remove:', e);
    }

    // 2. Clean IndexedDB
    try {
      await clearAllNewsletterPdfStorage();
      await removePdfFromStorage('current_newsletter_pdf');
      await deleteNewsletterConfigFromStorage();
    } catch (e) {
      console.warn('Failed to clean IndexedDB on newsletter remove:', e);
    }

    // 3. Clean Server Storage
    try {
      const removal = await fetch('/api/newsletter/current', {
        method: 'DELETE', headers: { Authorization: `Bearer ${await auth?.currentUser?.getIdToken() || ''}` },
      });
      if (!removal.ok) throw new Error('Server newsletter removal failed.');
    } catch (e) {
      setRsvpToast('Newsletter removal could not be completed on the server. Please try again.');
      return;
    }

    // 4. Clean Firestore document & chunked storage
    try {
      const removed = await saveNewsletterConfigToFirestore(cleanConfig);
      if (!removed) throw new Error('Unable to save the removal to Firebase.');
      await removeNewsletterEditionFiles(newsletterConfig?.id || '');
      await removeNewsletterPdfFromFirestore('current');
    } catch (e) {
      setRsvpToast('Newsletter removal could not be completed in Firebase. Please try again.');
      return;
    }

    // 5. Invalidate Service Worker dedicated PDF cache
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PDF_CACHE' });
      }
    } catch (e) {
      console.warn('Service worker cache message error:', e);
    }

    setRsvpToast('Newsletter PDF has been removed.');
  }, [newsletterConfig]);

  const handleRestoreDefaultNewsletter = useCallback(async () => {
    const restored: NewsletterConfig = {
      ...DEFAULT_NEWSLETTER_CONFIG,
      isRemoved: false,
      isCustomUpload: false,
    };

    setNewsletterConfig(restored);

    try {
      localStorage.setItem(STORAGE_NEWSLETTER_KEY, JSON.stringify(restored));
    } catch (e) {
      console.warn('Failed to persist restored config:', e);
    }

    try {
      await clearAllNewsletterPdfStorage();
      await removePdfFromStorage('current_newsletter_pdf');
      await deleteNewsletterConfigFromStorage();
      const removal = await fetch('/api/newsletter/current', {
        method: 'DELETE', headers: { Authorization: `Bearer ${await auth?.currentUser?.getIdToken() || ''}` },
      });
      if (!removal.ok) throw new Error('Server newsletter removal failed.');
    } catch (e) {
      console.warn('Failed to clean IndexedDB and server on restore:', e);
    }

    try {
      await saveNewsletterConfigToFirestore(restored);
      await removeNewsletterPdfFromFirestore('current');
    } catch (e) {
      console.warn('Failed to sync restored newsletter to Firestore:', e);
    }

    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PDF_CACHE' });
      }
    } catch (e) {
      console.warn('Service worker cache message error:', e);
    }

    setRsvpToast('Restored default September 2026 edition.');
  }, []);

  const handleToggleRsvp = useCallback(
    (eventId: number | string, user?: UserProfile | null) => {
      const effectiveUser = user || currentUser;
      setRsvpEvents((prev) => {
        const updated = prev.map((ev) => {
          if (String(ev.id) === String(eventId)) {
            const nextRsvp = !ev.userRsvp;
            let attendees = [...(ev.attendees || [])];

            if (nextRsvp) {
              const newAttendee: RsvpAttendee = {
                id: String(effectiveUser?.id || `res-${Date.now()}`),
                userId: effectiveUser?.id ? String(effectiveUser.id) : undefined,
                name: effectiveUser?.name || 'Resident',
                unit: effectiveUser?.unit || effectiveUser?.address || 'Cecil Pines Community',
                email: effectiveUser?.email,
                avatar: effectiveUser?.avatar,
                role: effectiveUser?.role,
                rsvpdAt: Date.now(),
              };
              if (
                !attendees.some(
                  (a) =>
                    a.id === newAttendee.id ||
                    (effectiveUser?.id && a.userId === String(effectiveUser.id))
                )
              ) {
                attendees.unshift(newAttendee);
              }
            } else {
              attendees = attendees.filter(
                (a) =>
                  a.id !== String(effectiveUser?.id) &&
                  a.userId !== String(effectiveUser?.id) &&
                  a.name !== effectiveUser?.name
              );
            }

            const nextCount = attendees.length;
            const nextSpots =
              ev.spotsLeft !== undefined
                ? nextRsvp
                  ? Math.max(0, ev.spotsLeft - 1)
                  : ev.spotsLeft + 1
                : undefined;

            setRsvpToast(
              nextRsvp
                ? `RSVP Confirmed for "${ev.title}"! Added to your schedule.`
                : `RSVP Cancelled for "${ev.title}".`
            );

            return {
              ...ev,
              userRsvp: nextRsvp,
              attendees,
              attendeesCount: nextCount,
              spotsLeft: nextSpots,
            };
          }
          return ev;
        });

        saveRsvpEventsToFirestore(updated).catch(() => {});
        return updated;
      });
    },
    [currentUser]
  );

  const handleDeleteRsvpAttendee = useCallback(
    (eventId: number | string, attendeeId: string, attendeeName?: string) => {
      let eventTitle = '';
      setRsvpEvents((prev) => {
        const updated = prev.map((ev) => {
          if (String(ev.id) === String(eventId)) {
            eventTitle = ev.title;
            const attendees = (ev.attendees || []).filter(
              (a) =>
                String(a.id) !== String(attendeeId) &&
                String(a.userId) !== String(attendeeId)
            );
            const nextCount = attendees.length;
            const nextSpots =
              ev.spotsLeft !== undefined ? ev.spotsLeft + 1 : undefined;

            const wasCurrentUser =
              currentUser?.id &&
              (String(attendeeId) === String(currentUser.id) ||
                (ev.attendees || []).some(
                  (a) =>
                    String(a.id) === String(attendeeId) &&
                    String(a.userId) === String(currentUser.id)
                ));

            return {
              ...ev,
              attendees,
              attendeesCount: nextCount,
              spotsLeft: nextSpots,
              userRsvp: wasCurrentUser ? false : ev.userRsvp,
            };
          }
          return ev;
        });

        saveRsvpEventsToFirestore(updated).catch(() => {});
        return updated;
      });

      setRsvpToast(
        `✓ Removed ${attendeeName || 'attendee'} from "${eventTitle || 'event'}" RSVP list.`
      );
    },
    [currentUser?.id]
  );

  const handleAddRsvpEvent = useCallback(
    (eventData: Omit<CommunityRsvpEvent, 'id' | 'attendeesCount' | 'userRsvp'>) => {
      const newEvent: CommunityRsvpEvent = {
        ...eventData,
        id: `ev-${Date.now()}`,
        attendeesCount: 0,
        userRsvp: false,
      };

      setRsvpEvents((prev) => [newEvent, ...prev]);
      setIsAddEventModalOpen(false);
      saveRsvpEventsToFirestore([newEvent]);
    },
    []
  );

  const handleUpdateRsvpEvent = useCallback((updated: CommunityRsvpEvent) => {
    setRsvpEvents((prev) =>
      prev.map((ev) => (String(ev.id) === String(updated.id) ? updated : ev))
    );
    setEditingRsvpEvent(null);
    setIsAddEventModalOpen(false);
    saveRsvpEventsToFirestore([updated]);
  }, []);

  const handleDeleteRsvpEvent = useCallback((eventId: number | string, _eventTitle?: string) => {
    setRsvpEvents((prev) => prev.filter((ev) => String(ev.id) !== String(eventId)));
    deleteRsvpEventFromFirestore(eventId);
  }, []);

  const handleOpenAddEventModal = useCallback(() => {
    setEditingRsvpEvent(null);
    setIsAddEventModalOpen(true);
  }, []);

  const handleOpenEditEventModal = useCallback((event: CommunityRsvpEvent) => {
    setEditingRsvpEvent(event);
    setIsAddEventModalOpen(true);
  }, []);

  const handleAddHighlight = useCallback((data: Omit<PinnedHighlight, 'id'>) => {
    const newHighlight: PinnedHighlight = {
      ...data,
      id: `hl-${Date.now()}`,
      createdAt: Date.now(),
    };
    setPinnedHighlights((prev) => [newHighlight, ...prev]);
    setIsAddHighlightModalOpen(false);
    savePinnedHighlightsToFirestore([newHighlight]);
  }, []);

  const handleDeleteHighlight = useCallback((id: string, _title?: string) => {
    setPinnedHighlights((prev) => prev.filter((h) => h.id !== id));
    deletePinnedHighlightFromFirestore(id);
  }, []);

  const handleApplyAiExtraction = useCallback(
    (
      extracted: NewsletterAiExtractionResult,
      editionContext?: { id?: string; monthEdition?: string; editionTitle?: string }
    ) => {
      const currentId = editionContext?.id || newsletterConfig?.id || `newsletter-${Date.now()}`;
      const currentMonth = editionContext?.monthEdition || newsletterConfig?.monthEdition || '';
      const currentTitle = editionContext?.editionTitle || newsletterConfig?.editionTitle || 'New Edition';

      console.log(
        `[Newsletter Pipeline] Step 4a: Applying AI extraction in useNewsState for "${currentTitle}" (${currentMonth}), ID: ${currentId}`
      );

      const candidateEvents = extracted.rsvp_events || [];

      if (Array.isArray(extracted.rsvp_events)) {
        const timestamp = Date.now();
        const fallbackM = '';

        const newEvents: CommunityRsvpEvent[] = candidateEvents.map((e, idx) => {
          const { month, day } = parseRobustMonthAndDay(
            '',
            e.day,
            e.month,
            undefined,
            fallbackM
          );

          return {
            id: `ai-ev-${currentId}-${timestamp}-${idx}`,
            title: e.title,
            month: month || String(e.month || fallbackM).toUpperCase().slice(0, 3),
            day: day || '',
            time: e.time,
            location: e.location,
            category: e.category || 'Special Event',
            attendeesCount: 0,
            userRsvp: false,
            deadline: e.deadline,
            description: e.description,
            capacity: e.capacity,
            spotsLeft: e.capacity ?? undefined,
            isAiExtracted: true,
            newsletterId: currentId,
            editionMonth: currentMonth,
            createdAt: timestamp,
          };
        });

        setRsvpEvents((prev) => {
          // Retain manual resident-created events, but replace prior auto-extracted events with the new edition's events
          const customManualEvents = prev.filter((ev) => !ev.isAiExtracted);
          const merged = [...newEvents, ...customManualEvents];

          console.log(
            `[Newsletter Pipeline] Step 5: Synced ${merged.length} events (${newEvents.length} fresh AI events) to state & Firestore`
          );
          saveRsvpEventsToFirestore(merged);
          deleteOldAiEventsFromFirestore(currentId);
          try {
            localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(merged));
          } catch (e) {
            console.warn('Failed to update local storage events:', e);
          }
          return merged;
        });
      }

      if (Array.isArray(extracted.pinned_highlights)) {
        const timestamp = Date.now();
        const newHighlights: PinnedHighlight[] = extracted.pinned_highlights.map((h, idx) => ({
          id: `ai-hl-${currentId}-${timestamp}-${idx}`,
          title: h.title,
          category: h.tag || 'Community Notice',
          authorLabel: 'Extracted with Gemini AI',
          description: h.summary,
          date: h.date || currentMonth || 'Current Edition',
          tag: h.tag,
          summary: h.summary,
          isAiExtracted: true,
          newsletterId: currentId,
          editionMonth: currentMonth,
          createdAt: timestamp,
        }));

        setPinnedHighlights((prev) => {
          const customManualHighlights = prev.filter((h) => !h.isAiExtracted);
          const merged = [...newHighlights, ...customManualHighlights];

          console.log(
            `[Newsletter Pipeline] Step 5b: Synced ${merged.length} highlights (${newHighlights.length} fresh AI highlights) to state & Firestore`
          );
          savePinnedHighlightsToFirestore(merged);
          deleteOldAiHighlightsFromFirestore(currentId);
          try {
            localStorage.setItem(STORAGE_HIGHLIGHTS_KEY, JSON.stringify(merged));
          } catch (e) {
            console.warn('Failed to update local storage highlights:', e);
          }
          return merged;
        });
      }

      setNewsletterConfig((prev) => {
        const updated: NewsletterConfig = {
          ...(prev || DEFAULT_NEWSLETTER_CONFIG),
          id: currentId,
          editionTitle: currentTitle,
          monthEdition: currentMonth,
          lastExtractedAt: Date.now(),
        };
        saveNewsletterConfigToFirestore(updated);
        return updated;
      });

      setNewsSubView('events');

      setRsvpToast(
        `✨ AI Extraction Complete: Extracted ${extracted.rsvp_events?.length || 0} RSVP events & ${extracted.pinned_highlights?.length || 0} community highlights for ${currentTitle}!`
      );
    },
    [newsletterConfig]
  );

  const handleReanalyzeNewsletter = useCallback(async () => {
    if (isReanalyzingAi) return;
    setIsReanalyzingAi(true);
    setRsvpToast('🔍 Gemini AI is scanning every page & sidebar to detect all RSVP events and sign-ups...');

    try {
      const currentDoc = newsletterConfig;
      let effectivePdfUrl = currentDoc?.pdfUrl || currentDoc?.fileUrl || '';

      let cleanBase64 = '';
      let mimeType = currentDoc?.fileType || 'application/pdf';

      // Tier 1: Direct base64 string in config
      if (effectivePdfUrl && effectivePdfUrl.includes('base64,')) {
        cleanBase64 = effectivePdfUrl.split('base64,')[1] || '';
        const detectedMime = effectivePdfUrl.substring(
          effectivePdfUrl.indexOf(':') + 1,
          effectivePdfUrl.indexOf(';')
        );
        if (detectedMime) mimeType = detectedMime;
      }

      // Tier 2: Fetch from URL (relative /api/... or absolute http/https or blob:)
      if (
        !cleanBase64 &&
        effectivePdfUrl &&
        (effectivePdfUrl.startsWith('/') ||
          effectivePdfUrl.startsWith('http://') ||
          effectivePdfUrl.startsWith('https://') ||
          effectivePdfUrl.startsWith('blob:'))
      ) {
        try {
          const resp = await fetch(effectivePdfUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            if (blob.size > 200) {
              if (blob.type) mimeType = blob.type;
              const reader = new FileReader();
              cleanBase64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                  const res = reader.result as string;
                  resolve(res.includes('base64,') ? res.split('base64,')[1] : res);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            }
          }
        } catch (fetchErr) {
          console.warn('Could not fetch PDF from URL:', fetchErr);
        }
      }

      // Tier 3: Check IndexedDB 'current_newsletter_pdf'
      if (!cleanBase64) {
        try {
          const stored = await getPdfFromStorage('current_newsletter_pdf');
          if (stored && stored.includes('base64,')) {
            cleanBase64 = stored.split('base64,')[1] || '';
            const detectedMime = stored.substring(stored.indexOf(':') + 1, stored.indexOf(';'));
            if (detectedMime) mimeType = detectedMime;
          }
        } catch (e) {
          console.warn('IndexedDB read current error:', e);
        }
      }

      // Tier 4: Check IndexedDB newsletter_pdf_<id>
      if (!cleanBase64 && currentDoc?.id) {
        try {
          const stored = await getPdfFromStorage(`newsletter_pdf_${currentDoc.id}`);
          if (stored && stored.includes('base64,')) {
            cleanBase64 = stored.split('base64,')[1] || '';
            const detectedMime = stored.substring(stored.indexOf(':') + 1, stored.indexOf(';'));
            if (detectedMime) mimeType = detectedMime;
          }
        } catch (e) {
          console.warn('IndexedDB read id error:', e);
        }
      }

      // Tier 5: Check Cloud Firestore chunked storage
      if (!cleanBase64) {
        try {
          if (currentDoc?.id) {
            const firestorePdf = await getNewsletterPdfFromFirestore(currentDoc.id);
            if (firestorePdf && firestorePdf.includes('base64,')) {
              cleanBase64 = firestorePdf.split('base64,')[1] || '';
            }
          }
          if (!cleanBase64) {
            const firestorePdfCurrent = await getNewsletterPdfFromFirestore('current');
            if (firestorePdfCurrent && firestorePdfCurrent.includes('base64,')) {
              cleanBase64 = firestorePdfCurrent.split('base64,')[1] || '';
            }
          }
        } catch (fsErr) {
          console.warn('Firestore PDF chunk retrieval notice:', fsErr);
        }
      }

      // Tier 6: Check Server endpoint /api/newsletter/pdf/current_newsletter.pdf
      if (!cleanBase64) {
        try {
          const resp = await fetch('/api/newsletter/pdf/current_newsletter.pdf');
          if (resp.ok) {
            const blob = await resp.blob();
            if (blob.size > 200) {
              const reader = new FileReader();
              cleanBase64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                  const res = reader.result as string;
                  resolve(res.includes('base64,') ? res.split('base64,')[1] : res);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            }
          }
        } catch (serverErr) {
          console.warn('Server fallback PDF retrieval notice:', serverErr);
        }
      }

      // If document is not cached anywhere, seamlessly prompt the user with the upload modal
      if (!cleanBase64) {
        setIsUploadNewsletterModalOpen(true);
        setRsvpToast('Please select or upload your newsletter document to analyze with AI.');
        return;
      }

      console.log(
        `[Newsletter Pipeline] Dispatching Gemini re-analysis for ${currentDoc?.editionTitle || 'document'}`
      );

      const extractionResult = await extractNewsletter({
        base64Data: cleanBase64,
        mimeType,
        fileName: currentDoc?.fileName || 'Newsletter.pdf',
        editionTitle: currentDoc?.editionTitle || 'Community Newsletter',
        monthEditionHint: currentDoc?.monthEdition || '',
        textContent: currentDoc?.description || '',
      });

      handleApplyAiExtraction(
        {
          rsvp_events: extractionResult.rsvp_events,
          pinned_highlights: extractionResult.pinned_highlights,
        },
        {
          id: currentDoc?.id || `newsletter-${Date.now()}`,
          monthEdition: extractionResult.monthEdition,
          editionTitle: currentDoc?.editionTitle || `The Breeze: ${extractionResult.monthEdition}`,
        }
      );

      setNewsSubView('events');
    } catch (err: any) {
      console.warn('Re-analysis error notice:', err);
      const errMsg = formatGeminiError(err);
      setRsvpToast(`AI Extraction Error: ${errMsg}`);
    } finally {
      setIsReanalyzingAi(false);
    }
  }, [isReanalyzingAi, newsletterConfig, handleApplyAiExtraction]);

  return {
    rsvpToast,
    setRsvpToast,
    newsletterConfig,
    setNewsletterConfig,
    isPdfModalOpen,
    setIsPdfModalOpen,
    isUploadNewsletterModalOpen,
    setIsUploadNewsletterModalOpen,
    handleSaveNewsletterConfig,
    handleRemoveNewsletter,
    handleRestoreDefaultNewsletter,
    newsSubView,
    setNewsSubView,
    rsvpEvents,
    setRsvpEvents,
    handleToggleRsvp,
    handleAddRsvpEvent,
    handleUpdateRsvpEvent,
    handleDeleteRsvpEvent,
    handleDeleteRsvpAttendee,
    isAddEventModalOpen,
    setIsAddEventModalOpen,
    editingRsvpEvent,
    setEditingRsvpEvent,
    handleOpenAddEventModal,
    handleOpenEditEventModal,
    pinnedHighlights,
    setPinnedHighlights,
    handleAddHighlight,
    handleDeleteHighlight,
    isAddHighlightModalOpen,
    setIsAddHighlightModalOpen,
    handleApplyAiExtraction,
    isReanalyzingAi,
    handleReanalyzeNewsletter,
  };
}

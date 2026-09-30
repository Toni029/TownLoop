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
  deleteRsvpEventFromFirestore,
  deletePinnedHighlightFromFirestore,
} from '../services/firestoreSync';
import { removeNewsletterPdfFromFirestore } from '../services/storage';
import {
  clearAllNewsletterPdfStorage,
  removePdfFromStorage,
  getPdfFromStorage,
  saveNewsletterConfigToStorage,
  getNewsletterConfigFromStorage,
  deleteNewsletterConfigFromStorage,
} from '../utils/pdfStorage';

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
  handleApplyAiExtraction: (extracted: NewsletterAiExtractionResult) => void;
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
      // 1. Check Server Filesystem (authoritative persistent storage)
      try {
        const serverResp = await fetch('/api/newsletter/current');
        if (serverResp.ok) {
          const serverData = await serverResp.json();
          if (serverData.exists && serverData.config && isMounted) {
            setNewsletterConfig(serverData.config);
            return;
          }
        }
      } catch (e) {
        // Offline or server booting
      }

      // 2. Check Firestore
      try {
        const firestoreCfg = await getNewsletterConfigFromFirestore();
        if (firestoreCfg && isMounted) {
          setNewsletterConfig((prev) => {
            if (!prev || !prev.isCustomUpload || (firestoreCfg.uploadedAt || 0) >= (prev.uploadedAt || 0)) {
              return firestoreCfg;
            }
            return prev;
          });
          return;
        }
      } catch (e) {
        console.warn('Firestore newsletter fetch notice:', e);
      }

      // 3. Check IndexedDB
      try {
        const idbCfg = await getNewsletterConfigFromStorage();
        if (idbCfg && isMounted) {
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
      id: 'current_newsletter',
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
      await fetch('/api/newsletter/current', { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to clean server storage on newsletter remove:', e);
    }

    // 4. Clean Firestore document & chunked storage
    try {
      await saveNewsletterConfigToFirestore(cleanConfig);
      await removeNewsletterPdfFromFirestore('current');
    } catch (e) {
      console.warn('Failed to sync newsletter remove to Firestore:', e);
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
  }, []);

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
      await fetch('/api/newsletter/current', { method: 'DELETE' });
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

  const handleApplyAiExtraction = useCallback((extracted: NewsletterAiExtractionResult) => {
    let eventsAddedCount = 0;
    let highlightsAddedCount = 0;

    if (extracted.rsvp_events && extracted.rsvp_events.length > 0) {
      const newEvents: CommunityRsvpEvent[] = extracted.rsvp_events.map((e, idx) => ({
        id: `ai-ev-${Date.now()}-${idx}`,
        title: e.title,
        month: String(e.month || 'SEP').toUpperCase().slice(0, 3),
        day: String(e.day || '15'),
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
        createdAt: Date.now(),
      }));

      setRsvpEvents((prev) => {
        const existingMap = new Map<string, CommunityRsvpEvent>(
          prev.map((p) => [p.title.toLowerCase().trim(), p])
        );
        const merged: CommunityRsvpEvent[] = [...prev];

        for (const ne of newEvents) {
          const key = ne.title.toLowerCase().trim();
          if (existingMap.has(key)) {
            // Update existing event details while preserving user RSVP status & existing counts
            const existing = existingMap.get(key)!;
            const idx = merged.findIndex((m) => m.id === existing.id);
            if (idx >= 0) {
              merged[idx] = {
                ...existing,
                month: ne.month || existing.month,
                day: ne.day || existing.day,
                time: ne.time || existing.time,
                location: ne.location || existing.location,
                category: ne.category || existing.category,
                deadline: ne.deadline || existing.deadline,
                description: ne.description || existing.description,
                capacity: ne.capacity,
                spotsLeft: ne.capacity ?? undefined,
                isAiExtracted: true,
              };
            }
          } else {
            // New event to add
            merged.unshift(ne);
            eventsAddedCount++;
          }
        }

        saveRsvpEventsToFirestore(merged);
        return merged;
      });
    }

    if (extracted.pinned_highlights && extracted.pinned_highlights.length > 0) {
      const newHighlights: PinnedHighlight[] = extracted.pinned_highlights.map((h, idx) => ({
        id: `ai-hl-${Date.now()}-${idx}`,
        title: h.title,
        category: h.tag || 'Community Notice',
        authorLabel: 'Extracted with Gemini AI',
        description: h.summary,
        date: h.date,
        tag: h.tag,
        summary: h.summary,
        isAiExtracted: true,
        createdAt: Date.now(),
      }));

      setPinnedHighlights((prev) => {
        const existingTitles = new Set(prev.map((p) => p.title.toLowerCase().trim()));
        const merged: PinnedHighlight[] = [...prev];

        for (const nh of newHighlights) {
          const key = nh.title.toLowerCase().trim();
          if (existingTitles.has(key)) {
            const idx = merged.findIndex((m) => m.title.toLowerCase().trim() === key);
            if (idx >= 0) {
              merged[idx] = {
                ...merged[idx],
                ...nh,
              };
            }
          } else {
            merged.unshift(nh);
            highlightsAddedCount++;
          }
        }

        savePinnedHighlightsToFirestore(merged);
        return merged;
      });
    }

    setNewsletterConfig((prev) => {
      const updated = prev
        ? { ...prev, lastExtractedAt: Date.now() }
        : { ...DEFAULT_NEWSLETTER_CONFIG, lastExtractedAt: Date.now() };
      saveNewsletterConfigToFirestore(updated);
      return updated;
    });

    setRsvpToast(
      `✨ AI Extraction Complete: Extracted ${extracted.rsvp_events?.length || 0} RSVP events & ${extracted.pinned_highlights?.length || 0} community highlights!`
    );
  }, []);

  const handleReanalyzeNewsletter = useCallback(async () => {
    if (isReanalyzingAi) return;
    setIsReanalyzingAi(true);
    setRsvpToast('🔍 Gemini AI is scanning every page & sidebar to detect all RSVP events and sign-ups...');

    try {
      const currentDoc = newsletterConfig;
      let effectivePdfUrl = currentDoc?.pdfUrl || currentDoc?.fileUrl || '';
      if (!effectivePdfUrl || effectivePdfUrl.startsWith('indexeddb:')) {
        try {
          const storedPdf = await getPdfFromStorage('current_newsletter_pdf');
          if (storedPdf) {
            effectivePdfUrl = storedPdf;
          }
        } catch (e) {
          console.warn('Could not read from IndexedDB:', e);
        }
      }

      const res = await fetch('/api/newsletter/extract-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileDataUrl: effectivePdfUrl,
          fileName: currentDoc?.fileName || 'Newsletter.pdf',
          fileType: currentDoc?.fileType || 'application/pdf',
          editionTitle: currentDoc?.editionTitle || 'The Breeze: September 2026',
          monthEdition: currentDoc?.monthEdition || 'September 2026',
          textContent: currentDoc?.description || '',
          isReanalysis: true,
          extraInstructions:
            'RSVP upcoming events for the months are missed and need to be detected. Scan specifically for all events mentioning RSVP, sign up by, register, or deadlines.',
        }),
      });

      if (!res.ok) {
        throw new Error(`Extraction server responded with status: ${res.status}`);
      }

      const data: NewsletterAiExtractionResult = await res.json();
      handleApplyAiExtraction(data);
    } catch (err: any) {
      console.warn('Re-analysis error notice:', err);
      setRsvpToast('Unable to complete deep re-analysis at this moment. Please check your connection.');
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

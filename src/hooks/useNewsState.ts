import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  CommunityRsvpEvent,
  PinnedHighlight,
  NewsletterConfig,
  NewsletterAiExtractionResult,
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
  handleRemoveNewsletter: () => void;
  handleRestoreDefaultNewsletter: () => void;
  newsSubView: 'all' | 'events' | 'gazette' | 'highlights';
  setNewsSubView: React.Dispatch<React.SetStateAction<'all' | 'events' | 'gazette' | 'highlights'>>;
  rsvpEvents: CommunityRsvpEvent[];
  setRsvpEvents: React.Dispatch<React.SetStateAction<CommunityRsvpEvent[]>>;
  handleToggleRsvp: (eventId: number | string) => void;
  handleAddRsvpEvent: (event: Omit<CommunityRsvpEvent, 'id' | 'attendeesCount' | 'userRsvp'>) => void;
  handleUpdateRsvpEvent: (event: CommunityRsvpEvent) => void;
  handleDeleteRsvpEvent: (eventId: number | string, eventTitle?: string) => void;
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
  isExtractingAi: boolean;
  handleTriggerNewsletterExtraction: () => Promise<void>;
}

export function useNewsState(): NewsState {
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
  const [newsSubView, setNewsSubView] = useState<'all' | 'events' | 'gazette' | 'highlights'>('all');

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
  const [isExtractingAi, setIsExtractingAi] = useState(false);

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
        localStorage.setItem(STORAGE_NEWSLETTER_KEY, JSON.stringify(newsletterConfig));
      }
    } catch (e) {
      console.warn('Failed to persist newsletter config:', e);
    }
  }, [newsletterConfig]);

  // Load from Firestore if available
  useEffect(() => {
    getNewsletterConfigFromFirestore().then((cfg) => {
      if (cfg) setNewsletterConfig(cfg);
    });
  }, []);

  const handleSaveNewsletterConfig = useCallback(async (config: NewsletterConfig) => {
    setNewsletterConfig(config);
    setIsUploadNewsletterModalOpen(false);
    await saveNewsletterConfigToFirestore(config);
  }, []);

  const handleRemoveNewsletter = useCallback(() => {
    setNewsletterConfig((prev) => (prev ? { ...prev, isRemoved: true } : null));
  }, []);

  const handleRestoreDefaultNewsletter = useCallback(() => {
    setNewsletterConfig(DEFAULT_NEWSLETTER_CONFIG);
  }, []);

  const handleToggleRsvp = useCallback((eventId: number | string) => {
    setRsvpEvents((prev) =>
      prev.map((ev) => {
        if (String(ev.id) === String(eventId)) {
          const nextRsvp = !ev.userRsvp;
          const nextCount = nextRsvp ? ev.attendeesCount + 1 : Math.max(0, ev.attendeesCount - 1);
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
            attendeesCount: nextCount,
            spotsLeft: nextSpots,
          };
        }
        return ev;
      })
    );
  }, []);

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
        month: String(e.month || 'OCT').toUpperCase().slice(0, 3),
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
        const existingTitles = new Set(prev.map((p) => p.title.toLowerCase().trim()));
        const filteredNew = newEvents.filter((n) => !existingTitles.has(n.title.toLowerCase().trim()));
        eventsAddedCount = filteredNew.length;
        const combined = [...filteredNew, ...prev];
        saveRsvpEventsToFirestore(combined);
        return combined;
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
        const filteredNew = newHighlights.filter((n) => !existingTitles.has(n.title.toLowerCase().trim()));
        highlightsAddedCount = filteredNew.length;
        const combined = [...filteredNew, ...prev];
        savePinnedHighlightsToFirestore(combined);
        return combined;
      });
    }

    setNewsletterConfig((prev) => {
      const updated = prev
        ? { ...prev, lastExtractedAt: Date.now() }
        : { ...DEFAULT_NEWSLETTER_CONFIG, lastExtractedAt: Date.now() };
      saveNewsletterConfigToFirestore(updated);
      return updated;
    });

    setRsvpToast(`✨ AI Extraction Complete: Added ${extracted.rsvp_events?.length || 0} RSVP events & ${extracted.pinned_highlights?.length || 0} community highlights!`);
  }, []);

  const handleTriggerNewsletterExtraction = useCallback(async () => {
    if (isExtractingAi) return;
    setIsExtractingAi(true);

    try {
      const currentDoc = newsletterConfig;
      const res = await fetch('/api/newsletter/extract-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileDataUrl: currentDoc?.pdfUrl || currentDoc?.fileUrl || '',
          fileName: currentDoc?.fileName || 'document.pdf',
          fileType: currentDoc?.fileType || 'application/pdf',
          editionTitle: currentDoc?.editionTitle || 'The Breeze: Monthly Edition',
          monthEdition: currentDoc?.monthEdition || 'Current Edition',
          textContent: currentDoc?.description || '',
        }),
      });

      if (!res.ok) {
        throw new Error(`Extraction server responded with status: ${res.status}`);
      }

      const data: NewsletterAiExtractionResult = await res.json();
      handleApplyAiExtraction(data);
    } catch (err: any) {
      console.warn('Manual AI newsletter extraction notice:', err);
      setRsvpToast('Unable to extract AI highlights at this moment. Please check your connection.');
    } finally {
      setIsExtractingAi(false);
    }
  }, [isExtractingAi, newsletterConfig, handleApplyAiExtraction]);

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
    isExtractingAi,
    handleTriggerNewsletterExtraction,
  };
}

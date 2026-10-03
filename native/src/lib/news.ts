import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, query } from 'firebase/firestore';
import { sortEventsEarlyFirst } from '../../../src/utils/eventSort';
import { db } from './firebase';
import { friendlyError } from './profile';
import type { CommunityRsvpEvent, NewsletterConfig, PinnedHighlight } from '../models';
export function useNews() {
    const [events, setEvents] = useState<CommunityRsvpEvent[]>([]), [highlights, setHighlights] = useState<PinnedHighlight[]>([]), [newsletter, setNewsletter] = useState<NewsletterConfig | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        const pending = new Set(['events', 'highlights', 'newsletter']);
        const complete = (key: string) => { pending.delete(key); if (active)
            setLoading(pending.size > 0); };
        const failed = (key: string) => (e: unknown) => { if (active) {
            setError(friendlyError(e));
            complete(key);
        } };
        const stops = [onSnapshot(query(collection(db, 'community_events'), limit(200)), snap => { if (active) {
                setEvents(sortEventsEarlyFirst(snap.docs.map(d => ({ ...d.data(), id: d.id }) as CommunityRsvpEvent)));
                complete('events');
            } }, failed('events')),
            onSnapshot(query(collection(db, 'community_highlights'), limit(100)), snap => { if (active) {
                setHighlights(snap.docs.map(d => ({ ...d.data(), id: d.id }) as PinnedHighlight));
                complete('highlights');
            } }, failed('highlights')),
            onSnapshot(doc(db, 'newsletters', 'current'), snap => { if (active) {
                setNewsletter(snap.exists() ? snap.data() as NewsletterConfig : null);
                complete('newsletter');
            } }, failed('newsletter'))];
        return () => { active = false; stops.forEach(stop => stop()); };
    }, [attempt]);
    return { events, highlights, newsletter, loading, error, retry: () => { setLoading(true); setError(''); setEvents([]); setHighlights([]); setNewsletter(null); setAttempt(value => value + 1); } };
}

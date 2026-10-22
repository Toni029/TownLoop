import { marketplaceChatQuery } from "../../../src/services/marketplaceChatProtocol";
import { canViewAllWorkOrders } from "../../../src/utils/permissions";
import { subscribeSafely } from "./subscription";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  collection,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { friendlyError } from "./profile";
import { useResident } from "./resident";
export function useLiveCollection<T>(
  name: string,
  read: (id: string, data: Record<string, any>) => T,
  sortField = "createdAt",
) {
  const user = useResident();
  const uid = user ? String(user.id) : "";
  const residentOrders = name === "work_orders" && !!user && !canViewAllWorkOrders(user);
  const [attempt, setAttempt] = useState(0);
  const key =
    user && user.approved === true && ["resident", "admin", "vip", "crew"].includes(user.role || "")
      ? `${user.id}:${user.role}:${residentOrders}:${name}`
      : "";
  const [owned, setOwned] = useState<{
    key: string;
    items: T[];
    loading: boolean;
    error: string;
  }>({ key: "", items: [], loading: true, error: "" });
  const source = useMemo(() => {
    if (name === "marketplace_chats") return marketplaceChatQuery(db, uid);
    const guarded = ['work_orders', 'discussion_feed', 'marketplace_posts', 'posts', 'marketItems'].includes(name);
    const constraints = [
      ...(guarded ? [where('storageDraft', '==', false)] : []),
      ...(residentOrders ? [where('userId', '==', uid)] : []),
      ...(sortField && !residentOrders ? [orderBy(sortField, 'desc')] : []),
    ];
    return query(collection(db, name), ...constraints);
  }, [residentOrders, name, uid, sortField]);
  const activeKey = useRef(key);
  const refreshingRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState('');
  useEffect(() => { activeKey.current = key; return () => { activeKey.current = ''; }; }, [key]);
  const refresh = useCallback(async () => {
    if (!key || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshKey(key);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        getDocsFromServer(source),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Refresh timed out. Please check your connection and try again.')), 12000); }),
      ]);
      // Keep the listener as the sole data writer; an older refresh response cannot overwrite a newer snapshot.
      if (activeKey.current === key) setAttempt(n => n + 1);
    } catch (error) {
      if (activeKey.current === key) setOwned(state => ({ ...state, key, items: state.key === key ? state.items : [], loading: false, error: friendlyError(error) }));
    } finally {
      clearTimeout(timeout);
      refreshingRef.current = false;
      if (activeKey.current) setRefreshKey('');
    }
  }, [key, source]);
  useEffect(() => {
    if (!key) return;
    // Subscription-local cache: unchanged documents keep their object identity.
    const decoded = new Map<string, T>();
    return subscribeSafely(
      (next, fail) =>
        onSnapshot(
          source,
          (snapshot) => {
            for (const change of snapshot.docChanges()) {
              if (change.type === 'removed') decoded.delete(change.doc.id);
              else decoded.set(change.doc.id, read(change.doc.id, change.doc.data({ serverTimestamps: "estimate" })));
            }
            next(
              (residentOrders
                ? [...snapshot.docs].sort(
                    (a, b) =>
                      (b.data().createdAt?.toMillis?.() || 0) -
                      (a.data().createdAt?.toMillis?.() || 0),
                  )
                : snapshot.docs
              ).map((d) => decoded.get(d.id)!),
            );
          },
          fail,
        ),
      (items: T[]) => setOwned({ key, items, loading: false, error: "" }),
      (error) =>
        setOwned((state) => ({
          key,
          items: state.key === key ? state.items : [],
          loading: false,
          error: friendlyError(error),
        })),
    );
  }, [key, source, read, attempt, residentOrders]);
  return {
    ...(key && owned.key === key
      ? owned
      : { items: [] as T[], loading: !!key, error: "" }),
    retry: () => setAttempt((n) => n + 1),
    refresh,
    refreshing: !!key && refreshKey === key,
  };
}

import { subscribeSafely } from './subscription';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import { friendlyError } from './profile';
import { useResident } from './resident';
export function useLiveCollection<T>(name: string, read: (id: string, data: Record<string, any>) => T, sortField = 'createdAt') {
  const user = useResident();
  const [attempt, setAttempt] = useState(0);
  const key = user && user.approved !== false ? `${user.id}:${user.role}:${name}:${attempt}` : '';
  const [owned, setOwned] = useState<{ key: string; items: T[]; loading: boolean; error: string }>({ key: '', items: [], loading: true, error: '' });
  useEffect(() => {
    if (!key) return;
    const source = sortField ? query(collection(db, name), orderBy(sortField, 'desc')) : collection(db, name);
    return subscribeSafely(
      (next, fail) => onSnapshot(source, snapshot => next(snapshot.docs.map(d => read(d.id, d.data()))), fail),
      (items: T[]) => setOwned({ key, items, loading: false, error: '' }),
      error => setOwned(state => ({ key, items: state.key === key ? state.items : [], loading: false, error: friendlyError(error) })),
    );
  }, [key, name, read, sortField, attempt]);
  return {
    ...(key && owned.key === key ? owned : { items: [] as T[], loading: !!key, error: '' }),
    retry: () => setAttempt(n => n + 1),
  };
}

import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, where, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';

export function subscribeToCollection(
  name: string,
  onData: (snapshot: QuerySnapshot<DocumentData>) => void,
  onError: (error: Error) => void,
  options: { ownerId?: string } = {}
): () => void {
  if (!isFirebaseConfigured() || !db || !auth) return () => {};
  const database = db;
  let generation = 0;
  let stopSnapshot = () => {};
  const stopAuth = onAuthStateChanged(auth, user => {
    const current = ++generation;
    stopSnapshot();
    stopSnapshot = () => {};
    if (!user) return;
    const constraints = options.ownerId
      ? [where('userId', '==', options.ownerId), orderBy('createdAt', 'desc')]
      : [orderBy('createdAt', 'desc')];
    stopSnapshot = onSnapshot(query(collection(database, name), ...constraints),
      snapshot => { if (current === generation) onData(snapshot); },
      error => { if (current === generation) onError(error); });
  }, onError);
  return () => {
    generation += 1;
    stopSnapshot();
    stopAuth();
  };
}

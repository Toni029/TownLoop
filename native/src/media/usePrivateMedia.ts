import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onIdTokenChanged } from 'firebase/auth';
import { getBlob, ref } from 'firebase/storage';
import * as FS from 'expo-file-system/legacy';
import { auth, storage } from '../lib/firebase';
import { appCheckHeaders } from '../lib/appCheck';
import { authenticatedStoragePath, ownsStorageReference, resolveStorageMedia } from '../../../src/services/storageReferences';
import { accountMediaPrefix } from '../localData/privateMediaCache';

type MediaSource = { uri: string; dispose: () => void };
/** Private originals stay out of platform URL caches and are scoped to this mounted account/view. */
export function usePrivateMedia(uri: string, kind: 'image' | 'video') {
  const bucket = ref(storage).bucket;
  const privateReference = !!authenticatedStoragePath(uri, bucket) || /^gs:/i.test(uri) || ownsStorageReference(uri, bucket);
  const [source, setSource] = useState<{ key: string; uid: string; value: string } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!privateReference) return;
    let active = true, generation = 0;
    let release = () => {};
    const stop = onIdTokenChanged(auth, async user => {
      const attempt = ++generation;
      release(); release = () => {};
      setSource(null); setError('');
      if (!user || user.isAnonymous) { setError('Please sign in to view this attachment.'); return; }
      try {
        const media = await resolveStorageMedia<MediaSource>(uri, bucket, async path => {
          if (Platform.OS === 'web') {
            const blob = await getBlob(ref(storage, path), 25 * 1024 * 1024);
            const url = URL.createObjectURL(blob);
            return { uri: url, dispose: () => URL.revokeObjectURL(url) };
          }
          const token = await user.getIdToken();
          const headers = { Authorization: `Firebase ${token}`, ...await appCheckHeaders() };
          if (!active || attempt !== generation || auth.currentUser?.uid !== user.uid) throw new Error('Your session changed.');
          const endpoint = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;
          if (!FS.cacheDirectory) throw new Error('Private attachment storage is unavailable.');
          const extension = kind === 'video' ? (/\.(mov|m4v|webm)$/i.exec(path)?.[1] || 'mp4') : 'img';
          const destination = `${FS.cacheDirectory}${accountMediaPrefix(user.uid)}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const dispose = () => { void FS.deleteAsync(destination, { idempotent: true }).catch(() => {}); };
          try {
            const result = await FS.downloadAsync(endpoint, destination, { headers });
            if (result.status !== 200) throw new Error('Private attachment access denied.');
            return { uri: result.uri, dispose };
          } catch (failure) { dispose(); throw failure; }
        }, value => ({ uri: value, dispose: () => {} }));
        if (!active || attempt !== generation || auth.currentUser?.uid !== user.uid) { media.dispose(); return; }
        release = media.dispose;
        setSource({ key: uri, uid: user.uid, value: media.uri });
      } catch { if (active && attempt === generation) setError('Unable to load private attachment.'); }
    });
    return () => { active = false; generation++; stop(); release(); };
  }, [uri, bucket, privateReference, kind, retry]);
  return {
    uri: privateReference ? source?.key === uri && source.uid === auth.currentUser?.uid ? source.value : undefined : uri,
    error: privateReference ? error : '',
    retry: () => setRetry(value => value + 1),
  };
}

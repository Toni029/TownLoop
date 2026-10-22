import { useEffect, useState } from 'react';
import { Image, Platform, type ImageProps, type ImageSourcePropType } from 'react-native';
import { onIdTokenChanged } from 'firebase/auth';
import { getBlob, ref } from 'firebase/storage';
import * as FS from 'expo-file-system/legacy';
import { auth, storage } from '../lib/firebase';
import { privateWorkOrderPath } from '../../../src/services/mediaAuthorization';

/** Private WorkOrder bytes are fetched with the current Firebase ID token, never download tokens. */
export function PrivateImage(props: ImageProps) {
  const input = props.source && !Array.isArray(props.source) && typeof props.source === 'object' ? props.source as {uri?: string} : null;
  const uri = input?.uri || '';
  const path = privateWorkOrderPath(uri, ref(storage).bucket);
  const [source, setSource] = useState<{key: string; value: ImageSourcePropType} | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let generation = 0;
    let release = () => {};
    const stop = onIdTokenChanged(auth, async user => {
      const attempt = ++generation;
      release(); release = () => {};
      setSource(null);
      if (!user || user.isAnonymous) return;
      try {
        let url: string;
        let dispose: () => void;
        if (Platform.OS === 'web') {
          const blob = await getBlob(ref(storage, path), 25 * 1024 * 1024);
          url = URL.createObjectURL(blob);
          dispose = () => URL.revokeObjectURL(url);
        } else {
          const token = await user.getIdToken();
          const endpoint = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(ref(storage).bucket)}/o/${encodeURIComponent(path)}?alt=media`;
          const destination = `${FS.cacheDirectory}private-workorder-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
          dispose = () => { void FS.deleteAsync(destination, {idempotent: true}).catch(() => {}); };
          try {
            const result = await FS.downloadAsync(endpoint, destination, {headers: {Authorization: `Firebase ${token}`}});
            if (result.status !== 200) throw new Error('Private attachment access denied.');
            url = result.uri;
          } catch (error) { dispose(); throw error; }
        }
        if (!active || attempt !== generation || auth.currentUser?.uid !== user.uid) { dispose(); return; }
        release = dispose;
        setSource({key: uri, value: {uri: url}});
      } catch { if (active && attempt === generation) props.onError?.({nativeEvent: {error: 'Unable to load private attachment.'}} as never); }
    });
    return () => { active = false; generation++; stop(); release(); };
  }, [uri, path]);
  if (!path && uri.startsWith('gs://')) return null;
  return <Image {...props} source={path ? source?.key === uri ? source.value : undefined : props.source} />;
}

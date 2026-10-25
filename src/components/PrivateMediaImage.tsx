import React, { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { resolvePrivateMediaUrl } from '../services/storage';

/** Never place persistent Firebase bearer links in img.src, including legacy links. */
export function PrivateMediaImage({src = '', ...props}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [resolved, setResolved] = useState<{input: string; url: string; uid: string} | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let release = () => {};
    if (!auth) return;
    const stop = onIdTokenChanged(auth, async user => {
      const attempt = ++generation;
      release(); release = () => {};
      setResolved(null);
      if (!user || user.isAnonymous) return;
      try {
        const result = await resolvePrivateMediaUrl(src);
        if (!active || attempt !== generation || auth?.currentUser?.uid !== user.uid) { result.revoke(); return; }
        release = result.revoke;
        setResolved({input: src, url: result.url, uid: user.uid});
      } catch { /* Fail closed; do not retry the old token URL. */ }
    });
    return () => { active = false; generation++; stop(); release(); };
  }, [src]);
  const visible = resolved?.input === src && resolved.uid === auth?.currentUser?.uid ? resolved.url : undefined;
  return <img {...props} src={visible} />;
}

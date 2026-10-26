import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
/** One clock per feed; pause while backgrounded and refresh on resume. */
export function useMinuteNow(enabled = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const update = () => setNow(Date.now());
    const start = () => { stop(); update(); timer = setInterval(update, 60_000); };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', state => state === 'active' ? start() : stop());
    return () => { stop(); subscription.remove(); };
  }, [enabled]);
  return now;
}

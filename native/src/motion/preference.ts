export function createMotionPreferenceStore(source: { read: () => Promise<boolean>; listen: (next: (value: boolean) => void) => () => void }) {
  let value = true, revision = 0;
  let stop: (() => void) | undefined;
  const subscribers = new Set<() => void>();
  const publish = (next: boolean) => {
    if (next === value) return;
    value = next; subscribers.forEach(notify => notify());
  };
  return {
    snapshot: () => value,
    subscribe: (notify: () => void) => {
      subscribers.add(notify);
      if (subscribers.size === 1) {
        const request = ++revision;
        stop = source.listen(next => { revision++; publish(next); });
        void source.read().then(next => { if (request === revision) publish(next); }).catch(() => undefined);
      }
      return () => { subscribers.delete(notify); if (!subscribers.size) { revision++; stop?.(); stop = undefined; } };
    },
  };
}

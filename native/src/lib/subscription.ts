export function subscribeSafely<T>(
  attach: (next: (value: T) => void, fail: (error: unknown) => void) => () => void,
  next: (value: T) => void,
  fail: (error: unknown) => void,
) {
  let alive = true;
  const stop = attach(value => { if (alive) next(value); }, error => { if (alive) fail(error); });
  return () => { alive = false; stop(); };
}

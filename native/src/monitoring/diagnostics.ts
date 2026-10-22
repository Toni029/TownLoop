/** Redacted integration seam. No remote reporting or sensitive payload collection by default. */
export type DiagnosticCode = 'react_render_failure' | 'listener_failure' | 'operation_failure';
export type DiagnosticEvent = { code: DiagnosticCode; occurredAt: number };
let sink: ((event: DiagnosticEvent) => void | Promise<void>) | undefined;
let last = { code: '', at: 0 };
export function configureDiagnosticSink(next?: typeof sink) { sink = next; }
export function recordDiagnostic(code: DiagnosticCode) {
  if (!['react_render_failure', 'listener_failure', 'operation_failure'].includes(code)) return;
  const now = Date.now();
  if(last.code === code && now-last.at<60000)return;
  last={code,at:now};
  // Never forward Error, component stack, URL, profile, message or medication content.
  try { void Promise.resolve(sink?.({code,occurredAt:now})).catch(()=>{}); } catch {}
}

/** Temporary Preview-only local evidence. Never pass application payloads to this module. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { AppState, Share } from 'react-native';
export const feedDiagnosticsEnabled = __DEV__ || Updates.channel === 'preview';
const key = 'townloop:preview:feed-upload-trace:v1';
const stages = ['attempt', 'account_start', 'account_done', 'picker_start', 'picker_return', 'picker_cancel', 'selection_state', 'draft_start', 'draft_done', 'copy_start', 'copy_done', 'process_start', 'process_done', 'size_start', 'size_done', 'upload_start', 'token_start', 'token_done', 'session_start', 'session_done', 'native_transfer_start', 'native_transfer_done', 'url_start', 'url_done', 'upload_done', 'transfer_done', 'uploaded_state', 'ui_commit', 'ui_layout', 'ui_unmount', 'app_active', 'app_inactive', 'render_error', 'publish_start', 'publish_done', 'complete', 'error', 'waiting', 'diagnostics_end'] as const;
export type FeedStage = typeof stages[number];
type Event = { stage: FeedStage; elapsedMs: number; code?: string };
let events: Event[] = [];
let start = 0, active = false, writing = false, dirty = false;
let stopAppState: (() => void) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
const safeCodes = new Set(['storage/unauthorized', 'storage/canceled', 'storage/retry-limit-exceeded', 'permission-denied', 'unavailable', 'auth/network-request-failed']);
function persist() {
  dirty = true;
  if (writing) return;
  writing = true;
  void (async () => {
    try {
      while (dirty) {
        dirty = false;
        await AsyncStorage.setItem(key, JSON.stringify({ version: 1, events }));
      }
    } catch { /* Evidence must never block or fail the upload. */ }
    finally { writing = false; }
  })();
}
export function feedStage(stage: FeedStage, error?: unknown) {
  if (!feedDiagnosticsEnabled || !active || !stages.includes(stage) || events.length >= 80) return;
  let code: string | undefined;
  if (stage === 'error') {
    const raw = error && typeof error === 'object' && 'code' in error ? (error as {code: unknown}).code : undefined;
    code = typeof raw === 'string' && safeCodes.has(raw) ? raw : 'unknown';
  }
  const event: Event = { stage, elapsedMs: Math.min(180000, Math.max(0, Math.round(performance.now() - start))), ...(code ? {code} : {}) };
  events.push(event);
  try { console.info('[TL-FEED-TRACE]', JSON.stringify(event)); } catch { /* Logging must not fail media work. */ }
  persist();
}
export function beginFeedTrace() {
  if (!feedDiagnosticsEnabled) return;
  if (timer) clearInterval(timer);
  stopAppState?.();
  const subscription = AppState.addEventListener('change', state => feedStage(state === 'active' ? 'app_active' : 'app_inactive'));
  stopAppState = () => subscription.remove();
  events = []; start = performance.now(); active = true;
  feedStage('attempt');
  // A sparse heartbeat distinguishes pending work from a stalled JS thread.
  timer = setInterval(() => {
    if (performance.now() - start >= 180000 || events.length >= 79) endFeedTrace();
    else feedStage('waiting');
  }, 5000);
}
export function endFeedTrace() {
  if (timer) clearInterval(timer);
  timer = undefined;
  stopAppState?.(); stopAppState = undefined;
  feedStage('diagnostics_end'); active = false;
}
export async function shareFeedTrace() {
  if (!feedDiagnosticsEnabled) return;
  try {
    const saved = await AsyncStorage.getItem(key);
    // Revalidate persisted evidence. Never export arbitrary local storage values.
    const parsed = saved ? JSON.parse(saved) : null;
    const clean = (Array.isArray(parsed?.events) ? parsed.events : []).slice(-80).filter((e: Event) => stages.includes(e.stage) && Number.isFinite(e.elapsedMs)).map((e: Event) => ({stage:e.stage, elapsedMs:Math.min(180000,Math.max(0,Math.round(e.elapsedMs))), ...(e.code ? {code:safeCodes.has(e.code)?e.code:'unknown'} : {})}));
    await Share.share({message: JSON.stringify({diagnostic:'TL-FEED-TRACE', version:1, events:clean}, null, 2)});
  } catch { /* Sharing cancellation/storage failure has no effect on app data. */ }
}

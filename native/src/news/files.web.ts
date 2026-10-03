// The browser preview cannot validate native file picking, PDF rendering or sharing.
// No browser PDF plugin/WebView is used as a substitute for the native reader.
import type { NewsletterConfig } from "../models";
export type PickedPdf = { name: string; dataUrl: string; size: number };
const unavailable = () =>
  new Error(
    "Please use the TownLoop Android or iOS development build to open, upload or save PDFs.",
  );
export async function pickPdf(): Promise<PickedPdf | null> {
  throw unavailable();
}
export async function preparePdf(
  _config: NewsletterConfig,
): Promise<{ uri: string; dispose: () => void }> {
  throw unavailable();
}
export async function sharePdf(_config: NewsletterConfig): Promise<void> {
  throw unavailable();
}

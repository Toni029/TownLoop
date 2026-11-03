import { downloadPdfBytes } from './download';
import * as FS from "expo-file-system/legacy";
import type { PdfSource } from "./pdfTransfer";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { activeEdition, loadPdfData, MAX_PDF_BYTES, MAX_PDF_MB } from "./edition";
import type { NewsletterConfig } from "../models";
import { auth } from "../lib/firebase";
import { accountMediaPrefix } from "../localData/privateMediaCache";
import { editionKey } from "./model";
export type PickedPdf = PdfSource;
export async function pickPdf(): Promise<PickedPdf | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Please sign in again.");
  const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const started = performance.now(), asset = result.assets[0];
  let file = new File(asset.uri), retired = false, readers = 0;
  const remove = () => { try { if (file.exists) file.delete(); } catch {} };
  const check = () => { if (retired || auth.currentUser?.uid !== uid) throw new Error("Please select the PDF again in your current account."); };
  async function read(offset?: number, length?: number) {
    check(); readers++;
    try {
      const data = await FS.readAsStringAsync(file.uri, { encoding: FS.EncodingType.Base64, ...(offset === undefined ? {} : { position: offset, length }) });
      check(); return data;
    } finally { readers--; if (retired && !readers) remove(); }
  }
  try {
    check();
    const size = file.size;
    if (size > MAX_PDF_BYTES) throw new Error(`Please use a PDF no larger than ${MAX_PDF_MB} MB.`);
    if (size < 8 || !(await read(0, 8)).startsWith("JVBERi0")) throw new Error("Please select a valid PDF.");
    // Move the picker's single cache copy into the existing account cleanup namespace.
    const owned = new File(Paths.cache, `${accountMediaPrefix(uid)}newsletter-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    await FS.moveAsync({ from: file.uri, to: owned.uri }); file = owned; check();
    return { name: asset.name, size, identity: file.uri, preparationMs: performance.now() - started,
      readBase64: (offset, length) => read(offset, length),
      readDataUrl: async () => `data:application/pdf;base64,${await read()}`,
      dispose: () => { retired = true; if (!readers) remove(); },
    };
  } catch (error) { retired = true; if (!readers) remove(); throw error; }
}
type PreparedPdf = { uri: string; dispose: () => void };
type CachedPdf = { key: string; uid: string; file: Promise<File>; users: number; retired: boolean; timer?: ReturnType<typeof setTimeout> };
let cached: CachedPdf | undefined;
const IDLE_CACHE_MS = 5 * 60 * 1000;
function retire(entry: CachedPdf) {
  entry.retired = true;
  clearTimeout(entry.timer);
  if (cached === entry) cached = undefined;
  if (!entry.users) void entry.file.then(file => { try { if (file.exists) file.delete(); } catch {} }, () => {});
}
/** Retry/removal invalidates reusable bytes without deleting a file still in use. */
export function invalidatePreparedPdf() { if (cached) retire(cached); }
async function materialize(config: NewsletterConfig, uid: string): Promise<File> {
  const file = new File(Paths.cache, `${accountMediaPrefix(uid)}newsletter-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    try {
      // loadPdfData already checks the active edition before and after reading.
      const dataUrl = await loadPdfData(config);
      file.write(dataUrl.split(",")[1], { encoding: "base64" });
    } catch (error) {
      const url = config.pdfUrl || config.fileUrl || "";
      if (!(error instanceof Error) || !error.message.startsWith("No complete PDF") ||
          !(url.startsWith("https://") || url.startsWith("gs://") || url.startsWith("/api/newsletter/pdf/"))) throw error;
      file.write(await downloadPdfBytes(url));
      await activeEdition(config);
    }
    if (auth.currentUser?.uid !== uid) throw new Error("Please sign in again.");
    if (!file.exists || file.size <= 0 || file.size > MAX_PDF_BYTES) throw new Error(`This file is not a supported PDF (maximum ${MAX_PDF_MB} MB).`);
    return file;
  } catch (error) { if (file.exists) file.delete(); throw error; }
}
export async function preparePdf(config: NewsletterConfig): Promise<PreparedPdf> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Please sign in again.");
  const key = editionKey(config);
  let entry = cached;
  const reuse = !!entry && entry.uid === uid && entry.key === key;
  if (!reuse) {
    invalidatePreparedPdf();
    entry = { key, uid, file: materialize(config, uid), users: 0, retired: false };
    cached = entry;
  }
  const lease = entry!;
  clearTimeout(lease.timer);
  lease.users++;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    lease.users--;
    if (!lease.users) {
      if (lease.retired) retire(lease);
      else lease.timer = setTimeout(() => retire(lease), IDLE_CACHE_MS);
    }
  };
  try {
    // Never bypass current server permissions or serve an edition removed/replaced.
    if (reuse) await activeEdition(config);
    const file = await lease.file;
    if (auth.currentUser?.uid !== uid) throw new Error("Please sign in again.");
    if (!file.exists) { retire(lease); dispose(); return preparePdf(config); }
    return { uri: file.uri, dispose };
  } catch (error) { retire(lease); dispose(); throw error; }
}
export async function sharePdf(config: NewsletterConfig) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Saving or sharing files is unavailable on this device.");
  const file = await preparePdf(config);
  try {
    await activeEdition(config);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: config.fileName || "Newsletter.pdf",
    });
  } finally {
    file.dispose();
  }
}

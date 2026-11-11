import { abuseControls } from '../../../src/security/abuseBudget';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import type { NewsletterConfig } from "../models";
import { app, auth, db, storage } from "../lib/firebase";
import { approvedUser } from "./actions";
import { assemblePdf, editionKey, hasUploadedNewsletter } from "./model";
import { transferPdf, stringPdfSource, newUploadResume, PDF_CHUNK_BYTES, PDF_PREFIX, type PdfSource, type UploadResume, type TransferProgress } from "./pdfTransfer";
import { commitPdfChunks, pdfReceipts, chunkDigest, savePdfDraft, pdfRequest } from "./firestorePdf";
export const MAX_PDF_MB = 64;
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;
export async function activeEdition(expected?: NewsletterConfig) {
  const snap = await getDocFromServer(doc(db, "newsletters", "current"));
  const current = snap.exists() ? (snap.data() as NewsletterConfig) : null;
  if (
    !current ||
    !hasUploadedNewsletter(current) ||
    (expected && editionKey(current) !== editionKey(expected))
  )
    throw new Error(
      "This edition is no longer available. Return to News for the current newsletter.",
    );
  return current;
}
export async function loadPdfData(config: NewsletterConfig) {
  const id = config.id || "current";
  const reference = doc(db, "newsletters", id);
  // All reads enforce Firestore authorization independently. Overlap the pointer
  // check with the immutable edition reads instead of adding a serial network
  // round trip before the PDF download. Nothing is returned until it succeeds;
  // the final pointer check below still rejects replacement/removal mid-read.
  const [, meta, chunks] = await Promise.all([
    activeEdition(config),
    getDocFromServer(reference),
    getDocsFromServer(collection(reference, "chunks")),
  ]);
  if (!chunks.empty) {
    const result = assemblePdf(
      chunks.docs.map((d) => d.data() as { index: number; data: string }),
      meta.data()?.totalChunks,
    );
    await activeEdition(config);
    return result;
  }
  const url = config.pdfUrl || config.fileUrl || "";
  if (url.startsWith("data:application/pdf;base64,")) {
    await activeEdition(config);
    return url;
  }
  // Historical server-relative and browser-local URLs are not portable. The web
  // uploader also saved the same PDF in Firestore; never open an older fallback.
  throw new Error(
    "No complete PDF was found in Firebase for this edition. Please upload its PDF again.",
  );
}
async function clearChunks(id: string) {
  const snapshot = await getDocsFromServer(
    collection(db, "newsletters", id, "chunks"),
  );
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = writeBatch(db);
    snapshot.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
async function removeEditionFiles(id: string) {
  if (!id || id === "current") return;
  await clearChunks(id);
  try {
    await deleteObject(ref(storage, `newsletters/${id}/document.pdf`));
  } catch (e) {
    if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
  }
  await deleteDoc(doc(db, "newsletters", id));
}
export async function removeEdition(expected: NewsletterConfig) {
  await approvedUser(true);
  await runTransaction(db, async (tx) => {
    const pointer = doc(db, "newsletters", "current");
    const snap = await tx.get(pointer);
    const current = snap.data() as NewsletterConfig | undefined;
    if (!current || editionKey(current) !== editionKey(expected))
      throw new Error(
        "The newsletter changed. Please refresh before removing it.",
      );
    tx.set(pointer, {
      ...current,
      isRemoved: true,
      pdfUrl: "",
      fileUrl: "",
      pageImages: [],
      hasFirestoreBlob: false,
      totalChunks: 0,
      uploadedAt: Date.now(),
      updatedAt: serverTimestamp(),
    });
  });
  // The tombstone is committed first: all readers close even if cleanup needs retry.
  await purgeRemovedEdition(expected.id);
}
export async function purgeRemovedEdition(id: string) {
  await approvedUser(true);
  const active = await getDocFromServer(doc(db, "newsletters", "current"));
  if (!active.data()?.isRemoved || active.data()?.id !== id)
    throw new Error(
      "A different newsletter is now active. Cleanup was stopped.",
    );
  const chunks = await getDocsFromServer(
    collection(db, "newsletters", "current", "chunks"),
  );
  for (let offset = 0; offset < chunks.size; offset += 400) {
    await runTransaction(db, async (tx) => {
      const pointer = await tx.get(doc(db, "newsletters", "current"));
      if (!pointer.data()?.isRemoved || pointer.data()?.id !== id)
        throw new Error("A new newsletter was published. Cleanup was stopped.");
      chunks.docs
        .slice(offset, offset + 400)
        .forEach((chunk) => tx.delete(chunk.ref));
    });
  }
  await removeEditionFiles(id);
}
export async function stageEdition(
  config: NewsletterConfig,
  input: string | PdfSource,
  onProgress: (percent: number) => void,
  options: { signal?: AbortSignal; resume?: UploadResume; onTransfer?: (value: TransferProgress) => void; onMetrics?: (value: { preparationMs: number; readMs: number; commitMs: number; elapsedMs: number; commits: number }) => void } = {},
) {
  const user = await approvedUser(true);
  const uid = auth.currentUser?.uid;
  if (!uid || String(user.id) !== uid) throw new Error("Please sign in again.");
  if (typeof input === "string" && !input.startsWith(PDF_PREFIX + "JVBERi0")) throw new Error("Please select a valid PDF.");
  const source = typeof input === "string" ? stringPdfSource(input) : input;
  if (!Number.isSafeInteger(source.size) || source.size <= 0) throw new Error("Please select a valid PDF.");
  if (source.size > MAX_PDF_BYTES) throw new Error(`Please use a PDF no larger than ${MAX_PDF_MB} MB.`);
  const totalChunks = Math.ceil(source.size / PDF_CHUNK_BYTES);
  const totalSize = PDF_PREFIX.length + Math.ceil(source.size / 3) * 4;
  const check = () => { if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. Reopen the newsletter uploader."); };
  // The durable draft is never the published pointer. Reopening can recover
  // partial uploads after proving every retained chunk belongs to the selected file.
  const existing = await pdfRequest(`/newsletters/${config.id}?mask.fieldPaths=uploadState&mask.fieldPaths=uploadedBy&mask.fieldPaths=sourceBytes&mask.fieldPaths=totalChunks&mask.fieldPaths=totalSize&mask.fieldPaths=uploadBudgetId`, {signal: options.signal});
  if (existing?.fields?.uploadState?.stringValue === 'published') throw Error('This edition is already published. Select a new draft.');
  if (existing?.fields?.uploadedBy?.stringValue && existing.fields.uploadedBy.stringValue !== uid) throw Error('This partial upload belongs to another account. Select a new draft.');
  for (const [field, expected] of [['sourceBytes', source.size], ['totalChunks', totalChunks], ['totalSize', totalSize]] as const) {
    const value = existing?.fields?.[field]?.integerValue;
    if (value !== undefined && Number(value) !== expected) throw Error('This retained upload has different PDF dimensions. Select the original PDF or a new draft.');
  }
  const receipts = await pdfReceipts(config.id, options.signal);
  const confirmed = new Set<number>();
  for (const receipt of receipts) {
    check();
    if (options.signal?.aborted) throw Error('Upload paused. Retry to resume.');
    const index = receipt.index;
    if (!Number.isInteger(index) || index < 0 || index >= totalChunks || receipt.totalChunks !== totalChunks || receipt.totalSize !== totalSize || !/^[a-f0-9]{64}$/.test(receipt.sha256)) throw Error('This retained upload cannot be safely matched. Select the PDF as a new upload.');
    const offset = index * PDF_CHUNK_BYTES;
    const data = (index === 0 ? PDF_PREFIX : '') + await source.readBase64(offset, Math.min(PDF_CHUNK_BYTES, source.size - offset));
    if (await chunkDigest(data) !== receipt.sha256) throw Error('This is not the original PDF for the partial upload. Select the original file; no retained bytes were changed.');
    confirmed.add(index);
  }
  check();
  const base = {...config, uploadedBy: uid, hasFirestoreBlob: true, totalChunks, totalSize, sourceBytes: source.size,
    ...(existing?.fields?.uploadBudgetId?.stringValue ? {uploadBudgetId: existing.fields.uploadBudgetId.stringValue} : {})};
  if (existing?.fields?.uploadState?.stringValue === 'uploaded') {
    if (confirmed.size !== totalChunks) throw Error('This completed draft is missing verified PDF data. Select a new draft.');
    onProgress(100);
    return {...base, uploadState: 'uploaded', updatedAt: serverTimestamp()};
  }
  const controls = await abuseControls(db);
  check();
  if (options.signal?.aborted) throw Error('Upload paused. Retry to resume.');
  if (controls?.prepareClients || controls?.enforceWrites) {
    const result = await httpsCallable<
      {newsletterId: string; bytes: number; totalChunks: number; totalSize: number},
      {reservationId: string; expiresAt: number}
    >(getFunctions(app, 'us-central1'), 'issueNewsletterUpload', {timeout: 20000})({newsletterId: config.id, bytes: source.size, totalChunks, totalSize});
    check();
    if (options.signal?.aborted) throw Error('Upload paused. Retry to resume.');
    if (!/^[a-f0-9]{64}$/.test(result.data.reservationId) || result.data.expiresAt <= Date.now()) throw Error('The newsletter upload authorization expired. Retry to resume.');
    Object.assign(base, {uploadBudgetId: result.data.reservationId});
  }
  await savePdfDraft(config.id, {...base, uploadState: 'uploading'}, options.signal);
  await transferPdf({
    source, key: `${uid}:${config.id}`, resume: options.resume || newUploadResume(), signal: options.signal, check,
    confirmedChunks: confirmed,
    metrics: metrics => options.onMetrics?.({ preparationMs: source.preparationMs, ...metrics }),
    progress: value => { onProgress(value.percent); options.onTransfer?.(value); },
    commit: async chunks => {
      check();
      if (options.signal?.aborted) throw new Error("Upload paused. Retry to resume.");
      const pending = chunks.filter(chunk => !confirmed.has(chunk.index));
      if (pending.length) await commitPdfChunks(config.id, pending, totalChunks, totalSize, options.signal);
    },
  });
  check();
  const metadata = { ...base, uploadState: 'uploaded', updatedAt: serverTimestamp() };
  // Use the same bounded/retryable transport for the final acknowledgement;
  // a queued SDK setDoc previously could hang after all PDF bytes had arrived.
  await savePdfDraft(config.id, metadata, options.signal);
  check();
  return metadata;
}
export async function finishEdition(
  metadata: NewsletterConfig & { totalChunks: number; totalSize: number },
  expectedKey: string,
  items: {
    id: string;
    collection: string;
    data: Record<string, unknown>;
  }[] = [],
) {
  await approvedUser(true);
  const config = metadata;
  await runTransaction(db, async (tx) => {
    const pointer = doc(db, "newsletters", "current");
    const old = await tx.get(pointer);
    if (old.exists() && old.data().id === config.id && !old.data().isRemoved) return;
    if (
      editionKey(old.exists() ? (old.data() as NewsletterConfig) : null) !==
      expectedKey
    )
      throw new Error(
        "Another administrator changed the newsletter. Refresh before publishing.",
      );
    for (const item of items)
      tx.set(doc(db, item.collection, item.id), item.data);
    tx.set(doc(db, "newsletters", config.id), { ...metadata, uploadState: "published" });
    // PDF bytes live at the immutable edition id. Publishing only the pointer
    // stays below Firestore's 10 MiB transaction limit for the real 16 MiB issue.
    // Web useNewsletterPdf already resolves config.id before its legacy fallback.
    tx.set(pointer, {
      ...metadata,
      uploadState: "published",
      hasFirestoreBlob: false,
      totalChunks: 0,
      totalSize: 0,
    });
  });
}
export async function publishEdition(
  config: NewsletterConfig,
  dataUrl: string,
  expectedKey: string,
  onProgress: (percent: number) => void,
) {
  const metadata = await stageEdition(config, dataUrl, onProgress);
  await finishEdition(metadata, expectedKey);
  onProgress(100);
}

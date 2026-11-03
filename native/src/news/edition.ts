import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import type { NewsletterConfig } from "../models";
import { auth, db, storage } from "../lib/firebase";
import { approvedUser } from "./actions";
import { assemblePdf, editionKey, hasUploadedNewsletter } from "./model";
import { transferPdf, stringPdfSource, newUploadResume, PDF_CHUNK_BYTES, PDF_PREFIX, type PdfSource, type UploadResume, type TransferProgress } from "./pdfTransfer";
import { commitPdfChunks } from "./firestorePdf";
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
  const metrics = await transferPdf({
    source, key: `${uid}:${config.id}`, resume: options.resume || newUploadResume(), signal: options.signal, check,
    progress: value => { onProgress(value.percent); options.onTransfer?.(value); },
    commit: async chunks => {
      check();
      if (options.signal?.aborted) throw new Error("Upload paused. Retry to resume.");
      await commitPdfChunks(config.id, chunks, totalChunks, totalSize, options.signal);
    },
  });
  check();
  options.onMetrics?.({ preparationMs: source.preparationMs, ...metrics });
  // Durable checkpoint is separate from the live pointer: closing/restarting cannot lose a confirmed PDF.
  const metadata = { ...config, hasFirestoreBlob: true, totalChunks, totalSize, sourceBytes: source.size, uploadState: 'uploaded', updatedAt: serverTimestamp() };
  await setDoc(doc(db, "newsletters", config.id), metadata);
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

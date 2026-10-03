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
import { db, storage } from "../lib/firebase";
import { approvedUser } from "./actions";
import { assemblePdf, editionKey } from "./model";
export const MAX_PDF_BYTES = 32 * 1024 * 1024;
export async function activeEdition(expected?: NewsletterConfig) {
  const snap = await getDocFromServer(doc(db, "newsletters", "current"));
  const current = snap.exists() ? (snap.data() as NewsletterConfig) : null;
  if (
    !current ||
    current.isRemoved ||
    (expected && editionKey(current) !== editionKey(expected))
  )
    throw new Error(
      "This edition is no longer available. Return to News for the current newsletter.",
    );
  return current;
}
export async function loadPdfData(config: NewsletterConfig) {
  await activeEdition(config);
  const id = config.id || "current";
  const reference = doc(db, "newsletters", id);
  const meta = await getDocFromServer(reference);
  const chunks = await getDocsFromServer(collection(reference, "chunks"));
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
export async function publishEdition(
  config: NewsletterConfig,
  dataUrl: string,
  expectedKey: string,
  onProgress: (percent: number) => void,
) {
  await approvedUser(true);
  if (!/^data:application\/pdf;base64,JVBERi0/.test(dataUrl))
    throw new Error("Please select a valid PDF.");
  if (dataUrl.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 64)
    throw new Error("Please use a PDF smaller than 32 MB.");
  const chunkSize = 650 * 1024;
  const totalChunks = Math.ceil(dataUrl.length / chunkSize);
  const metadata = {
    ...config,
    hasFirestoreBlob: true,
    totalChunks,
    totalSize: dataUrl.length,
    updatedAt: serverTimestamp(),
  };
  // Stage the edition without changing the live pointer or exposing half a file.
  for (let index = 0; index < totalChunks; index++) {
    await setDoc(doc(db, "newsletters", config.id, "chunks", String(index)), {
      index,
      data: dataUrl.slice(index * chunkSize, (index + 1) * chunkSize),
      totalChunks,
      totalSize: dataUrl.length,
      updatedAt: serverTimestamp(),
    });
    onProgress(Math.round(((index + 1) / totalChunks) * 80));
  }
  await runTransaction(db, async (tx) => {
    const pointer = doc(db, "newsletters", "current");
    const old = await tx.get(pointer);
    if (
      editionKey(old.exists() ? (old.data() as NewsletterConfig) : null) !==
      expectedKey
    )
      throw new Error(
        "Another administrator changed the newsletter. Refresh before publishing.",
      );
    tx.set(doc(db, "newsletters", config.id), metadata);
    // PDF bytes live at the immutable edition id. Publishing only the pointer
    // stays below Firestore's 10 MiB transaction limit for the real 16 MiB issue.
    // Web useNewsletterPdf already resolves config.id before its legacy fallback.
    tx.set(pointer, {
      ...metadata,
      hasFirestoreBlob: false,
      totalChunks: 0,
      totalSize: 0,
    });
  });
  onProgress(100);
}

export async function restoreDefaultEdition(expected: NewsletterConfig) {
  await approvedUser(true);
  await runTransaction(db, async (tx) => {
    const pointer = doc(db, "newsletters", "current");
    const current = await tx.get(pointer);
    if (!current.data()?.isRemoved || current.data()?.id !== expected.id)
      throw new Error(
        "The newsletter changed. Refresh before restoring the default edition.",
      );
    tx.set(pointer, {
      id: "the-breeze-september-2026",
      editionTitle: "The Breeze: September 2026",
      monthEdition: "September 2026",
      description:
        "Featuring the 2026 Pet Gallery, Flu Shot Clinic, Continuum of Care Olive Garden Lunch, Make Your Own Sundae Social, Wii Bowling Results & Community Potlucks.",
      isCustomUpload: false,
      isRemoved: false,
      pdfUrl: "",
      fileUrl: "",
      pageImages: [],
      hasFirestoreBlob: false,
      totalChunks: 0,
      uploadedAt: Date.now(),
      updatedAt: serverTimestamp(),
    });
  });
}

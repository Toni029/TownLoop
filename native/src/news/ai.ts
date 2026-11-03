import { preflightAnalysis } from "./api";
import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { NewsletterConfig } from "../models";
import { approvedUser } from "./actions";
import { activeEdition } from "./edition";
import { editionKey } from "./model";
import { analysisItems, type AnalysisResult } from "./analysisModel";
export async function analyzeNewsletter(
  config: NewsletterConfig,
  newUpload = false,
): Promise<AnalysisResult> {
  await approvedUser(true);
  const owner = auth.currentUser?.uid;
  const base = await preflightAnalysis();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error("Please sign in again.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);
  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/newsletter/native/extract-content`,
      {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newsletterId: config.id,
          mimeType: "application/pdf",
          fileName: config.fileName,
          editionTitle: config.editionTitle,
          monthEdition: config.monthEdition,
          isReanalysis: !newUpload,
          isNewUpload: newUpload,
        }),
        signal: controller.signal,
      },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw Error(result?.error || "Newsletter analysis failed. Please retry.");
    if (auth.currentUser?.uid !== owner) throw Error("Your account changed. Reopen News.");
    analysisItems(result, config); // Validate before showing or persisting output.
    if (!newUpload) await activeEdition(config);
    return result;
  } catch (error) {
    if (controller.signal.aborted)
      throw Error("Newsletter analysis timed out. Please retry.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export async function applyAnalysis(
  result: AnalysisResult,
  config: NewsletterConfig,
  selected: string[],
) {
  await approvedUser(true);
  const items = analysisItems(result, config).filter((item) =>
    selected.includes(item.id),
  );
  await runTransaction(db, async (tx) => {
    const pointer = doc(db, "newsletters", "current");
    const current = await tx.get(pointer);
    if (
      !current.exists() ||
      current.data().isRemoved ||
      editionKey(current.data() as NewsletterConfig) !== editionKey(config)
    )
      throw Error(
        "The newsletter changed. Analyze the current edition instead.",
      );
    const existing = await Promise.all(
      items.map((item) => tx.get(doc(db, item.collection, item.id))),
    );
    items.forEach((item, index) => {
      // Stable identities make retries/reanalysis idempotent and preserve RSVP rosters and manual edits.
      if (!existing[index].exists())
        tx.set(doc(db, item.collection, item.id), item.data);
    });
    tx.update(pointer, {
      aiAnalyzedAt: Date.now(),
      aiSourceModel: result.sourceModel || "gemini",
    });
  });
}

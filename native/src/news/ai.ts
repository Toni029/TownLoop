import { preflightAnalysis } from "./api";
import {analyzeInBackground, type AnalysisProgress} from "./analysisJobs";
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
  options: {signal?:AbortSignal;onProgress?:(progress:AnalysisProgress)=>void} = {},
): Promise<AnalysisResult> {
  await approvedUser(true);
  const owner = auth.currentUser?.uid;
  const base = await preflightAnalysis(0, true);
  if (!owner) throw Error("Please sign in again.");
  const result = await analyzeInBackground(base, {
    newsletterId: config.id, fileName: config.fileName, editionTitle: config.editionTitle,
    monthEdition: config.monthEdition, isNewUpload: newUpload,
  }, owner, options);
  if (auth.currentUser?.uid !== owner) throw Error("Your account changed. Reopen News.");
  analysisItems(result, config, {review:true});
  if (!newUpload) await activeEdition(config);
  return result;
}
export async function applyAnalysis(
  result: AnalysisResult,
  config: NewsletterConfig,
  selected: string[],
) {
  await approvedUser(true);
  const items = analysisItems(result, config, {selectedIds:selected});
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

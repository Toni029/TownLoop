import { Platform } from "react-native";
import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { NewsletterConfig } from "../models";
import { approvedUser } from "./actions";
import { activeEdition, loadPdfData } from "./edition";
import { editionKey } from "./model";
import { analysisItems, type AnalysisResult } from "./analysisModel";
export async function analyzeNewsletter(
  config: NewsletterConfig,
): Promise<AnalysisResult> {
  await approvedUser(true);
  const configured = process.env.EXPO_PUBLIC_TOWNLOOP_API_URL;
  const local =
    Platform.OS === "web" &&
    typeof location !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(location.hostname);
  const base =
    configured ||
    (local ? `${location.protocol}//${location.hostname}:3000` : "");
  if (!base)
    throw Error(
      "Set EXPO_PUBLIC_TOWNLOOP_API_URL to the secure TownLoop server to enable newsletter analysis.",
    );
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("The TownLoop AI service must use HTTPS.");
  const data = await loadPdfData(config);
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error("Please sign in again.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/newsletter/extract-content`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newsletterId: config.id,
          base64Data: data.split(",")[1],
          mimeType: "application/pdf",
          fileName: config.fileName,
          editionTitle: config.editionTitle,
          monthEdition: config.monthEdition,
          isReanalysis: true,
        }),
        signal: controller.signal,
      },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw Error(result?.error || "Newsletter analysis failed. Please retry.");
    analysisItems(result, config); // Validate before showing or persisting output.
    await activeEdition(config);
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

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { activeEdition, loadPdfData, MAX_PDF_BYTES } from "./edition";
import type { NewsletterConfig } from "../models";
export type PickedPdf = { name: string; dataUrl: string; size: number };
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (file.size > MAX_PDF_BYTES)
      throw new Error("Please use a PDF smaller than 32 MB.");
    const dataUrl = `data:application/pdf;base64,${await file.base64()}`;
    if (!dataUrl.startsWith("data:application/pdf;base64,JVBERi0"))
      throw new Error("Please select a valid PDF.");
    return { name: asset.name, dataUrl, size: file.size };
  } finally {
    if (file.exists) file.delete();
  }
}
export async function preparePdf(
  config: NewsletterConfig,
): Promise<{ uri: string; dispose: () => void }> {
  await activeEdition(config);
  const file = new File(
    Paths.cache,
    `townloop-news-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  try {
    try {
      const dataUrl = await loadPdfData(config);
      file.write(dataUrl.split(",")[1], { encoding: "base64" });
    } catch (error) {
      const url = config.pdfUrl || config.fileUrl || "";
      if (
        !(error instanceof Error) ||
        !error.message.startsWith("No complete PDF") ||
        !url.startsWith("https://")
      )
        throw error;
      await File.downloadFileAsync(url, file);
      if (
        file.size > MAX_PDF_BYTES ||
        !(await file.base64()).startsWith("JVBERi0")
      )
        throw new Error("This file is not a supported PDF.");
    }
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  try {
    await activeEdition(config);
    return {
      uri: file.uri,
      dispose: () => {
        if (file.exists) file.delete();
      },
    };
  } catch (e) {
    if (file.exists) file.delete();
    throw e;
  }
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

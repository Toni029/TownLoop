import type { NewsletterConfig } from "../models";
import { activeEdition, loadPdfData, MAX_PDF_BYTES } from "./edition";
export type PickedPdf = { name: string; dataUrl: string; size: number };
export async function pickPdf(): Promise<PickedPdf | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.style.display = "none";
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener(
      "cancel",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        if (file.size > MAX_PDF_BYTES) {
          reject(new Error("Please use a PDF smaller than 32 MB."));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () =>
          reject(
            new Error("Unable to read this file. Please select it again."),
          );
        reader.onload = () => {
          const encoded = String(reader.result).split(",")[1] || "";
          if (!encoded.startsWith("JVBERi0")) {
            reject(new Error("Please select a valid PDF."));
            return;
          }
          resolve({
            name: file.name,
            size: file.size,
            dataUrl: `data:application/pdf;base64,${encoded}`,
          });
        };
        reader.readAsDataURL(file);
      },
      { once: true },
    );
    input.click();
  });
}
export async function preparePdf(
  config: NewsletterConfig,
): Promise<{ uri: string; dispose: () => void }> {
  let blob: Blob;
  try {
    const data = await loadPdfData(config);
    blob = await (await fetch(data)).blob();
  } catch (error) {
    const url = config.pdfUrl || config.fileUrl || "";
    if (
      !(error instanceof Error) ||
      !error.message.startsWith("No complete PDF") ||
      !url.startsWith("https://")
    )
      throw error;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Unable to download the newsletter. Please try again.");
    blob = await response.blob();
  }
  if (blob.size > MAX_PDF_BYTES || (await blob.slice(0, 5).text()) !== "%PDF-")
    throw new Error("This file is not a supported PDF (maximum 32 MB).");
  await activeEdition(config);
  const uri = URL.createObjectURL(
    new Blob([blob], { type: "application/pdf" }),
  );
  return { uri, dispose: () => URL.revokeObjectURL(uri) };
}
export async function sharePdf(config: NewsletterConfig): Promise<void> {
  const file = await preparePdf(config);
  const link = document.createElement("a");
  link.href = file.uri;
  link.download = config.fileName || "TownLoop-newsletter.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to consume the object URL before releasing it.
  setTimeout(file.dispose, 60000);
}

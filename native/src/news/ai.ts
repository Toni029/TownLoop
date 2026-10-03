/** Intentionally no network call until the secure TownLoop backend is deployed.
 * Contract: POST /api/newsletter/extract-content with Firebase Bearer ID token.
 * GEMINI_API_KEY belongs only in that server's environment. See NEWS_MIGRATION.md.
 */
export const AI_DEFERRED_MESSAGE =
  "Newsletter AI analysis is waiting for the secure TownLoop service. You can upload the PDF and manage events and pinned notices manually.";
export type NewsletterAnalysisRequest = {
  newsletterId: string;
  base64Data: string;
  mimeType: "application/pdf";
  fileName: string;
  editionTitle: string;
  monthEdition: string;
  isReanalysis: boolean;
  isNewUpload: boolean;
  extraInstructions?: string;
};

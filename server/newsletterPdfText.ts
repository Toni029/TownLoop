/** Text fallback for large text-based PDFs when Gemini's file service is unavailable. */
export async function newsletterPdfText(base64: string): Promise<string> {
  // Resolve at runtime: PDF.js is a server dependency, not part of client bundles.
  const moduleName = 'pdfjs-dist/legacy/build/pdf.mjs';
  const { getDocument } = await import(moduleName);
  const task = getDocument({ data: new Uint8Array(Buffer.from(base64, 'base64')), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('This newsletter has too many pages for text analysis. Please use a shorter PDF.');
    const pages: string[] = [];
    let total = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map((item: { str?: string; hasEOL?: boolean }) => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('').trim();
      if (text.length < 40) throw new Error(`Page ${number} has too little readable text for the fallback. Please upload a searchable PDF (OCR), or retry when Gemini's PDF service is available.`);
      total += text.length;
      if (total > 500000) throw new Error('The newsletter text is too long for a reliable single analysis. Please use a shorter PDF.');
      pages.push(`=== PDF PAGE ${number} ===\n${text}`);
      page.cleanup();
    }
    return pages.join('\n\n');
  } finally { await task.destroy(); }
}

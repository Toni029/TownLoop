/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { translateWorkOrderContent } from './server/translation.ts';
import { extractNewsletterContent } from './server/newsletterExtractor.ts';

dotenv.config();

const app = express();
const PORT = 3000;

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize uploads directory:', e);
}

const asText = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.slice(0, limit) : '';

const aiRequestWindows = new Map<string, { count: number; resetAt: number }>();
const AI_WINDOW_MS = 10 * 60 * 1000;
const AI_REQUEST_LIMIT = 20;

function limitAiRequests(req: Request, res: Response, next: () => void) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const current = aiRequestWindows.get(key);
  const window = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + AI_WINDOW_MS }
    : current;

  window.count += 1;
  aiRequestWindows.set(key, window);

  if (window.count > AI_REQUEST_LIMIT) {
    res.status(429).json({ error: 'Too many AI requests. Please try again shortly.' });
    return;
  }

  next();
}

// Parse JSON and urlencoded bodies with sufficient size limit for large PDF documents & text payloads
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// ==================== API ROUTES ====================

// Newsletter AI extraction endpoint for PDF / community bulletin documents
app.post('/api/newsletter/extract-content', limitAiRequests, async (req: Request, res: Response) => {
  try {
    const {
      newsletterId,
      base64Data,
      mimeType,
      fileDataUrl,
      fileName,
      fileType,
      editionTitle,
      monthEdition,
      textContent,
      isReanalysis,
      isNewUpload,
      extraInstructions,
    } = req.body;

    console.log(
      `[Newsletter Pipeline] Step 1: File received for extraction - Title: "${editionTitle || 'Unknown'}", Month: "${monthEdition || 'TBA'}", File: "${fileName || 'none'}", NewsletterID: "${newsletterId || 'auto'}", isNewUpload: ${Boolean(isNewUpload)}`
    );

    let cleanBase64 = typeof base64Data === 'string' ? base64Data.trim() : '';
    let effectiveMime = typeof mimeType === 'string' ? mimeType.trim() : (fileType || 'application/pdf');

    // If cleanBase64 was not passed directly, extract from fileDataUrl
    if (!cleanBase64 && typeof fileDataUrl === 'string') {
      const rawUrl = fileDataUrl.trim();
      if (rawUrl.includes('base64,')) {
        cleanBase64 = rawUrl.split('base64,')[1]?.trim() || '';
        const detectedMime = rawUrl.substring(rawUrl.indexOf(':') + 1, rawUrl.indexOf(';'));
        if (detectedMime) effectiveMime = detectedMime;
      } else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        try {
          console.log(`[Newsletter Pipeline] Step 1a: Fetching raw PDF from remote URL...`);
          const fetchRes = await fetch(rawUrl, { signal: AbortSignal.timeout(15_000) });
          if (fetchRes.ok) {
            const arrayBuf = await fetchRes.arrayBuffer();
            cleanBase64 = Buffer.from(arrayBuf).toString('base64');
            effectiveMime = fetchRes.headers.get('content-type') || 'application/pdf';
          }
        } catch (fetchErr) {
          console.warn('[Newsletter Pipeline] Failed to download remote document URL:', fetchErr);
        }
      }
    }

    // Check edition-specific file if saved earlier
    if (!cleanBase64 && newsletterId) {
      const sanitizedId = String(newsletterId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const specificPath = path.join(UPLOADS_DIR, `newsletter_${sanitizedId}.pdf`);
      if (fs.existsSync(specificPath)) {
        try {
          const buf = fs.readFileSync(specificPath);
          cleanBase64 = buf.toString('base64');
          effectiveMime = 'application/pdf';
        } catch (e) {}
      }
    }

    if (!cleanBase64 || cleanBase64.length < 50) {
      console.error('[Newsletter Pipeline] Missing or invalid document base64 data.');
      res.status(400).json({ error: 'Failed to extract content from uploaded newsletter. Please check file format.' });
      return;
    }

    const payloadBytes = Math.round((cleanBase64.length * 0.75));
    console.log(
      `[Newsletter Pipeline] Step 1b: Document payload ready - Size: ~${Math.round(payloadBytes / 1024)} KB, MIME: ${effectiveMime}`
    );

    const result = await extractNewsletterContent({
      newsletterId: asText(newsletterId, 100),
      base64Data: cleanBase64,
      mimeType: effectiveMime,
      fileName: asText(fileName, 255),
      fileType: effectiveMime,
      editionTitle: asText(editionTitle, 200),
      monthEdition: asText(monthEdition, 100),
      textContent: asText(textContent, 5_000_000),
      isReanalysis: Boolean(isReanalysis),
      isNewUpload: Boolean(isNewUpload),
      extraInstructions: asText(extraInstructions, 10_000),
    });

    console.log(
      `[Newsletter Pipeline] Step 4: Extraction response ready - Month: "${result.monthEdition}", Events: ${result.events.length}, Highlights: ${result.highlights.length}`
    );

    res.json(result);
  } catch (error: any) {
    console.error('[Newsletter Pipeline] Extraction failed with error:', error?.message || error);
    res.status(500).json({ error: 'Failed to extract content from uploaded newsletter. Please check file format.' });
  }
});

// Newsletter PDF upload & permanent filesystem persistence endpoint
app.post('/api/newsletter/upload-pdf', async (req: Request, res: Response) => {
  try {
    const { fileDataUrl, fileName, newsletterId, config } = req.body;
    if (!fileDataUrl || typeof fileDataUrl !== 'string') {
      res.status(400).json({ error: 'Missing PDF file data' });
      return;
    }

    const base64Data = fileDataUrl.includes(',')
      ? fileDataUrl.split(',')[1]
      : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');

    const sanitizedId = (newsletterId || 'current').replace(/[^a-zA-Z0-9_-]/g, '_');
    const editionFileName = `newsletter_${sanitizedId}.pdf`;
    const editionPath = path.join(UPLOADS_DIR, editionFileName);
    const currentPdfPath = path.join(UPLOADS_DIR, 'current_newsletter.pdf');

    // Write file to persistent storage
    fs.writeFileSync(editionPath, buffer);
    fs.writeFileSync(currentPdfPath, buffer);

    const timestamp = Date.now();
    const pdfUrl = `/api/newsletter/pdf/current_newsletter.pdf?v=${timestamp}`;

    // Write accompanying metadata/config if available
    const effectiveConfig = config
      ? { ...config, pdfUrl, fileUrl: pdfUrl, uploadedAt: timestamp }
      : {
          id: sanitizedId,
          fileName: fileName || 'document.pdf',
          pdfUrl,
          fileUrl: pdfUrl,
          fileSize: buffer.length,
          uploadedAt: timestamp,
        };

    const configPath = path.join(UPLOADS_DIR, 'current_newsletter.json');
    fs.writeFileSync(configPath, JSON.stringify(effectiveConfig, null, 2));

    console.log(`[Newsletter] Persisted PDF (${buffer.length} bytes) to disk at ${currentPdfPath}`);

    res.json({
      success: true,
      pdfUrl,
      fileUrl: pdfUrl,
      size: buffer.length,
      fileName: fileName || 'document.pdf',
      config: effectiveConfig,
    });
  } catch (err: any) {
    console.error('Failed to save uploaded newsletter PDF to disk:', err);
    res.status(500).json({ error: 'Failed to persist PDF file.' });
  }
});

// Stream saved newsletter PDF directly with inline browser support
app.get('/api/newsletter/pdf/:filename', (req: Request, res: Response) => {
  try {
    const rawFilename = req.params.filename || 'current_newsletter.pdf';
    const filename = path.basename(rawFilename);
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).send('PDF document not found');
      return;
    }

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': stat.size,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (err: any) {
    console.error('Error serving newsletter PDF:', err);
    res.status(500).send('Error reading PDF document');
  }
});

// Get current saved newsletter edition from disk
app.get('/api/newsletter/current', (req: Request, res: Response) => {
  try {
    const configPath = path.join(UPLOADS_DIR, 'current_newsletter.json');
    const pdfPath = path.join(UPLOADS_DIR, 'current_newsletter.pdf');

    if (fs.existsSync(configPath) && fs.existsSync(pdfPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({ exists: true, config });
      return;
    }
    res.json({ exists: false });
  } catch (err: any) {
    res.json({ exists: false, error: err?.message });
  }
});

// Remove current newsletter PDF from disk
app.delete('/api/newsletter/current', (req: Request, res: Response) => {
  try {
    const configPath = path.join(UPLOADS_DIR, 'current_newsletter.json');
    const pdfPath = path.join(UPLOADS_DIR, 'current_newsletter.pdf');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove newsletter document' });
  }
});

// Translation endpoint for crew members using Google Cloud Translation API (Basic v2)
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { title, description, comments, targetLang } = req.body;
    if (!title && !description && (!comments || comments.length === 0)) {
      res.status(400).json({ error: 'No text provided for translation' });
      return;
    }

    const result = await translateWorkOrderContent({
      title: asText(title, 500),
      description: asText(description, 8_000),
      comments: Array.isArray(comments)
        ? comments.slice(0, 50).map((comment) => asText(comment, 4_000))
        : [],
      targetLang: targetLang === 'en' ? 'en' : 'es',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Translation route error:', error);
    res.status(500).json({ error: 'Translation failed.' });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    backend: 'firebase',
    time: new Date().toISOString()
  });
});

// Config status endpoint to verify Firebase readiness
app.get('/api/firebase-status', (req: Request, res: Response) => {
  const hasEnvKey = Boolean(process.env.VITE_FIREBASE_API_KEY);
  const hasProjectId = Boolean(process.env.VITE_FIREBASE_PROJECT_ID);

  res.json({
    configured: hasEnvKey && hasProjectId,
    provider: 'Firebase Authentication & Cloud Firestore',
    notice: hasEnvKey
      ? 'Firebase credentials configured via environment variables'
      : 'Using src/firebase.ts configuration placeholders. Paste your Firebase web app keys in src/firebase.ts'
  });
});

// ==================== VITE MIDDLEWARE / STATIC ASSETS ====================

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TownLoop Portal server running at http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});

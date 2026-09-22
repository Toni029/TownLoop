/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { translateWorkOrderContent } from './server/translation';
import { extractNewsletterContent } from './server/newsletterExtractor';

dotenv.config();

const app = express();
const PORT = 3000;

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

// Parse JSON and urlencoded bodies with sufficient size limit for PDF documents
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ==================== API ROUTES ====================

// Newsletter AI extraction endpoint for PDF / community bulletin documents
app.post('/api/newsletter/extract-content', limitAiRequests, async (req: Request, res: Response) => {
  try {
    const { fileDataUrl, fileName, fileType, editionTitle, monthEdition, textContent } = req.body;
    if (typeof fileDataUrl === 'string' && fileDataUrl.length > 24_000_000) {
      res.status(413).json({ error: 'Document is too large to analyze.' });
      return;
    }

    const result = await extractNewsletterContent({
      fileDataUrl: asText(fileDataUrl, 24_000_000),
      fileName: asText(fileName, 255),
      fileType: asText(fileType, 100),
      editionTitle: asText(editionTitle, 200),
      monthEdition: asText(monthEdition, 100),
      textContent: asText(textContent, 20_000),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Newsletter extraction route error:', error);
    res.status(500).json({ error: 'Newsletter extraction failed.' });
  }
});

// Translation endpoint for crew members (English to Spanish)
app.post('/api/translate', limitAiRequests, async (req: Request, res: Response) => {
  try {
    const { title, description, comments } = req.body;
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
    console.log(`Cecil Pines Portal server running at http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});

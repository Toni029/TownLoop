const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const key = defineSecret('TOWNLOOP_GOOGLE_TRANSLATE_KEY');
const windows = new Map();
exports.translateWorkOrder = onRequest({ region: 'us-central1', secrets: [key], timeoutSeconds: 45, maxInstances: 2, concurrency: 8,
  cors: ['http://localhost:8082', 'http://127.0.0.1:8082', 'https://townloop.web.app', 'https://townloop.firebaseapp.com'] }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'Please sign in again.' });
  let uid;
  try { uid = (await getAuth().verifyIdToken(token, true)).uid; }
  catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
  try {
    const profile = (await getFirestore().collection('users').doc(uid).get()).data();
    if (!profile || profile.approved !== true || !['admin', 'vip', 'crew'].includes(profile.role))
      return res.status(403).json({ error: 'Translation requires an approved Admin, VIP, or Crew account.' });
    const { title, description = '', comments = [], targetLang = 'es' } = req.body || {};
    if (typeof title !== 'string' || typeof description !== 'string' || !Array.isArray(comments) || comments.length > 50 || comments.some(v => typeof v !== 'string') || !['es', 'en'].includes(targetLang))
      return res.status(400).json({ error: 'Invalid translation request.' });
    const texts = [title, description, ...comments];
    if (texts.reduce((sum, value) => sum + value.length, 0) > 25000)
      return res.status(413).json({ error: 'This ticket is too long to translate in one request.' });
    const now = Date.now();
    for (const [id, value] of windows) if (value.until < now) windows.delete(id);
    const window = windows.get(uid) || { count: 0, until: now + 60000 };
    if (++window.count > 15) return res.status(429).json({ error: 'Please wait a minute before translating again.' });
    windows.set(uid, window);
    const nonempty = texts.map((text, index) => ({ text, index })).filter(v => v.text.trim());
    const translated = [...texts];
    if (nonempty.length) {
      const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key.value() },
        body: JSON.stringify({ q: nonempty.map(v => v.text), target: targetLang, format: 'text' }), signal: AbortSignal.timeout(25000),
      });
      const body = await response.json();
      if (!response.ok || body.data?.translations?.length !== nonempty.length)
        return res.status(502).json({ error: 'Google Translation is unavailable. Please try again shortly.' });
      for (let i = 0; i < nonempty.length; i++) {
        const text = body.data.translations[i].translatedText;
        if (typeof text !== 'string' || !text.trim()) return res.status(502).json({ error: 'Translation returned an incomplete result.' });
        translated[nonempty[i].index] = text;
      }
    }
    return res.json({ title: translated[0], description: translated[1], comments: translated.slice(2), source: 'google-translate' });
  } catch {
    return res.status(503).json({ error: 'Translation could not complete. Please try again shortly.' });
  }
});

import type { Request, Response, NextFunction } from 'express';
import type { UserProfile } from '../src/types';
import firebaseConfig from '../firebase-applet-config.json';
import { canManageNewsletter } from '../src/utils/permissions';

/** Authenticate with Firebase, then check the same saved profile used by the UI. */
export async function requireNewsletterManager(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) {
    res.status(401).json({ error: 'Please sign in before analyzing a newsletter.' });
    return;
  }
  try {
    const apiKey = process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10_000),
    });
    const account = lookup.ok ? (await lookup.json()).users?.[0] : null;
    if (!account?.localId || account.disabled) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }
    const project = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
    const database = process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
    const profileResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents/users/${encodeURIComponent(account.localId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    const fields = profileResponse.ok ? (await profileResponse.json()).fields : null;
    const profile = fields ? Object.fromEntries(Object.entries(fields).map(([key, value]: [string, any]) =>
      [key, value.stringValue ?? value.booleanValue])) : null;
    if (!profile || profile.approved === false || !canManageNewsletter(profile as UserProfile)) {
      res.status(403).json({ error: 'Newsletter analysis requires an approved newsletter manager account.' });
      return;
    }
    next();
  } catch {
    res.status(503).json({ error: 'Could not verify your account. Please try again shortly.' });
  }
}

import type { Request, Response, NextFunction } from 'express';
import type { UserProfile } from '../src/types';
import firebaseConfig from '../firebase-applet-config.json';
import { canManageNewsletter, canTranslateWorkOrder } from '../src/utils/permissions';

/** Authenticate with Firebase, then check the same saved profile used by the UI. */
async function requireRole(req: Request, res: Response, next: NextFunction, role: 'manager' | 'translator' | 'reader' = 'manager', native = false) {
  const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) {
    res.status(401).json({ error: 'Please sign in to access this service.' });
    return;
  }
  try {
    // Only native monitoring middleware can populate this verified value. Raw request headers are never forwarded.
    const verifiedAppCheck = native && typeof res.locals?.verifiedAppCheckToken === 'string' ? res.locals.verifiedAppCheckToken : undefined;
    const attestationHeaders = verifiedAppCheck ? { 'X-Firebase-AppCheck': verifiedAppCheck } : {};
    const apiKey = process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...attestationHeaders },
      body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10_000),
    });
    const account = lookup.ok ? (await lookup.json()).users?.[0] : null;
    if (!account?.localId || account.disabled || account.providerUserInfo?.every((provider: any) => provider.providerId === 'anonymous')) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }
    const project = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
    const database = native ? '(default)' : process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
    const profileResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents/users/${encodeURIComponent(account.localId)}`,
      { headers: { Authorization: `Bearer ${token}`, ...attestationHeaders }, signal: AbortSignal.timeout(10_000) },
    );
    const fields = profileResponse.ok ? (await profileResponse.json()).fields : null;
    const profile = fields ? Object.fromEntries(Object.entries(fields).map(([key, value]: [string, any]) =>
      [key, value.stringValue ?? value.booleanValue])) : null;
    if (!profile || profile.approved !== true || profile.deletionPending === true || (role !== 'reader' && !(role === 'translator' ? canTranslateWorkOrder(profile as UserProfile) : canManageNewsletter(profile as UserProfile)))) {
      res.status(403).json({ error: role === 'translator' ? 'Translation requires an approved Admin, VIP, or Crew account.' : role === 'reader' ? 'An approved account is required to read newsletters.' : 'Newsletter analysis requires an approved newsletter manager account.' });
      return;
    }
    if (native && role === 'manager') {
      res.locals ||= {};
      res.locals.newsletterManagerUid = account.localId;
    }
    next();
  } catch {
    res.status(503).json({ error: 'Could not verify your account. Please try again shortly.' });
  }
}

export const requireNewsletterManager = (req: Request, res: Response, next: NextFunction) => requireRole(req, res, next);
export const requireWorkOrderTranslator = (req: Request, res: Response, next: NextFunction) => requireRole(req, res, next, 'translator');

export const requireNewsletterReader = (req: Request, res: Response, next: NextFunction) => requireRole(req, res, next, 'reader');

// Dedicated native endpoint always verifies canonical roles in (default), never the website database.
export const requireNativeNewsletterManager = (req: Request, res: Response, next: NextFunction) => requireRole(req, res, next, 'manager', true);

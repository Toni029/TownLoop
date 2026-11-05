import backend from '../../newsletter-api.json';
import { Platform } from 'react-native';
import { auth } from '../lib/firebase';
import { approvedUser } from './actions';
export function analysisServiceUrl() {
    const configured = process.env.EXPO_PUBLIC_TOWNLOOP_API_URL?.trim();
    const local = Platform.OS === 'web' && typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
    // Native builds use only the two verified routes to this exact Firebase service.
    // A stale/mistyped EAS override must never redirect Firebase ID tokens elsewhere.
    const trusted = [backend.url, backend.fallbackUrl].filter(Boolean).map(value => value.replace(/\/$/, ''));
    const override = configured?.replace(/\/$/, '');
    const base = Platform.OS !== 'web' ? (override && trusted.includes(override) ? override : backend.url) : configured || (local ? `${location.protocol}//${location.hostname}:3000` : backend.url);
    if (!base)
        throw Error('The HTTPS newsletter analysis service is not configured. No new upload was started. You can turn off AI to publish the original PDF, or retry when the service is ready.');
    const url = new URL(base);
    if ((url.protocol !== 'https:' && !(local && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.search || url.hash)
        throw Error('Newsletter analysis requires a trusted HTTPS service URL.');
    return base.replace(/\/$/, '');
}
/** Retry only transport failures, and only against the verified alternate route
 * to this same deployed function. Never retry HTTP authorization/model errors.
 * Creation references are idempotent; PDF bytes/publication are not sent here. */
export async function newsletterFetch(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<Response> {
    const owner = auth.currentUser?.uid;
    const routes = [backend.url, backend.fallbackUrl].filter(Boolean).map(value => value.replace(/\/$/, ''));
    const primary = routes.find(base => url.startsWith(base + '/api/newsletter/native/'));
    const suffix = primary ? url.slice(primary.length) : '';
    const retrySafe = /^\/api\/newsletter\/native\/(?:capabilities|analysis-jobs(?:\/[a-f0-9]{64})?)$/.test(suffix);
    const alternate = retrySafe ? routes.find(base => base !== primary) : undefined;
    try { return await fetcher(url, init); }
    catch (error) {
        if (auth.currentUser?.uid !== owner) throw Error('Your account changed. Reopen News.');
        if (init.signal?.aborted || !alternate) throw error;
        try { return await fetcher(alternate + suffix, init); }
        catch (fallbackError) {
            if (init.signal?.aborted) throw fallbackError;
            throw Error('TownLoop could not connect to its newsletter service. Check Wi-Fi or mobile data and retry. Your retained PDF and saved analysis progress have not been removed.');
        }
    }
}
export async function preflightAnalysis(bytes = 0, requireJobs = false) {
    const base = analysisServiceUrl();
    const manager = await approvedUser(true, true);
    const user = auth.currentUser;
    if (user?.uid !== String(manager.id)) throw Error('Your account changed. Reopen News.');
    let token = await user?.getIdToken();
    if (!user || !token)
        throw Error('Please sign in again.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
        let response = await newsletterFetch(`${base}/api/newsletter/native/capabilities`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, redirect: 'error' });
        if (auth.currentUser?.uid !== user.uid) throw Error('Your account changed. Reopen News.');
        if (response.status === 401) {
            token = await user.getIdToken(true);
            if (auth.currentUser?.uid !== user.uid) throw Error('Your account changed. Reopen News.');
            response = await newsletterFetch(`${base}/api/newsletter/native/capabilities`, {headers: {Authorization: `Bearer ${token}`}, signal: controller.signal, redirect: 'error'});
        }
        const value = await response.json().catch(() => null);
        if (auth.currentUser?.uid !== user.uid)
            throw Error('Your account changed. Reopen News.');
        if (response.status === 401 || response.status === 403)
            throw Error('Your account could not be authorized for newsletter analysis. Sign in with an approved Admin/VIP account.');
        if (!response.ok || value?.service !== 'townloop-newsletter' || value.projectId !== 'cc-livingcommunity-app' || value.database !== '(default)' || value.version !== 1)
            throw Error('The newsletter analysis service is unavailable or needs its native-backend update. Your uploaded PDF can be retried without uploading again.');
        if (requireJobs && value.analysisJobsVersion !== 1) throw Error('The background newsletter analysis backend update is pending. Your uploaded PDF can be resumed after deployment.');
        if (!value.configured)
            throw Error('Gemini is not configured on the secure server. The PDF can be retained for retry or published with AI turned off.');
        if (!Number.isSafeInteger(value.maxPdfBytes) || value.maxPdfBytes <= 0)
            throw Error('The analysis service did not declare a valid PDF size limit.');
        if (bytes > value.maxPdfBytes)
            throw Error(`This PDF exceeds the analysis service limit of ${(value.maxPdfBytes / 1000000).toFixed(1)} MB. The original PDF was not modified. Turn off AI to publish it without analysis.`);
        return base;
    }
    finally {
        clearTimeout(timer);
    }
}

import { Platform } from 'react-native';
import { auth } from '../lib/firebase';
import { approvedUser } from './actions';
export function analysisServiceUrl() {
    const configured = process.env.EXPO_PUBLIC_TOWNLOOP_API_URL?.trim();
    const local = Platform.OS === 'web' && typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
    const base = configured || (local ? `${location.protocol}//${location.hostname}:3000` : '');
    if (!base)
        throw Error('The HTTPS newsletter analysis service is not configured. No new upload was started. You can turn off AI to publish the original PDF, or retry when the service is ready.');
    const url = new URL(base);
    if ((url.protocol !== 'https:' && !(local && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.search || url.hash)
        throw Error('Newsletter analysis requires a trusted HTTPS service URL.');
    return base.replace(/\/$/, '');
}
export async function preflightAnalysis(bytes = 0) {
    const base = analysisServiceUrl();
    await approvedUser(true);
    const user = auth.currentUser, token = await user?.getIdToken();
    if (!user || !token)
        throw Error('Please sign in again.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(`${base}/api/newsletter/native/capabilities`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, redirect: 'error' });
        const value = await response.json().catch(() => null);
        if (auth.currentUser?.uid !== user.uid)
            throw Error('Your account changed. Reopen News.');
        if (response.status === 401 || response.status === 403)
            throw Error('Your account could not be authorized for newsletter analysis. Sign in with an approved Admin/VIP account.');
        if (!response.ok || value?.service !== 'townloop-newsletter' || value.projectId !== 'cc-livingcommunity-app' || value.database !== '(default)' || value.version !== 1)
            throw Error('The newsletter analysis service is unavailable or needs its native-backend update. Your uploaded PDF can be retried without uploading again.');
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

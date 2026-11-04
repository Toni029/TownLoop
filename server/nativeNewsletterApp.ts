/** Shared authenticated app for the isolated Firebase function and local server. */
import express from 'express';
import { NATIVE_PDF_LOADER_VERSION } from './nativeNewsletter.ts';
import { nativeNewsletterRouter } from './nativeNewsletterRoutes.ts';
export const app = express();
export {runNewsletterJob} from './newsletterJobs.ts';
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'townloop-native-api', projectId: 'cc-livingcommunity-app', pdfLoaderVersion: NATIVE_PDF_LOADER_VERSION }));
app.use('/api/newsletter/native', nativeNewsletterRouter);
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 500).json({ error: 'Native newsletter requests must contain only a retained PDF reference. Your published newsletter is unchanged.' });
});

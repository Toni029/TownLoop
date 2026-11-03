/** Optional standalone native API. This does not serve or change the original website. */
import express from 'express';
import dotenv from 'dotenv';
import { nativeNewsletterRouter } from './nativeNewsletterRoutes.ts';
dotenv.config();
const app = express();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'townloop-native-api', projectId: 'cc-livingcommunity-app' }));
app.use('/api/newsletter/native', nativeNewsletterRouter);
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 500).json({ error: 'Native newsletter requests must contain only a retained PDF reference. Your published newsletter is unchanged.' });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => console.log('TownLoop native API listening on port ' + port));

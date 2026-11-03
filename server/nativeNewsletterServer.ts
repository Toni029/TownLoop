/** Optional standalone native API. This does not serve or change the original website. */
import dotenv from 'dotenv';
import { app } from './nativeNewsletterApp.ts';
dotenv.config();
const port = Number(process.env.PORT || 3000);
app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => console.log('TownLoop native API listening on port ' + port));

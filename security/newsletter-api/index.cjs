const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {onTaskDispatched}=require('firebase-functions/v2/tasks');
const {app}=require('./lib/native-app.cjs');
const {runNewsletterJob}=require('./lib/native-app.cjs');
const gemini=defineSecret('GEMINI_API_KEY');
// Isolated analysis API and IAM-protected queue; no schedules, deletion workers or website handlers.
exports.newsletterApi=onRequest({
  region:'us-central1',memory:'2GiB',timeoutSeconds:360,
  concurrency:1,minInstances:0,maxInstances:2,
  serviceAccount:'townloop-newsletter-api@cc-livingcommunity-app.iam.gserviceaccount.com',
  secrets:[gemini],invoker:'public',cors:false,
},app);
exports.runNewsletterAnalysis=onTaskDispatched({
  region:'us-central1',memory:'2GiB',timeoutSeconds:360,concurrency:1,maxInstances:1,
  serviceAccount:'townloop-newsletter-analysis@cc-livingcommunity-app.iam.gserviceaccount.com',
  secrets:[gemini],invoker:['townloop-newsletter-api@cc-livingcommunity-app.iam.gserviceaccount.com'],
  retryConfig:{maxAttempts:8,minBackoffSeconds:60,maxBackoffSeconds:300,maxDoublings:2},
  rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1},
},request=>runNewsletterJob(request.data));

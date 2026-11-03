const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {app}=require('./lib/native-app.cjs');
const gemini=defineSecret('GEMINI_API_KEY');
// An isolated codebase: no schedules, deletion workers, admin Firestore access or website handlers.
exports.newsletterApi=onRequest({
  region:'us-central1',memory:'2GiB',timeoutSeconds:360,
  concurrency:1,minInstances:0,maxInstances:2,
  serviceAccount:'townloop-newsletter-api@cc-livingcommunity-app.iam.gserviceaccount.com',
  secrets:[gemini],invoker:'public',cors:false,
},app);

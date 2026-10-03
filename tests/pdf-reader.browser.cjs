// Run with NEWSLETTER_TEST_PDF pointing to the 12-page October 2026 newsletter.
// Requires Playwright and the local dev server at localhost:3000; Firebase is mocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-features=LocalNetworkAccessChecks']});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR:',e.message)});page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE:',msg.text())});
 await page.route('**/__reader-test',route=>route.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
 import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
 const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');const {createRoot}=ReactDOM;
 await import('/src/index.css');const {NewsletterGalleryView}=await import('/src/components/NewsletterGalleryView.tsx');
 function Test(){const [open,setOpen]=React.useState(false);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setOpen(true)},'Open PDF'),open&&React.createElement(NewsletterGalleryView,{title:'October 2026 Newsletter',onClose:()=>setOpen(false)}));}
 createRoot(document.getElementById('root')).render(React.createElement(Test));</script></body></html>`}))
 await page.route('**/src/hooks/useNewsletterPdf.ts',route=>route.fulfill({contentType:'application/javascript',body:"export function useNewsletterPdf(){return {activePdfUrl:'/__october.pdf',isLoading:false}}"}));
 await page.route('**/__october.pdf',route=>route.fulfill({contentType:'application/pdf',body:fs.readFileSync(process.env.NEWSLETTER_TEST_PDF)}));
 await page.goto('http://localhost:3000/__reader-test');
 await page.getByRole('button',{name:'Open PDF',exact:true}).click();
 await page.locator('[data-pdf-page="1"] canvas[data-rendered="true"]').waitFor({timeout:60000});
 assert.equal(await page.locator('[data-pdf-page]').count(),12);
 assert.equal(await page.locator('object,iframe,embed').count(),0);
 assert.equal(context.pages().length,1);
 await page.screenshot({path:'/tmp/townloop-reader-desktop.png'});
 await page.getByLabel('Go to page').selectOption('12');
 await page.locator('[data-pdf-page="12"] canvas[data-rendered="true"]').waitFor();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await page.getByText('125%',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Fit width',exact:true}).click();
 await page.getByRole('button',{name:'Close',exact:true}).click();
 assert.equal(await page.locator('canvas').count(),0);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Open PDF',exact:true}).click();
 await page.locator('[data-pdf-page="1"] canvas[data-rendered="true"]').waitFor();
 await page.screenshot({path:'/tmp/townloop-reader-phone.png'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await page.getByLabel('Go to page').selectOption('8');
 await page.locator('[data-pdf-page="8"] canvas[data-rendered="true"]').waitFor();
 assert.equal(context.pages().length,1);assert.deepEqual(errors,[]);
 console.log('PASS: 12 real PDF pages; desktop and phone rendering; jump to pages 8/12; zoom; close/reopen; no plugin or new tab; no browser errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

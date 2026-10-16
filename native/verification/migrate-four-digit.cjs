/** Administrative one-time migration. Requires an already-authorized Firebase CLI login.
 * Usage: node migrate-four-digit.cjs /path/to/firebase-tools [--apply]
 * No service-account credentials are copied into the application.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const auth = require(path.join(process.argv[2], 'lib/auth.js'));
const project = 'cc-livingcommunity-app';
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
(async () => {
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw Error('Firebase CLI login is required.');
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  async function api(url, method = 'GET', body) {
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404 && method === 'GET') return null;
    if (!r.ok) throw Error(`Administrative request failed: HTTP ${r.status}`);
    return r.json();
  }
  async function audit() {
    const docs = []; let page = '';
    do {
      const result = await api(`${base}/work_orders?pageSize=1000&mask.fieldPaths=code&mask.fieldPaths=ticketNumber${page ? '&pageToken=' + encodeURIComponent(page) : ''}`);
      docs.push(...result.documents || []); page = result.nextPageToken || '';
    } while (page);
    return docs.sort((a,b) => a.name.localeCompare(b.name));
  }
  const before = await audit(); const reserved = new Set();
  for (const d of before) {
    for (const n of [Number(d.fields?.ticketNumber?.integerValue), Number((d.fields?.code?.stringValue || '').replace(/^WO-/i, ''))])
      if (Number.isInteger(n) && n >= 1000 && n <= 9999) reserved.add(n);
  }
  console.log(JSON.stringify({ historicalTickets: before.length, reservedNumbers: reserved.size, firstAvailable: Array.from({ length: 9000 }, (_,i) => i + 1000).find(n => !reserved.has(n)) || null }));
  if (!process.argv.includes('--apply')) return;
  if (reserved.size > 450) throw Error('Large migration requires a separate staged plan; no writes performed.');
  const release = await api(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`);
  const rules = await api(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  const expected = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  assert.equal(rules.source.files[0].content, expected, 'Deploy and verify the reviewed rules before migration.');
  const counterPath = `${base}/counters/work_orders_four_digit`;
  if (await api(counterPath)) throw Error('New counter already exists. Refusing to reset or overwrite it.');
  const oldCounter = await api(`${base}/counters/work_orders`);
  const writes = [...reserved].map(n => ({ update: {
    name: `projects/${project}/databases/(default)/documents/work_order_numbers/${n}`,
    fields: { historical: { booleanValue: true } },
  }, currentDocument: { exists: false } }));
  writes.push({ update: {
    name: `projects/${project}/databases/(default)/documents/counters/work_orders_four_digit`,
    fields: { lastNumber: { integerValue: '999' }, orderId: { stringValue: '' }, ready: { booleanValue: true } },
  }, currentDocument: { exists: false } });
  // One atomic commit: never expose a ready allocator before every reservation exists.
  await api(`${base}:commit`, 'POST', { writes });
  assert.deepEqual(await audit(), before, 'Historical data changed during verification; inspect before proceeding.');
  assert.deepEqual(await api(`${base}/counters/work_orders`), oldCounter, 'Legacy counter changed during verification.');
  const counter = await api(counterPath);
  assert.equal(counter.fields.ready.booleanValue, true);
  for (const n of reserved) assert.equal((await api(`${base}/work_order_numbers/${n}`)).fields.historical.booleanValue, true);
  console.log('Verified: reservations and counter initialized atomically; historical tickets and legacy counter unchanged.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });

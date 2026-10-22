import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function evaluate(source: string, globals: Record<string, any>, modules: Record<string, any> = {}) {
  const exports: any = {};
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: (name: string) => modules[name], console: { warn() {}, error() {} }, ...globals });
  return exports;
}
const profileSource = readFileSync(new URL('../../src/components/ProfileAvatar.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ProfileAvatar.tsx', profileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string) {
  let found = '';
  function visit(node: any) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = `const ${node.getText(ast)};`;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(found, name); return found;
}
function uiFixture(handler: string, kind: 'maintenance' | 'office', ack: boolean | Promise<boolean>) {
  const updates: string[] = [], ids: string[] = [];
  const context = {
    currentUser: { id: 'resident', name: 'Resident' }, auth: { currentUser: { uid: 'resident' } },
    inboxSendVersion: { current: { compose: 1, maintenance: 1, office: 1 } },
    inboxSendLocks: { current: new Set() }, pendingInboxIds: { current: new Map() },
    composeRecipient: { category: kind }, composeBody: 'Keep my draft', composeSubject: '',
    chatReplyText: 'Keep my draft', officeReplyText: 'Keep my draft', isSendingReply: false, isSendingOfficeReply: false,
    activeMaintenanceChat: null, activeOfficeChat: null, userIsCrew: false, userIsVip: false,
    effectiveName: 'Resident', effectiveEmail: '', effectiveAddress: '', effectivePhone: '', profilePhotoUrl: '',
    getResidentChatDocId: (resident: any) => resident.id,
    setMessages: () => updates.push('messages'), setComposeBody: () => updates.push('clear-compose'),
    setComposeSubject: () => updates.push('clear-subject'), setActiveView: () => {}, setInboxFilter: () => {},
    setChatReplyText: () => updates.push('clear-maintenance'), setOfficeReplyText: () => updates.push('clear-office'),
    setIsSendingReply: () => {}, setIsSendingOfficeReply: () => {},
    showToast: (text: string) => updates.push(text),
    sendMaintenanceChatMessage: async (params: any) => { ids.push(params.messageId); return ack; },
    sendOfficeChatMessage: async (params: any) => { ids.push(params.messageId); return ack; },
  };
  const api = evaluate(`${declaration('confirmedInboxSend')}\n${declaration(handler)}\nexports.run = ${handler};`, context);
  return { context, updates, ids, run: () => api.run({ preventDefault() {} }) };
}

test('maintenance and office compose/reply retain drafts and publish no optimistic success when acknowledgement is false', async () => {
  for (const [handler, kind] of [
    ['handleSendComposedMessage', 'maintenance'], ['handleSendComposedMessage', 'office'],
    ['handleSendInlineMaintenanceReply', 'maintenance'], ['handleSendInlineOfficeReply', 'office'],
  ] as const) {
    const f = uiFixture(handler, kind, false);
    await f.run(); await f.run();
    assert.equal(f.ids.length, 2); assert.equal(f.ids[0], f.ids[1]);
    assert.ok(f.updates.every(value => /not confirmed/.test(value)), f.updates.join(','));
  }
});

test('acknowledgement waits before clearing and stale recipient/session or edited-text versions cannot clear a draft', async () => {
  for (const stale of [false, true]) {
    let resolve!: (value: boolean) => void;
    const f = uiFixture('handleSendComposedMessage', 'office', new Promise<boolean>(done => { resolve = done; }));
    const sending = f.run();
    assert.equal(f.updates.length, 0);
    if (stale) f.context.inboxSendVersion.current.compose++;
    resolve(true); await sending;
    assert.equal(f.updates.includes('clear-compose'), !stale);
    assert.equal(f.updates.includes('messages'), !stale);
  }
});

test('both real inbox services deduplicate stable IDs and reject a session switch before transaction writes', async () => {
  for (const name of ['office', 'maintenance']) {
    const auth = { currentUser: { uid: 'resident' } };
    let stored: any = null, writes = 0, fail = false, switchSession = false;
    const modules = {
      '../firebase': { auth, db: {}, isFirebaseConfigured: () => true }, '../types': {},
      '../utils/permissions': { getUserRole: () => 'resident' }, './maintenanceChat': { formatMessageTime: () => 'Now' },
      './inboxIntegrity': { inboxUid: (user: any) => user.id, inboxActor: async () => ({ id: 'resident', role: 'resident', name: 'Resident' }), residentThreadRef: async () => ({ id: 'resident' }) },
      'firebase/firestore': { runTransaction: async (_db: any, fn: any) => {
        if (fail) throw Error('offline');
        return fn({ get: async () => {
          if (switchSession) auth.currentUser.uid = 'different';
          return { exists: () => !!stored, data: () => stored };
        }, set: (_ref: any, data: any) => { writes++; stored = data; }, update: (_ref: any, data: any) => { writes++; stored = { ...stored, ...data }; } });
      } },
    };
    const source = readFileSync(new URL(`../../src/services/${name}Chat.ts`, import.meta.url), 'utf8');
    const api = evaluate(source, {}, modules);
    const send = api[name === 'office' ? 'sendOfficeChatMessage' : 'sendMaintenanceChatMessage'];
    const params = { sender: { id: 'resident' }, resident: { id: 'resident' }, body: 'Keep my draft', messageId: 'stable_retry_id' };
    fail = true; assert.equal(await send(params), false); assert.equal(writes, 0);
    fail = false; assert.equal(await send(params), true); assert.equal(await send(params), true);
    assert.equal(writes, 1); assert.equal(stored.messages.length, 1);
    switchSession = true;
    assert.equal(await send({ ...params, messageId: 'different_id' }), false);
    assert.equal(writes, 1);
  }
});

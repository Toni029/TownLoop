/** Check by default. Apply only after explicit owner approval; no file or resident reads. */
import { pathToFileURL } from 'node:url';
export const PROJECT = 'cc-livingcommunity-app';
export const LOOKUP_ROLE = 'roles/firebaserules.firestoreServiceAgent';
export function missingLookupBinding(policy, projectNumber) {
  const member = `serviceAccount:service-${projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com`;
  return !policy.bindings?.some(binding => binding.role === LOOKUP_ROLE && !binding.condition && binding.members?.includes(member));
}
export function withLookupBinding(policy, projectNumber) {
  // Preserve every existing binding, condition, policy version and concurrency etag.
  const result = structuredClone(policy);
  if (!result.etag) throw Error('Missing IAM concurrency etag; stop');
  if (!missingLookupBinding(result, projectNumber)) return result;
  const member = `serviceAccount:service-${projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com`;
  const existing = result.bindings?.find(binding => binding.role === LOOKUP_ROLE && !binding.condition);
  if (existing) existing.members = [...existing.members || [], member];
  else (result.bindings ||= []).push({ role: LOOKUP_ROLE, members: [member] });
  return result;
}
export async function repair(args = process.argv.slice(2)) {
  const token = process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;
  if (!token) throw Error('Existing authorized Google operator session required');
  if (args.includes('--apply') && (!args.includes('--approve') || args[args.indexOf('--approve') + 1] !== PROJECT))
    throw Error('Explicit --apply --approve cc-livingcommunity-app required');
  async function api(url, body) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    if (!r.ok) throw Error(`IAM prerequisite operation failed: HTTP ${r.status}`);
    return r.json();
  }
  const base = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`;
  const { projectNumber } = await api(base);
  if (!/^\d+$/.test(projectNumber || '')) throw Error('Unverified project number');
  const read = () => api(base + ':getIamPolicy', { options: { requestedPolicyVersion: 3 } });
  const before = await read();
  if (args.includes('--apply') && missingLookupBinding(before, projectNumber)) {
    await api(base + ':setIamPolicy', { policy: withLookupBinding(before, projectNumber) });
    if (missingLookupBinding(await read(), projectNumber)) throw Error('Role update verification failed; stop');
    console.log('Storage Firestore lookup role granted only to the existing Storage service agent.');
  } else {
    const missing = missingLookupBinding(before, projectNumber);
    console.log(JSON.stringify({ storageFirestoreLookupRolePresent: !missing, changesMade: false }));
    if (missing) process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await repair();

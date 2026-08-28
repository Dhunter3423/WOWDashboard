// Netlify Function v2 — shared candidate-list snapshot on Netlify Blobs.
// OPEN by design: no access key. Protect the SITE at the Netlify level
// (password protection / Identity) rather than gating the endpoint.
// Storage model: ONE snapshot (latest full list). Whoever imports overwrites
// it for everyone. A candidate publish keeps the jobs and vice versa (merge).
import { getStore } from '@netlify/blobs';

export const config = { path: '/api/candidates' };

const STORE = 'ta-candidates';
const SNAP  = 'snapshot';
const MAX_BYTES = 8 * 1024 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req) => {
  const store = getStore(STORE);

  if (req.method === 'GET') {
    const snap = await store.get(SNAP, { type: 'json' });
    return json(snap || {}); // {} before anything is published
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = JSON.parse(raw); }
    catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || (!Array.isArray(body.records) && !Array.isArray(body.jobs)))
      return json({ error: 'Expected { records: [...] } and/or { jobs: [...] }' }, 400);
    const prev = (await store.get(SNAP, { type: 'json' })) || {};
    const snap = { ...prev, ts: Date.now() };
    if (Array.isArray(body.records)) {
      snap.records = body.records;
      if (typeof body.label === 'string') snap.label = body.label;
    }
    if (Array.isArray(body.jobs)) {
      snap.jobs = body.jobs;
      if (typeof body.jobsLabel === 'string') snap.jobsLabel = body.jobsLabel;
    }
    await store.setJSON(SNAP, snap);
    return json({ ok: true, records: (snap.records || []).length, jobs: (snap.jobs || []).length });
  }

  if (req.method === 'DELETE') {
    await store.delete(SNAP);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

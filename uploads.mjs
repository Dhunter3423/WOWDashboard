// Netlify Function v2 — archive of raw upload files (CATS exports / tool CSVs) on Netlify Blobs.
// OPEN by design: no access key. Protect the SITE at the Netlify level.
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

export const config = { path: '/api/uploads' };

const STORE = 'ta-uploads';
const INDEX = 'index';
const MAX = 50;                     // keep the 50 most recent uploads
const MAX_BYTES = 12 * 1024 * 1024; // per-file cap (base64 inflates ~33%)

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default async (req) => {
  const store = getStore(STORE);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const f = await store.get('file:' + id, { type: 'json' });
      if (!f) return json({ error: 'Not found' }, 404);
      return json(f);
    }
    const idx = await store.get(INDEX, { type: 'json' });
    return json(idx || []);
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: 'Payload too large' }, 413);
    let b;
    try { b = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!b || typeof b.content !== 'string' || !b.name)
      return json({ error: 'Expected { name, content }' }, 400);
    const id = randomUUID();
    const enc = b.enc || (/xls/i.test(b.kind || '') ? 'base64' : 'text');
    const rec = {
      id, name: String(b.name), kind: String(b.kind || 'file'),
      mime: String(b.mime || 'application/octet-stream'), enc,
      content: b.content, count: b.count ?? null, ts: Date.now(), size: b.content.length,
    };
    await store.setJSON('file:' + id, rec);
    let idx = (await store.get(INDEX, { type: 'json' })) || [];
    idx.unshift({ id, name: rec.name, kind: rec.kind, ts: rec.ts, size: rec.size, count: rec.count, enc });
    while (idx.length > MAX) { const drop = idx.pop(); try { await store.delete('file:' + drop.id); } catch {} }
    await store.setJSON(INDEX, idx);
    return json({ ok: true, id });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id required' }, 400);
    try { await store.delete('file:' + id); } catch {}
    let idx = (await store.get(INDEX, { type: 'json' })) || [];
    idx = idx.filter(x => x.id !== id);
    await store.setJSON(INDEX, idx);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

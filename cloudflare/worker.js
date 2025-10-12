// Cloudflare Worker — backend completo (API + D1 + R2 + Visual Weather)

function json(data, status = 200, extraHeaders) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization' });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) h.set(k, v);
  return new Response(JSON.stringify(data), { status, headers: h });
}

const ok = (d) => json(d, 200);
const bad = (m, s = 400) => json({ error: m }, s);

async function sha256(str) {
  const enc = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// Minimal HS256 JWT using Web Crypto
async function signJWT(payload, secret, expSec = 12 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expSec };
  const enc = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const h = enc(header);
  const p = enc(body);
  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${b64}`;
}

async function verifyJWT(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const data = `${h}.${p}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/')))));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function corsPreflight(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization' } });
  }
  return null;
}

function normalizeCondition(text, precipprob) {
  try { const p = Number(precipprob || 0); if (!isNaN(p) && p >= 30) return 'Chuvoso'; } catch {}
  if (!text) return 'Indeterminado';
  const t = text.toLowerCase();
  if (t.includes('rain') || t.includes('storm') || t.includes('shower') || t.includes('chuv')) return 'Chuvoso';
  if (t.includes('cloud') || t.includes('overcast') || t.includes('nublado') || t.includes('cloudy')) return 'Nublado';
  if (t.includes('sun') || t.includes('clear') || t.includes('ensolar')) return 'Ensolarado';
  return 'Indeterminado';
}

export default {
  async fetch(request, env) {
    const pre = corsPreflight(request); if (pre) return pre;
    const url = new URL(request.url);
    const path = url.pathname;

    // Health
    if (path === '/health') {
      try {
        const count = await env.DB.prepare('SELECT COUNT(1) as c FROM appointments').first();
        return ok({ status: 'ok', now: new Date().toISOString(), appointments: count?.c || 0 });
      } catch { return ok({ status: 'ok', now: new Date().toISOString() }); }
    }

    // Static read from R2: /uploads/<key>
    if (path.startsWith('/uploads/')) {
      const key = decodeURIComponent(path.replace(/^\/uploads\//, ''));
      const obj = await env.UPLOADS.get(key);
      if (!obj) return bad('not found', 404);
      const h = new Headers({ 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=86400' });
      if (obj.httpMetadata && obj.httpMetadata.contentType) h.set('content-type', obj.httpMetadata.contentType);
      return new Response(obj.body, { status: 200, headers: h });
    }

    // Admin login
    if (path === '/api/admin/login' && request.method === 'POST') {
      try {
        const { password } = await request.json();
        if (!password) return bad('password required', 400);
        const okPass = env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD;
        if (!okPass) return bad('invalid password', 401);
        const token = await signJWT({ role: 'admin' }, env.JWT_SECRET || 'dev_secret_change_me');
        return ok({ token });
      } catch { return bad('invalid request', 400); }
    }

    // Middleware: auth for admin routes
    async function requireAdmin() {
      const auth = request.headers.get('authorization') || '';
      const parts = auth.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
      const payload = await verifyJWT(parts[1], env.JWT_SECRET || 'dev_secret_change_me');
      if (!payload || payload.role !== 'admin') return null;
      return payload;
    }

    // Create appointment (multipart)
    if (path === '/api/appointments' && request.method === 'POST') {
      try {
        const form = await request.formData();
        const nomeCliente = String(form.get('nomeCliente') || '');
        const telefoneCliente = String(form.get('telefoneCliente') || '');
        const servicoId = String(form.get('servicoId') || '');
        const data = String(form.get('data') || '');
        const horario = String(form.get('horario') || '');
        const observacoes = String(form.get('observacoes') || '');
        let status = 'Pendente';
        let comprovanteKey = null;

        const file = form.get('comprovante');
        if (file && typeof file === 'object' && 'stream' in file) {
          const ct = (file.type || '').toLowerCase();
          const name = (file.name || '').toLowerCase();
          const ext = (name.split('.').pop() || '').toLowerCase();
          if (file.size && file.size > 1 * 1024 * 1024) return bad('Arquivo muito grande. O limite é 1 MB.', 413);
          const isPdfByCT = ct === 'application/pdf';
          const isPdfByExt = ext === 'pdf';
          if (!(isPdfByCT || isPdfByExt)) return bad('Tipo de arquivo inválido. Envie apenas PDF.', 400);
          const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const key = `comprovantes/${base}.${isPdfByExt ? 'pdf' : (ext || 'pdf')}`;
          await env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: isPdfByCT ? 'application/pdf' : (ct || 'application/pdf') } });
          comprovanteKey = key;
          status = 'Reservado';
        }

        const id = (Date.now().toString(36) + '-' + Math.round(Math.random() * 1e6).toString(36));
        const createdAt = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO appointments (id, nome_cliente, telefone_cliente, servico_id, horario, data, observacoes, status, comprovante_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, nomeCliente, telefoneCliente, servicoId, horario, data, observacoes, status, comprovanteKey, createdAt).run();

        return json({ id, nomeCliente, telefoneCliente, servicoId, horario, data, observacoes, status, comprovantePath: comprovanteKey ? ('/uploads/' + comprovanteKey) : null, createdAt }, 201);
      } catch (e) {
        return bad('failed to create', 500);
      }
    }

    // List appointments (admin)
    if (path === '/api/appointments' && request.method === 'GET') {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const rs = await env.DB.prepare(`SELECT id, nome_cliente as nomeCliente, telefone_cliente as telefoneCliente, servico_id as servicoId, horario, data, observacoes, status, comprovante_key as comprovanteKey, created_at as createdAt FROM appointments ORDER BY data ASC, horario ASC`).all();
      const items = (rs?.results || []).map(r => ({ ...r, comprovantePath: r.comprovanteKey ? ('/uploads/' + r.comprovanteKey) : null }));
      return ok(items);
    }

    // Public appointments
    if (path === '/api/appointments/public' && request.method === 'GET') {
      const rs = await env.DB.prepare(`SELECT id, nome_cliente as nomeCliente, servico_id as servicoId, data, horario, status FROM appointments`).all();
      return ok(rs?.results || []);
    }

    // View comprovante (admin)
    if (path.match(/^\/api\/appointments\/.+\/comprovante$/) && request.method === 'GET') {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const id = path.split('/')[3];
      const row = await env.DB.prepare(`SELECT comprovante_key as key FROM appointments WHERE id = ?`).bind(id).first();
      if (!row || !row.key) return bad('comprovante not found', 404);
      const obj = await env.UPLOADS.get(row.key);
      if (!obj) return bad('not found', 404);
      const headers = new Headers({ 'access-control-allow-origin': '*', 'content-disposition': `inline; filename="${row.key.split('/').pop()}"` });
      if (obj.httpMetadata?.contentType) headers.set('content-type', obj.httpMetadata.contentType);
      return new Response(obj.body, { status: 200, headers });
    }

    // Confirm appointment (admin)
    if (path.match(/^\/api\/appointments\/.+\/confirm$/) && request.method === 'POST') {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const id = path.split('/')[3];
      await env.DB.prepare(`UPDATE appointments SET status = 'Confirmado' WHERE id = ?`).bind(id).run();
      const row = await env.DB.prepare(`SELECT id, nome_cliente as nomeCliente, telefone_cliente as telefoneCliente, servico_id as servicoId, horario, data, observacoes, status, comprovante_key as comprovanteKey, created_at as createdAt FROM appointments WHERE id = ?`).bind(id).first();
      if (!row) return bad('not found', 404);
      row.comprovantePath = row.comprovanteKey ? ('/uploads/' + row.comprovanteKey) : null;
      return ok(row);
    }

    // Mark appointment as completed (admin)
    if (path.match(/^\/api\/appointments\/.+\/complete$/) && request.method === 'POST') {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const id = path.split('/')[3];
      await env.DB.prepare(`UPDATE appointments SET status = 'Concluído' WHERE id = ?`).bind(id).run();
      const row = await env.DB.prepare(`SELECT id, nome_cliente as nomeCliente, telefone_cliente as telefoneCliente, servico_id as servicoId, horario, data, observacoes, status, comprovante_key as comprovanteKey, created_at as createdAt FROM appointments WHERE id = ?`).bind(id).first();
      if (!row) return bad('not found', 404);
      row.comprovantePath = row.comprovanteKey ? ('/uploads/' + row.comprovanteKey) : null;
      return ok(row);
    }

    // Delete appointment (admin)
    if (path.match(/^\/api\/appointments\/.+$/) && request.method === 'DELETE') {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const id = path.split('/')[3];
      const row = await env.DB.prepare(`SELECT comprovante_key as key FROM appointments WHERE id = ?`).bind(id).first();
      await env.DB.prepare(`DELETE FROM appointments WHERE id = ?`).bind(id).run();
      if (row && row.key) { try { await env.UPLOADS.delete(row.key); } catch {} }
      return ok({ ok: true });
    }

    // Visual weather proxy
    if (path === '/api/visual-weather' && request.method === 'GET') {
      const lat = url.searchParams.get('lat');
      const lon = url.searchParams.get('lon');
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!lat || !lon) return bad('lat and lon are required', 400);
      if (!env.VISUALCROSSING_API_KEY) return bad('no api key', 400);
      const startPath = start ? `/${start}` : '';
      const endPath = end ? `/${end}` : '';
      const api = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(lat)},${encodeURIComponent(lon)}${startPath}${endPath}?unitGroup=metric&include=days&elements=datetime,conditions,temp,tempmax,tempmin,precip,precipprob&key=${encodeURIComponent(env.VISUALCROSSING_API_KEY)}&contentType=json`;
      const r = await fetch(api);
      if (!r.ok) return bad('visualcrossing_error', 502);
      const j = await r.json();
      const days = (j.days || []).map(d => ({ date: d.datetime, conditions: d.conditions || '', precipprob: d.precipprob, conditionSimple: normalizeCondition(d.conditions, d.precipprob), temp: d.temp, tempmax: d.tempmax, tempmin: d.tempmin, precip: d.precip }));
      return ok({ lat: j.latitude || parseFloat(lat), lon: j.longitude || parseFloat(lon), days });
    }

    // Admin: trigger cleanup manually (requires admin bearer token)
    if (path === '/api/admin/cleanup' && (request.method === 'POST' || request.method === 'GET')) {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const d = parseInt(url.searchParams.get('days') || '10', 10);
      const days = isNaN(d) ? 10 : d;
      const stats = await cleanupOldComprovantes(env, days);
      return ok({ ok: true, days, ...stats });
    }

    // Admin: prune old appointments (date before provided 'before' or today)
    if (path === '/api/admin/prune-appointments' && (request.method === 'POST' || request.method === 'GET')) {
      const admin = await requireAdmin();
      if (!admin) return bad('unauthorized', 401);
      const before = url.searchParams.get('before') || (new Date().toISOString().slice(0, 10));
      const res = await pruneOldAppointments(env, before);
      return ok({ ok: true, before, ...res });
    }

    return bad('Not found', 404);
  }
  ,
  // Scheduled cleanup for old comprovantes in R2 (older than 10 days)
  async scheduled(controller, env, ctx) {
    // Run both: comprovante cleanup and appointment pruning
    ctx.waitUntil((async () => {
      try { await cleanupOldComprovantes(env, 10); } catch {}
      try {
        // Use today's date in UTC (cron runs at 03:00 UTC ~= 00:00 BRT)
        const today = new Date().toISOString().slice(0, 10);
        await pruneOldAppointments(env, today);
      } catch {}
    })());
  }
};

// Helper: cleanup comprovantes older than N days from R2 and clear DB references
async function cleanupOldComprovantes(env, days = 10) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let cursor = undefined;
  let removed = 0;
  let scanned = 0;
  do {
    const list = await env.UPLOADS.list({ prefix: 'comprovantes/', cursor });
    cursor = list.cursor;
    const objects = list.objects || list; // compatibility safeguard
    for (const obj of objects) {
      scanned++;
      const uploaded = obj.uploaded instanceof Date ? obj.uploaded.getTime() : (obj.uploaded ? new Date(obj.uploaded).getTime() : 0);
      if (uploaded && uploaded < cutoff) {
        try { await env.UPLOADS.delete(obj.key); removed++; } catch {}
        try { await env.DB.prepare(`UPDATE appointments SET comprovante_key = NULL WHERE comprovante_key = ?`).bind(obj.key).run(); } catch {}
      }
    }
  } while (cursor);
  return { removed, scanned };
}

// Helper: delete appointments older than a given date (data < beforeDate)
// Also deletes associated comprovantes from R2
async function pruneOldAppointments(env, beforeDate /* format YYYY-MM-DD */) {
  // find rows to delete first
  const rows = await env.DB.prepare(`SELECT id, comprovante_key as key FROM appointments WHERE data < ?`).bind(beforeDate).all();
  const list = rows?.results || [];
  let deleted = 0;
  let removedProofs = 0;
  for (const r of list) {
    if (r.key) {
      try { await env.UPLOADS.delete(r.key); removedProofs++; } catch {}
    }
    try {
      await env.DB.prepare(`DELETE FROM appointments WHERE id = ?`).bind(r.id).run();
      deleted++;
    } catch {}
  }
  return { deleted, removedProofs };
}

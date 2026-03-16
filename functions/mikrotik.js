/**
 * Cloudflare Worker — Proxy ke Mikrotik REST API
 * File: functions/mikrotik.js
 * Cloudflare Pages Functions (tidak pakai require, pakai fetch)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { error: 'Request body bukan JSON yang valid' });
  }

  const { host, port = 80, username, password, path, method = 'GET', data } = body;

  if (!host || !username || !password || !path) {
    return json(400, { error: 'Parameter wajib: host, username, password, path' });
  }

  const auth = btoa(`${username}:${password}`);
  const reqMethod = method.toUpperCase();

  // Candidate URLs to try
  const candidates = [`http://${host}:${port}/rest${path}`];
  if (String(port) !== '8080') candidates.push(`http://${host}:8080/rest${path}`);

  let lastError = 'Tidak dapat terhubung ke Mikrotik';
  let lastStatus = 0;

  for (const url of candidates) {
    try {
      const hasBody = ['PUT','PATCH','POST'].includes(reqMethod) && data != null;

      const fetchOptions = {
        method: reqMethod,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(hasBody ? { body: JSON.stringify(data) } : {}),
        // Cloudflare: timeout via AbortController
        signal: AbortSignal.timeout(12000),
      };

      const resp = await fetch(url, fetchOptions);

      // 401 = credentials salah
      if (resp.status === 401) {
        return json(401, { error: 'Login Mikrotik gagal — username atau password salah' });
      }

      // 404 = path tidak ada, coba URL berikutnya
      if (resp.status === 404) {
        lastStatus = 404;
        lastError = 'REST API tidak ditemukan. Pastikan RouterOS v7.1+ dan service www aktif.';
        continue;
      }

      // DELETE: body kosong normal
      if (reqMethod === 'DELETE') {
        if (resp.status === 204 || resp.status === 200) {
          return json(200, { success: true });
        }
      }

      const text = await resp.text();
      const outBody = text.trim() || 'null';

      return new Response(outBody, {
        status: resp.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      lastError = err.name === 'TimeoutError'
        ? 'Timeout 12 detik — Mikrotik tidak merespons'
        : 'Koneksi gagal: ' + err.message;
    }
  }

  const hint = lastStatus === 404
    ? 'Aktifkan REST API: Winbox > IP > Services > www > Enable. RouterOS minimal v7.1'
    : `Pastikan IP ${host} bisa diakses dari internet dan port ${port} terbuka`;

  return json(503, { error: lastError, hint, tried: candidates });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

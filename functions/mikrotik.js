/**
 * Cloudflare Pages Function — Proxy ke Mikrotik REST API
 * File: functions/mikrotik.js
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function jsonResp(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const method = request.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  // Only allow POST
  if (method !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp(400, { error: 'Request body bukan JSON yang valid' });
  }

  const { host, port = 80, username, password, path, method: reqMethod = 'GET', data } = body;

  if (!host || !username || !password || !path) {
    return jsonResp(400, { error: 'Parameter wajib: host, username, password, path' });
  }

  const auth = btoa(`${username}:${password}`);
  const httpMethod = reqMethod.toUpperCase();

  // Try multiple candidate URLs
  const candidates = [`http://${host}:${port}/rest${path}`];
  if (String(port) !== '8080') candidates.push(`http://${host}:8080/rest${path}`);

  let lastError = 'Tidak dapat terhubung ke Mikrotik';
  let lastStatus = 0;

  for (const url of candidates) {
    try {
      const hasBody = ['PUT','PATCH','POST'].includes(httpMethod) && data != null;
      const fetchOptions = {
        method: httpMethod,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(hasBody ? { body: JSON.stringify(data) } : {}),
        signal: AbortSignal.timeout(12000),
      };

      const resp = await fetch(url, fetchOptions);

      if (resp.status === 401) {
        return jsonResp(401, { error: 'Login Mikrotik gagal — username atau password salah' });
      }

      if (resp.status === 404) {
        lastStatus = 404;
        lastError = 'REST API tidak ditemukan. Pastikan RouterOS v7.1+ dan service www aktif.';
        continue;
      }

      if (httpMethod === 'DELETE') {
        if (resp.status === 204 || resp.status === 200) {
          return jsonResp(200, { success: true });
        }
      }

      const text = await resp.text();
      return new Response(text || 'null', {
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

  return jsonResp(503, { error: lastError, hint, tried: candidates });
}

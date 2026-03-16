/**
 * Vercel Serverless Function — Proxy ke Mikrotik REST API
 * File: api/mikrotik.js
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Request body bukan JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { host, port = 80, username, password, path, method = 'GET', data } = body;

  if (!host || !username || !password || !path) {
    return new Response(JSON.stringify({ error: 'Parameter wajib: host, username, password, path' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const auth      = btoa(`${username}:${password}`);
  const httpMethod = method.toUpperCase();

  const candidates = [
    `http://${host}:${port}/rest${path}`,
    `http://${host}:8080/rest${path}`,
  ];

  let lastError  = 'Tidak dapat terhubung ke Mikrotik';
  let lastStatus = 0;

  for (const url of candidates) {
    try {
      const hasBody = ['PUT','PATCH','POST'].includes(httpMethod) && data != null;
      const resp = await fetch(url, {
        method: httpMethod,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(hasBody ? { body: JSON.stringify(data) } : {}),
        signal: AbortSignal.timeout(12000),
      });

      if (resp.status === 401) {
        return new Response(JSON.stringify({ error: 'Login Mikrotik gagal — username atau password salah' }), {
          status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      if (resp.status === 404) {
        lastStatus = 404;
        lastError  = 'REST API tidak ditemukan. Pastikan RouterOS v7.1+ dan service www aktif.';
        continue;
      }

      if (httpMethod === 'DELETE' && (resp.status === 204 || resp.status === 200)) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
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

  return new Response(JSON.stringify({ error: lastError, hint, tried: candidates }), {
    status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const http  = require('http');
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { host, port = 80, username, password, path, method = 'GET', data } = body;

    if (!host || !username || !password || !path) {
      return resp(400, { error: 'Parameter tidak lengkap (host/username/password/path)' });
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // ── Try multiple REST base paths (handles different RouterOS versions) ──
    // RouterOS 7.1+ → /rest/...
    // Some setups use http://host/rest without trailing slash
    const candidates = [
      `http://${host}:${port}/rest${path}`,
      `https://${host}:${port}/rest${path}`,
      `http://${host}:8080/rest${path}`,
      `http://${host}:80/rest${path}`,
    ];

    // Deduplicate
    const urls = [...new Set(candidates)];
    let lastError = '';
    let lastStatus = 0;

    for (const url of urls) {
      try {
        const result = await makeRequest(url, method, auth, data);

        // 401 = wrong credentials (server found, auth failed) → surface immediately
        if (result.statusCode === 401) {
          const body401 = safeJson(result.body);
          return resp(401, {
            error: 'Login gagal — username atau password salah',
            detail: body401?.detail || body401?.message || '',
            url_tried: url,
          });
        }

        // 404 on THIS url → try next candidate
        if (result.statusCode === 404) {
          lastStatus = 404;
          lastError  = `Path tidak ditemukan: ${url}`;
          continue;
        }

        // DELETE success (empty body is normal)
        if (method.toUpperCase() === 'DELETE') {
          if ([200, 204].includes(result.statusCode) || !result.body?.trim()) {
            return resp(200, { success: true });
          }
        }

        // Return Mikrotik's response as-is
        const outBody = result.body?.trim() || 'null';
        return {
          statusCode: result.statusCode,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: outBody,
        };

      } catch (err) {
        lastError = err.message;
      }
    }

    // All candidates failed
    const hint = lastStatus === 404
      ? 'Pastikan RouterOS versi 7.1+ dan service "www" (port 80) aktif di IP > Services > www'
      : lastError;
    return resp(503, {
      error: hint,
      hint: 'Cek: IP → Services → www (enable, port 80). RouterOS 7.1+ diperlukan untuk REST API.',
      tried: urls,
    });

  } catch (err) {
    return resp(500, { error: err.message });
  }
};

function resp(code, obj) {
  return {
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function makeRequest(url, method, auth, data) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try { urlObj = new URL(url); } catch { return reject(new Error('URL tidak valid: ' + url)); }

    const lib      = urlObj.protocol === 'https:' ? https : http;
    const reqMethod = method.toUpperCase();
    const hasBody  = ['PUT','PATCH','POST'].includes(reqMethod) && data != null;
    const reqBody  = hasBody ? JSON.stringify(data) : null;

    const options = {
      hostname: urlObj.hostname,
      port:     parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + urlObj.search,
      method:   reqMethod,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
      rejectUnauthorized: false,
    };
    if (reqBody) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = lib.request(options, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error',   err => reject(new Error('Koneksi gagal: ' + err.message)));
    req.on('timeout', ()  => { req.destroy(); reject(new Error('Timeout (10 detik) — Mikrotik tidak merespons')); });
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

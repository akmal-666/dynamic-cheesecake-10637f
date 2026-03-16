import http  from 'http';
import https from 'https';

export const config = {
  api: { bodyParser: true },
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function makeRequest(url, method, auth, bodyData) {
  return new Promise((resolve, reject) => {
    const urlObj    = new URL(url);
    const lib       = urlObj.protocol === 'https:' ? https : http;
    const reqMethod = method.toUpperCase();
    const hasBody   = ['PUT','PATCH','POST'].includes(reqMethod) && bodyData != null;
    const reqBody   = hasBody ? JSON.stringify(bodyData) : null;

    const options = {
      hostname: urlObj.hostname,
      port:     parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + (urlObj.search || ''),
      method:   reqMethod,
      headers: {
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json',
        ...(reqBody ? {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(reqBody),
        } : {}),
      },
      timeout: 15000,
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error',   err => reject(new Error('Koneksi gagal: ' + err.message)));
    req.on('timeout', ()  => { req.destroy(); reject(new Error('Timeout — Mikrotik tidak merespons')); });
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { host, port = 80, username, password, path, method = 'GET', data } = body;

    if (!host || !username || !password || !path)
      return res.status(400).json({ error: 'Parameter wajib: host, username, password, path' });

    const auth       = Buffer.from(`${username}:${password}`).toString('base64');
    const httpMethod = method.toUpperCase();
    const candidates = [`http://${host}:${port}/rest${path}`];
    if (String(port) !== '8080') candidates.push(`http://${host}:8080/rest${path}`);

    let lastError = 'Tidak dapat terhubung ke Mikrotik';
    let lastStatus = 0;

    for (const url of candidates) {
      try {
        const result = await makeRequest(url, httpMethod, auth, data);

        if (result.statusCode === 401)
          return res.status(401).json({ error: 'Login gagal — username atau password salah' });

        if (result.statusCode === 404) {
          lastStatus = 404;
          lastError  = 'REST API tidak ditemukan. Pastikan RouterOS v7.1+';
          continue;
        }

        if (httpMethod === 'DELETE' && [200, 204].includes(result.statusCode))
          return res.status(200).json({ success: true });

        res.setHeader('Content-Type', 'application/json');
        return res.status(result.statusCode).send(result.body || 'null');

      } catch (err) { lastError = err.message; }
    }

    const hint = lastStatus === 404
      ? 'Winbox > IP > Services > www > Enable. RouterOS minimal v7.1'
      : `Pastikan IP ${host} dapat diakses dari internet dan port ${port} terbuka`;

    return res.status(503).json({ error: lastError, hint, tried: candidates });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

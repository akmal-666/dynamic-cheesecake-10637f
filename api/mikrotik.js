const http  = require('http');
const https = require('https');

function makeRequest(url, method, auth, bodyData) {
  return new Promise((resolve, reject) => {
    var urlObj;
    try { urlObj = new URL(url); } catch(e) { return reject(new Error('URL tidak valid: ' + url)); }

    var lib      = urlObj.protocol === 'https:' ? https : http;
    var reqMethod = method.toUpperCase();
    var hasBody  = ['PUT','PATCH','POST'].indexOf(reqMethod) >= 0 && bodyData != null;
    var reqBody  = hasBody ? JSON.stringify(bodyData) : null;

    var options = {
      hostname: urlObj.hostname,
      port:     parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + (urlObj.search || ''),
      method:   reqMethod,
      headers: {
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json',
      },
      timeout: 12000,
      rejectUnauthorized: false,
    };

    if (reqBody) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    var req = lib.request(options, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() { resolve({ statusCode: res.statusCode, body: body }); });
    });

    req.on('error', function(err) { reject(new Error('Koneksi gagal: ' + err.message)); });
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout 12 detik — Mikrotik tidak merespons')); });

    if (reqBody) req.write(reqBody);
    req.end();
  });
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

module.exports = async function(req, res) {
  // Set CORS headers
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var body = req.body;
  if (!body) {
    return res.status(400).json({ error: 'Request body kosong' });
  }

  var host     = body.host;
  var username = body.username;
  var password = body.password;
  var path     = body.path;
  var port     = body.port || 80;
  var method   = (body.method || 'GET').toUpperCase();
  var data     = body.data || null;

  if (!host || !username || !password || !path) {
    return res.status(400).json({ error: 'Parameter wajib: host, username, password, path' });
  }

  var auth = Buffer.from(username + ':' + password).toString('base64');

  var candidates = ['http://' + host + ':' + port + '/rest' + path];
  if (String(port) !== '8080') candidates.push('http://' + host + ':8080/rest' + path);
  if (String(port) !== '80')   candidates.push('http://' + host + ':80/rest' + path);

  var lastError  = 'Tidak dapat terhubung ke Mikrotik';
  var lastStatus = 0;

  for (var i = 0; i < candidates.length; i++) {
    var url = candidates[i];
    try {
      var result = await makeRequest(url, method, auth, data);

      if (result.statusCode === 401) {
        return res.status(401).json({ error: 'Login Mikrotik gagal — username atau password salah' });
      }

      if (result.statusCode === 404) {
        lastStatus = 404;
        lastError  = 'REST API tidak ditemukan. Pastikan RouterOS v7.1+ dan service www aktif.';
        continue;
      }

      if (method === 'DELETE') {
        if (result.statusCode === 204 || result.statusCode === 200 || !result.body?.trim()) {
          return res.status(200).json({ success: true });
        }
      }

      var outBody = (result.body && result.body.trim()) ? result.body : 'null';
      res.setHeader('Content-Type', 'application/json');
      return res.status(result.statusCode).send(outBody);

    } catch(err) {
      lastError = err.message;
    }
  }

  var hint = lastStatus === 404
    ? 'Aktifkan REST API: Winbox > IP > Services > www > Enable. RouterOS minimal v7.1'
    : 'Pastikan IP ' + host + ' bisa diakses dari internet dan port ' + port + ' terbuka';

  return res.status(503).json({ error: lastError, hint: hint, tried: candidates });
};

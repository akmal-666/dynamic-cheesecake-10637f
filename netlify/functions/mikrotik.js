const http  = require('http');
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

function makeRequest(url, method, auth, bodyData) {
  return new Promise((resolve, reject) => {
    var urlObj;
    try { urlObj = new URL(url); } catch (e) { return reject(new Error('URL tidak valid: ' + url)); }

    var lib = urlObj.protocol === 'https:' ? https : http;
    var reqMethod = method.toUpperCase();
    var hasBody = ['PUT','PATCH','POST'].indexOf(reqMethod) >= 0 && bodyData != null;
    var reqBody = hasBody ? JSON.stringify(bodyData) : null;

    var options = {
      hostname: urlObj.hostname,
      port:     parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + urlObj.search,
      method:   reqMethod,
      headers: {
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json',
      },
      timeout: 10000,
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
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout — Mikrotik tidak merespons (10 detik)')); });

    if (reqBody) req.write(reqBody);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return resp(400, { error: 'Request body tidak valid (bukan JSON)' });
  }

  var host = body.host, username = body.username, password = body.password, path = body.path;
  var port = body.port || 80;
  var method = body.method || 'GET';
  var data = body.data || null;

  if (!host || !username || !password || !path) {
    return resp(400, { error: 'Parameter tidak lengkap: host, username, password, path wajib diisi' });
  }

  var auth = Buffer.from(username + ':' + password).toString('base64');

  // Try multiple port/protocol combinations
  var candidates = [];
  // Primary: exactly what user configured
  candidates.push('http://' + host + ':' + port + '/rest' + path);
  // Fallbacks if primary port not 80/8080
  if (String(port) !== '8080') candidates.push('http://' + host + ':8080/rest' + path);
  if (String(port) !== '443')  candidates.push('https://' + host + ':443/rest' + path);

  // Deduplicate
  var seen = {};
  candidates = candidates.filter(function(u) {
    if (seen[u]) return false;
    seen[u] = true;
    return true;
  });

  var lastError = 'Koneksi gagal';
  var lastStatus = 0;

  for (var i = 0; i < candidates.length; i++) {
    var url = candidates[i];
    try {
      var result = await makeRequest(url, method, auth, data);

      // 401 = wrong credentials
      if (result.statusCode === 401) {
        var body401 = safeJson(result.body);
        return resp(401, {
          error: 'Login gagal — username atau password Mikrotik salah',
          detail: (body401 && (body401.detail || body401.message)) || '',
          url_tried: url,
        });
      }

      // 404 = path tidak ada di URL ini, coba URL berikutnya
      if (result.statusCode === 404) {
        lastStatus = 404;
        lastError = 'Path REST API tidak ditemukan di ' + url +
          '. Pastikan RouterOS v7.1+ dan service www aktif (IP > Services > www)';
        continue;
      }

      // DELETE: body kosong adalah normal
      if (reqMethod === 'DELETE') {
        if (result.statusCode === 204 || result.statusCode === 200 || !result.body || !result.body.trim()) {
          return resp(200, { success: true });
        }
      }

      var outBody = (result.body && result.body.trim()) ? result.body : 'null';
      return {
        statusCode: result.statusCode,
        headers: Object.assign({}, CORS, { 'Content-Type': 'application/json' }),
        body: outBody,
      };

    } catch(err) {
      lastError = err.message;
    }
  }

  // Semua kandidat gagal
  var hint = lastStatus === 404
    ? 'Aktifkan REST API: Winbox > IP > Services > www > Enable (port 80). RouterOS minimal v7.1'
    : 'Pastikan IP Mikrotik dapat diakses dari internet dan firewall mengizinkan port ' + port;

  return resp(503, {
    error: lastError,
    hint: hint,
    tried: candidates,
  });
};

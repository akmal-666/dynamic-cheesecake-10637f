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
    headers: Object.assign({}, CORS, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(obj),
  };
}

function safeJson(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

function makeRequest(url, method, auth, bodyData) {
  return new Promise(function(resolve, reject) {
    var urlObj;
    try { urlObj = new URL(url); } catch (e) {
      return reject(new Error('URL tidak valid: ' + url));
    }

    var isHttps = urlObj.protocol === 'https:';
    var lib = isHttps ? https : http;
    var reqMethod = method.toUpperCase();
    var hasBody = ['PUT','PATCH','POST'].indexOf(reqMethod) >= 0 && bodyData != null;
    var reqBody = hasBody ? JSON.stringify(bodyData) : null;

    var options = {
      hostname: urlObj.hostname,
      port:     parseInt(urlObj.port) || (isHttps ? 443 : 80),
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
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        resolve({ statusCode: res.statusCode, body: body });
      });
    });

    req.on('error', function(err) {
      reject(new Error('Tidak dapat terhubung: ' + err.message));
    });
    req.on('timeout', function() {
      req.destroy();
      reject(new Error('Timeout 12 detik — Mikrotik tidak merespons. Cek firewall/port.'));
    });

    if (reqBody) { req.write(reqBody); }
    req.end();
  });
}

exports.handler = async function(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Parse request body
  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return resp(400, { error: 'Request body bukan JSON yang valid' });
  }

  var host     = body.host;
  var username = body.username;
  var password = body.password;
  var path     = body.path;
  var port     = body.port || 80;
  var method   = (body.method || 'GET').toUpperCase(); // ← fix: define here
  var data     = body.data || null;

  if (!host || !username || !password || !path) {
    return resp(400, { error: 'Parameter wajib: host, username, password, path' });
  }

  var auth = Buffer.from(username + ':' + password).toString('base64');

  // Build candidate URLs (primary port first, then fallbacks)
  var primaryUrl = 'http://' + host + ':' + port + '/rest' + path;
  var candidates = [primaryUrl];

  // Add fallback ports (avoid duplicates)
  if (String(port) !== '8080') {
    candidates.push('http://' + host + ':8080/rest' + path);
  }
  if (String(port) !== '80') {
    candidates.push('http://' + host + ':80/rest' + path);
  }

  var lastError  = 'Tidak dapat terhubung ke Mikrotik';
  var lastStatus = 0;

  for (var i = 0; i < candidates.length; i++) {
    var url = candidates[i];
    try {
      var result = await makeRequest(url, method, auth, data);

      // 401 = kredensial salah
      if (result.statusCode === 401) {
        return resp(401, {
          error: 'Login Mikrotik gagal — username atau password salah',
          url_tried: url,
        });
      }

      // 404 = REST API path tidak ada, coba URL berikutnya
      if (result.statusCode === 404) {
        lastStatus = 404;
        lastError  = 'REST API tidak ditemukan. Pastikan RouterOS v7.1+ dan service www aktif.';
        continue;
      }

      // DELETE biasanya tidak ada response body
      if (method === 'DELETE') {
        if (result.statusCode === 204 || result.statusCode === 200 ||
            !result.body || !result.body.trim()) {
          return resp(200, { success: true });
        }
      }

      // Return response from Mikrotik
      var outBody = (result.body && result.body.trim()) ? result.body : 'null';
      return {
        statusCode: result.statusCode,
        headers: Object.assign({}, CORS, { 'Content-Type': 'application/json' }),
        body: outBody,
      };

    } catch (err) {
      lastError = err.message;
    }
  }

  // All candidates failed
  var hint = lastStatus === 404
    ? 'Aktifkan REST API: Winbox > IP > Services > www > Enable (port 80). RouterOS minimal v7.1'
    : 'Pastikan IP ' + host + ' bisa diakses dari internet dan port ' + port + ' terbuka di firewall';

  return resp(503, {
    error: lastError,
    hint:  hint,
    tried: candidates,
  });
};

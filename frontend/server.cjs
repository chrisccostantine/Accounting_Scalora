const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 3000);
const apiUrl = process.env.VITE_API_URL || 'http://localhost:4000/api';

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function send(res, file) {
  fs.readFile(file, (error, content) => {
    if (error) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }

    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  });
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/env.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(`window.__SCALORA_ENV__ = ${JSON.stringify({ VITE_API_URL: apiUrl })};`);
    return;
  }

  const requested = path.normalize(path.join(root, urlPath));

  if (!requested.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(requested, (error, stats) => {
    if (!error && stats.isFile()) {
      send(res, requested);
      return;
    }

    send(res, path.join(root, 'index.html'));
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`Scalora frontend listening on ${port}`);
});

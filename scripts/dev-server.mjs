import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };
const port = Number(process.env.PORT || 4173);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/extension/panel.html' : url.pathname);
    if (!/^\/(extension|demo)\//.test(pathname)) {
      response.writeHead(404).end('Não encontrado.');
      return;
    }
    const path = resolve(root, `.${pathname}`);
    const allowed = ['extension', 'demo'].some((folder) => path.startsWith(resolve(root, folder) + sep));
    if (!allowed) {
      response.writeHead(403).end('Acesso negado.');
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(body);
  } catch {
    response.writeHead(404).end('Não encontrado.');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Prévia da Central da Informação: http://127.0.0.1:${port}/extension/panel.html`);
  console.log(`Página de teste: http://127.0.0.1:${port}/demo/noticia.html`);
});

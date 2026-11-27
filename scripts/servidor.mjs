import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { electionSources } from '../regras-negocio/fontes-eleitorais.js';
import { articleUrl, newsFeeds } from '../regras-negocio/noticias.js';
import { allowedSearchUrl } from '../regras-negocio/busca-online.js';
import { atenderGemini } from './gemini.mjs';
import { atenderVoz } from './voz.mjs';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
try { process.loadEnvFile(resolve(root, '.env')); } catch (err) { if (err.code !== 'ENOENT') throw err; }
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.webm': 'video/webm', '.wav': 'audio/wav', '.wasm': 'application/wasm', '.ttf': 'font/ttf' };
types['.mp3'] = 'audio/mpeg';
let port = Number(process.env.PORT || 4177);
const initialPort = port;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (['/demonstracoes/demonstracao.mp4','/demonstracoes/demonstracao.vtt'].includes(url.pathname)) {
      const video = url.pathname.endsWith('.mp4');
      const caminho = resolve(root,'docs/gravacoes',video ? 'demonstracao.mp4' : 'demonstracao.vtt');
      const {size} = await stat(caminho);
      const cabecalhos = {'Content-Type': video ? 'video/mp4' : 'text/vtt; charset=utf-8', 'Accept-Ranges':'bytes'};
      const intervalo = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
      const start = intervalo ? Number(intervalo[1]) : 0;
      const end = intervalo?.[2] ? Math.min(Number(intervalo[2]),size-1) : size-1;
      if (start > end) return response.writeHead(416,{'Content-Range':'bytes */'+size}).end();
      if (intervalo) cabecalhos['Content-Range'] = 'bytes '+start+'-'+end+'/'+size;
      response.writeHead(intervalo ? 206 : 200, {...cabecalhos,'Content-Length':end-start+1});
      if (request.method === 'HEAD') return response.end();
      const corpo = createReadStream(caminho,{start,end});
      response.on('close', () => corpo.destroy());
      corpo.on('error', () => response.destroy()).pipe(response);
      return;
    }
    if (url.pathname === '/api/voz') return await atenderVoz(request, response);
    if (url.pathname === '/downloads/central-da-informacao.zip') {
      const pacote = resolve(root,'dist/site/downloads/central-da-informacao.zip');
      const info = await stat(pacote);
      response.writeHead(200, {'Content-Type':'application/zip','Content-Length':info.size,'Content-Disposition':'attachment; filename="central-da-informacao.zip"'});
      if (request.method === 'HEAD') return response.end();
      const arquivo = createReadStream(pacote);
      response.on('close', () => arquivo.destroy());
      arquivo.on('error', () => response.destroy()).pipe(response);
      return;
    }
    if (url.pathname === '/api/comparar') {
      await atenderGemini(request, response);
      return;
    }
    if (url.pathname === '/') {
      response.writeHead(302, { Location: '/web/index.html' }).end();
      return;
    }
    const source = [...electionSources, ...newsFeeds].find(item => url.pathname === '/eleicoes/fontes/' + item.id);
    if (url.pathname === '/pesquisa/fonte') {
      const upstream = allowedSearchUrl(url.searchParams.get('url'));
      if (!upstream) { response.writeHead(400).end(); return; }
      try {
        const result = await fetch(upstream, { redirect:'error',signal:AbortSignal.timeout(6000) });
        if (!result.ok) throw new Error();
        const charset = result.headers.get('content-type')?.match(/charset=["']?([\w-]+)/i)?.[1];
        const body = Buffer.from(await result.arrayBuffer());
        if (body.length > 2500000) throw new Error();
        response.writeHead(200, {'Content-Type':'text/plain'+(charset?'; charset='+charset:''),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}).end(body);
      } catch { response.writeHead(503).end('Fonte indisponível.'); }
      return;
    }
    if (url.pathname === '/noticia') {
      const article = articleUrl(url.searchParams.get('url'));
      if (!article) { response.writeHead(400).end(); return; }
      try {
        const result = await fetch(article, { redirect: 'error', signal: AbortSignal.timeout(8000) });
        if (!result.ok || !result.headers.get('content-type')?.includes('text/html')) throw new Error();
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }).end((await result.text()).slice(0, 2500000));
      } catch { response.writeHead(503).end(); }
      return;
    }
    if (source) {
      try {
        const upstream = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(9000) });
        if (!upstream.ok) throw new Error();
        const html = await upstream.text();
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).end(html);
      } catch {
        response.writeHead(503).end('Fonte indisponível.');
      }
      return;
    }
    let pathname = decodeURIComponent(url.pathname === '/' ? '/web/index.html' : url.pathname);
    if (pathname === '/extension/panel.html' || pathname === '/extension/index.html') {
      response.writeHead(302, { Location: '/web/index.html' }).end();
      return;
    }
    if (pathname.startsWith('/validacao/')) pathname = pathname.replace('/validacao/','/dist/validacao-0.11.0/');
    if (!/^\/(web|regras-negocio|demo|dist\/validacao-0\.11\.0)\//.test(pathname)) {
      response.writeHead(404).end('Não encontrado.');
      return;
    }
    const path = resolve(root, `.${pathname}`);
    const allowed = ['web', 'regras-negocio', 'demo', 'dist/validacao-0.11.0'].some((folder) => path.startsWith(resolve(root, folder) + sep));
    if (!allowed) {
      response.writeHead(403).end('Acesso negado.');
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(body);
  } catch {
    response.writeHead(404).end('Não encontrado.');
  }
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && !process.env.PORT && port < initialPort + 10) {
    port += 1;
    server.listen(port, process.env.HOST || '127.0.0.1');
  } else throw error;
});
server.on('listening', () => {
  console.log(`Prévia da Central da Informação: http://127.0.0.1:${port}/web/index.html`);
  console.log(`Página de teste: http://127.0.0.1:${port}/demo/noticia.html`);
});
server.listen(port, process.env.HOST || '127.0.0.1');

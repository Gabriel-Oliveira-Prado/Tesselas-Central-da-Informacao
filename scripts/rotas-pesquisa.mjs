import { electionSources } from '../regras-negocio/fontes-eleitorais.js';
import { articleUrl, newsFeeds } from '../regras-negocio/noticias.js';
import { allowedSearchUrl } from '../regras-negocio/busca-online.js';

export async function atenderPesquisa(url, response) {
  const source = [...electionSources, ...newsFeeds].find(item => url.pathname === '/eleicoes/fontes/' + item.id);
  if (url.pathname === '/pesquisa/fonte') {
    const upstream = allowedSearchUrl(url.searchParams.get('url'));
    if (!upstream) { response.writeHead(400).end(); return true; }
    try {
      const result = await fetch(upstream, { redirect:'error',signal:AbortSignal.timeout(6000) });
      if (!result.ok) throw new Error();
      const charset = result.headers.get('content-type')?.match(/charset=["']?([\w-]+)/i)?.[1];
      const body = Buffer.from(await result.arrayBuffer());
      if (body.length > 2500000) throw new Error();
      response.writeHead(200, {'Content-Type':'text/plain'+(charset?'; charset='+charset:''),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}).end(body);
    } catch { response.writeHead(503).end('Fonte indisponível.'); }
    return true;
  }
  if (url.pathname === '/noticia') {
    const article = articleUrl(url.searchParams.get('url'));
    if (!article) { response.writeHead(400).end(); return true; }
    try {
      const result = await fetch(article, { redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!result.ok || !result.headers.get('content-type')?.includes('text/html')) throw new Error();
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }).end((await result.text()).slice(0, 2500000));
    } catch { response.writeHead(503).end(); }
    return true;
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
    return true;
  }
  return false;
}

import { atenderGemini } from '../scripts/gemini.mjs';
import { atenderPesquisa } from '../scripts/rotas-pesquisa.mjs';

export default async function central(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.searchParams.get('rota') || url.pathname;
  if (rota === '/api/comparar' || rota === '/api/consultas') {
    return atenderGemini(req, res, rota === '/api/consultas');
  }
  url.pathname = rota;
  if (req.method === 'GET' && await atenderPesquisa(url, res)) return;
  res.writeHead(404).end();
}

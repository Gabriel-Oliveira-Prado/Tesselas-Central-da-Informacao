import { newsEdition } from './edicao-noticias.js';
import { portaisAdicionais } from './fontes-pesquisa.js';
import { compararAnoDaMidia } from './ano-da-midia.js';

export const newsFeeds = [
  { id: 'g1', name: 'g1 · Fato ou Fake', url: 'https://g1.globo.com/rss/g1/fato-ou-fake/' },
  { id: 'ebc', name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml' },
];
const hosts = ['g1.globo.com', 'agenciabrasil.ebc.com.br', 'www.aosfatos.org', 'www.tse.jus.br', 'www.justicaeleitoral.jus.br'];
export function articleUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && (hosts.includes(url.hostname) || portaisAdicionais.includes(url.hostname))) return url;
  } catch { /* Campo de texto livre. */ }
}

export function parseFeed(source, xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const clean = html => {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.textContent.replace(/\s+/g, ' ').trim();
  };
  const rows = [];
  for (const item of doc.querySelectorAll('item')) {
    const url = articleUrl(item.querySelector('link')?.textContent.trim());
    const title = clean(item.querySelector('title')?.textContent || '');
    if (!url || url.hostname !== new URL(source.url).hostname || !title) continue;
    const date = new Date(item.querySelector('pubDate')?.textContent || '');
    if (!Number.isFinite(date.getTime())) continue;
    const body = clean(item.querySelector('description')?.textContent || '');
    const lead = body.replace(title, '').replace(/^\s*(Reprodução|Divulgação)\s*/i, '').trim();
    rows.push({ url: url.href, title, source: source.name, date: date.toISOString().slice(0, 10), lead: lead.split(/(?<=[.!?])\s+/)[0].slice(0, 220) });
  }
  return rows.slice(0, 50);
}

let rows = [...newsEdition], refreshed = 0, ongoing;
const installed = globalThis.location?.protocol === 'chrome-extension:';
export async function refreshContext() {
  if (Date.now() - refreshed < 900000) return;
  if (ongoing) return ongoing;
  ongoing = Promise.allSettled(newsFeeds.map(async source => {
    if (installed && !await chrome.permissions.contains({ origins: [new URL(source.url).origin + '/*'] })) return;
    const response = await fetch(installed ? source.url : '/eleicoes/fontes/' + source.id, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(4500) });
    if (!response.ok) return;
    const fresh = parseFeed(source, await response.text());
    if (fresh.length) rows = [...new Map([...rows, ...fresh].map(row => [row.url, row])).values()];
  })).finally(() => { ongoing = undefined; refreshed = Date.now(); });
  return ongoing;
}
const stopwords = new Set('para pelo pela pelos pelas como onde quando uma uns umas dos das que com sem nao sobre isso esse essa brasil pode podem e algo tambem fake fato falso verdade noticia apos anos mais sao ser sua seu tem foi esta estão entre ele ela'.split(' '));
const terms = text => new Set(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(t => !stopwords.has(t)));
export function contextFor(text) {
  if (typeof text !== 'string') return [];
  text = text.slice(0, 8000);
  const tokens = terms(text);
  if (tokens.size < 2) return [];
  return rows.map(row => {
    const keywords = terms(row.title);
    const shared = [...keywords].filter(t => tokens.has(t)).length;
    return { row, score: shared >= 2 ? shared / Math.sqrt(keywords.size * Math.min(tokens.size, 30)) : 0 };
  }).filter(hit => hit.score >= .33).sort((a, b) => b.score - a.score).slice(0, 2).map(hit => hit.row);
}

export function publishedChecks(text, story, linkedStory = true) {
  if (typeof text !== 'string') return [];
  text = text.slice(0, 8000);
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[“”"'‘’#]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = new Set(text.split(/[.!?\n]/).map(normalize));
  const candidates = story && !rows.some(row => row.url === story.url) ? [story, ...rows] : rows;
  return candidates.flatMap(row => {
    if (new URL(row.url).hostname !== 'g1.globo.com' || !new URL(row.url).pathname.includes('/fato-ou-fake/')) return [];
    const match = /^É #(FAKE|FATO)(?:\s+que\s+|:\s*|\s+)(.+?)(?:;|$)/i.exec(row.title);
    const fullHeadline = normalize(row.title).replace(/[.!?]$/, '');
    if (!match) return [];
    const ano = match[1].toUpperCase() === 'FATO' && compararAnoDaMidia(text, match[2]);
    if (ano?.ambiguo) return [];
    if (ano && ano.informado !== ano.confirmado) return [{
      id: row.url + '#ano-' + ano.informado, kind:'context', claim:match[2],
      finding:'Fora de contexto · ano trocado',
      explanation:'O trecho informa ' + ano.informado + '. A checagem confirma ' + ano.confirmado + '. ' + match[2] + '.',
      url:row.url, source:'g1 · Fato ou Fake', topic:'o registro original', published:row.date,
      consultedAt:new Date().toISOString().slice(0,10),
    }];
    if (!ano && (!linkedStory || story?.url !== row.url) && !sentences.has(normalize(match[2]).replace(/[.!?]$/, '')) && !sentences.has(fullHeadline)) return [];
    return [{ id: row.url, kind: match[1].toUpperCase() === 'FAKE' ? 'false' : 'true', claim: match[2],
      finding: match[1].toUpperCase() === 'FAKE' ? 'Falso, segundo a fonte' : 'Confirmado pela fonte',
      explanation: row.lead || row.title, url: row.url, source: 'g1 · Fato ou Fake', topic: 'esta checagem do g1', published: row.date, consultedAt: new Date().toISOString().slice(0, 10) }];
  });
}

export async function readArticle(url) {
  const indexed = rows.find(row => new URL(row.url).pathname === url.pathname && new URL(row.url).hostname === url.hostname);
  if (indexed) return indexed;
  const access = { origins: [url.origin + '/*'] };
  if (installed && !await chrome.permissions.contains(access) && !await chrome.permissions.request(access)) throw new Error('Permita a leitura deste portal ou cole o trecho da matéria.');
  const response = await fetch(installed ? url.href : '/noticia?url=' + encodeURIComponent(url.href), { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error('O portal não disponibilizou a matéria. Cole o trecho que deseja conferir.');
  const template = document.createElement('template');
  template.innerHTML = await response.text();
  const content = template.content;
  const title = content.querySelector('meta[property="og:title"]')?.content || content.querySelector('h1')?.textContent?.trim();
  if (!title) throw new Error('Não encontrei uma manchete nesse endereço. Cole o trecho da notícia.');
  return { title, lead: (content.querySelector('meta[name="description"],meta[property="og:description"]')?.content || '').slice(0, 320), url: url.href, source: url.hostname };
}

import { sources, searchOrigins, newsPublishers, portaisAdicionais, reportagens, searchPlan, keywords } from './fontes-pesquisa.js';

const installed = globalThis.location?.protocol === 'chrome-extension:';
export function allowedSearchUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    if (searchOrigins.some(origin => new URL(origin).hostname === url.hostname) || portaisAdicionais.includes(url.hostname)) return url;
  } catch { /* Endereço inválido. */ }
}
function text(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script,style,iframe,nav,header,footer').forEach(el=>el.remove());
  return template.content.textContent.replace(/\s+/g,' ').trim();
}
export function parseSearch(xml, engine) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.querySelectorAll('item')].slice(0, 40).flatMap(item=>{
    const url = allowedSearchUrl(item.querySelector('link')?.textContent?.trim());
    const title = text(item.querySelector('title')?.textContent || '');
    if (!url || !title) return [];
    if (engine === 'bing' && ['www.bing.com','news.google.com'].includes(url.hostname)) return [];
    const source = item.querySelector('source');
    if (engine === 'google' && url.hostname === 'news.google.com') {
      try {
        const publisher = new URL(source?.getAttribute('url'));
        if (publisher.protocol !== 'https:' || publisher.username || publisher.password || publisher.port || !(allowedSearchUrl(publisher.href) || newsPublishers.includes(publisher.hostname))) return [];
      } catch { return []; }
    }
    const date = new Date(item.querySelector('pubDate')?.textContent || '');
    return [{ url:url.href, title, source:source?.textContent || url.hostname, lead:engine === 'google' ? '' : text(item.querySelector('description')?.textContent || '').slice(0,400), date:Number.isFinite(date.getTime())? date.toISOString().slice(0,10):null }];
  });
}

export function decodePage(bytes, type = '') {
  const prefix = new TextDecoder().decode(bytes.subarray(0,2048));
  const charset = type.match(/charset=["']?([\w-]+)/i)?.[1]
    || prefix.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
  try { return new TextDecoder(charset,{fatal:true}).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}

async function load(url, signal) {
  const path = '/pesquisa/fonte?url=' + encodeURIComponent(url.href);
  const opcoes = { signal: AbortSignal.any([signal, AbortSignal.timeout(6500)]), credentials:'omit', referrerPolicy:'no-referrer', redirect:'error', cache:'no-store' };
  let response;
  if (installed) {
    try { response = await fetch(url.href, opcoes); } catch { signal.throwIfAborted(); }
  }
  if (!response?.ok) {
    const servidor = installed ? chrome.runtime.getManifest().homepage_url : location.origin;
    response = await fetch(new URL(path, servidor), opcoes);
  }
  if (!response.ok) throw new Error('source-unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  return decodePage(bytes,response.headers.get('content-type') || '');
}

export function extractPage(html, url, query) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const doc = template.content;
  const title = doc.querySelector('meta[property="og:title"]')?.content || doc.querySelector('h1')?.textContent?.trim() || doc.querySelector('title')?.textContent?.trim();
  const article = doc.querySelector('#parent-fieldname-text, #content-core, .mc-article-body, .texto, #termos_conteudo, article, main') || (url.hostname === 'www.planalto.gov.br' ? doc : null);
  if (!title || !article) return;
  article.querySelectorAll('script,style,nav,footer,form,header,aside').forEach(el=>el.remove());
  const plan = searchPlan(query);
  const tokens = keywords(plan.queries.join(' '));
  const paragraphs = [...article.querySelectorAll('p,li')].map(el=>el.textContent.replace(/\s+/g,' ').trim())
    .filter(value=>value.length>=25 && value.length<2200 && !/cookies|gestor respons|acesse nossas redes/i.test(value));
  const candidates = /\/constituicao(?:-|\.|\/)/i.test(url.pathname) ? paragraphs.filter(value=>/^Art\.\s*14\b|sufr[aá]gio universal/i.test(value)) : paragraphs;
  const numerosDaPergunta = new Set(plan.query.match(/\b\d{1,4}\b/g) || []);
  const ranked = [...new Set(candidates)].map((value,order)=>({value,order,score:keywords(value).filter(word=>tokens.includes(word))
    .reduce((soma, palavra) => soma + (numerosDaPergunta.has(palavra) ? 2 : 1), 0) + (plan.civic && /sufr[aá]gio universal|liberdade de escolha|livre exerc[ií]cio/i.test(value)?4:0)}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.order-b.order).slice(0,4);
  const dateValue = doc.querySelector('meta[property="article:published_time"],meta[property="article:modified_time"]')?.content;
  const date = dateValue && Number.isFinite(Date.parse(dateValue)) ? dateValue.slice(0,10) : null;
  return {title:text(title),url:url.href,source:sources.find(source=>source.url===url.href)?.name || url.hostname,date,passages:ranked.map(item=>item.value.slice(0,700)),lead:ranked[0]?.value.slice(0,400)||'',retrievedAt:new Date().toISOString()};
}

export async function searchOnline(value, { signal = new AbortController().signal, onProgress = ()=>{} } = {}) {
  const plan = searchPlan(value);
  if (!plan.query) return { articles:[],status:'empty',query:'' };
  onProgress('Buscando publicações e orientações na internet…');
  const requests = plan.queries.flatMap(query=>{
    const bing = new URL('https://www.bing.com/search');bing.searchParams.set('q',query+' (site:tse.jus.br OR site:g1.globo.com OR site:agenciabrasil.ebc.com.br OR site:aosfatos.org OR site:terra.com.br OR site:noticias.uol.com.br)');bing.searchParams.set('format','rss');
    const google = new URL('https://news.google.com/rss/search');google.searchParams.set('q',query);google.searchParams.set('hl','pt-BR');google.searchParams.set('gl','BR');google.searchParams.set('ceid','BR:pt-419');
    return [{url:bing,engine:'bing'},{url:google,engine:'google'}];
  });
  const results = await Promise.allSettled(requests.map(async request=>parseSearch(await load(request.url,signal),request.engine)));
  signal.throwIfAborted();
  const tokens = keywords(plan.civic ? plan.queries.join(' ') : plan.query);
  const names = ((plan.queries[1] && !plan.civic ? plan.queries[1] : plan.query).match(/(?<=\s)[A-ZÀ-Ý][a-zà-ÿ-]{2,}/g) || []).map(word=>word.toLocaleLowerCase('pt-BR'));
  const mentionsNames = row => !names.length || names.every(name=>(row.title+' '+(row.lead||'')).toLocaleLowerCase('pt-BR').includes(name));
  const articles = results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  const minimum = Math.min(tokens.length,Math.max(2,Math.min(4,Math.ceil(tokens.length/4))));
  const unique = [...new Map(articles.map(row=>[row.url,row])).values()].map(row=>({...row,score:keywords(row.title+' '+row.lead).filter(word=>tokens.includes(word)).length}))
    .filter(row=>row.score>=minimum && (plan.civic || mentionsNames(row))).sort((a,b)=>b.score-a.score).slice(0,4);
  onProgress('Lendo os trechos das fontes encontradas…');
  const referencias = reportagens.map(row=>({...row,score:keywords(row.titulo).filter(k=>tokens.includes(k)).length})).filter(row=>row.score >= 5);
  const prioritarias = plan.idadeEleitoral || plan.horarioEleitoral ? plan.sources.slice(0,1) : [];
  const pages = [...new Map([...prioritarias,...referencias,...unique.filter(row=>!row.url.startsWith('https://news.google.com/')),...plan.sources].map(row=>[row.url,row])).values()].slice(0,6);
  const extracted = await Promise.allSettled(pages.map(async row=>{
    const page = extractPage(await load(new URL(row.url),signal),new URL(row.url),plan.query);
    return page ? {...page,score:row.score || 0} : undefined;
  }));
  signal.throwIfAborted();
  const passages = extracted.flatMap(result=>result.status==='fulfilled'&&result.value?.passages.length && (plan.electoral || mentionsNames(result.value))?result.value:[]);
  const remaining = unique.filter(row=>!passages.some(page=>page.url===row.url));
  const combined = [...passages,...remaining].sort((a,b)=>b.score-a.score).slice(0,3);
  let orientation;
  const rights = passages.find(row=>row.passages.some(p=>/sufr[aá]gio universal/i.test(p)));
  const choice = passages.find(row=>row.passages.some(p=>/liberdade de escolha/i.test(p)));
  if (plan.civic && plan.regional && rights) orientation = {
    title:'O direito de voto vale em todo o Brasil',
    explanation:'A regra constitucional é o sufrágio universal, com valor igual para todos. A região onde a pessoa mora não cria uma proibição de votar. Para exercer o voto, confira sua situação eleitoral, sua seção e a data da eleição.',
    source:rights,
  };
  else if (plan.civic && (choice || rights)) orientation = {
    title:'Você tem liberdade para escolher sua candidatura',
    explanation:'O voto é pessoal e secreto. Você pode escolher entre as candidaturas válidas para aquele cargo e eleição. Para confirmar um nome específico, é preciso conferir a eleição, o turno e o registro da candidatura no TSE.',
    source:choice || rights, candidateLookup:'https://divulgacandcontas.tse.jus.br/divulga/#/',
  };
  return {articles:orientation ? passages.slice(0,2) : combined, paginasLidas:passages, orientation,status:combined.length?'found':results.every(result=>result.status==='rejected')?'unavailable':'not-found',query:plan.query, checkedAt:new Date().toISOString()};
}

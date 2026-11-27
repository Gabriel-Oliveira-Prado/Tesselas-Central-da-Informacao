export { evidenceFor } from '../regras-negocio/pesquisa.js';

function node(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

export function renderVerdict(element, kind, label) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('class', 'pictograma');
  const use = document.createElementNS(icon.namespaceURI, 'use');
  use.setAttribute('href', 'assets/acoes.svg#' + kind);
  icon.append(use);
  element.className = 'conclusion-banner verdict-' + kind;
  element.dataset.verdict = kind;
  element.replaceChildren(icon, document.createTextNode(label));
}

export function showEvidence(container, { exact, related, news = [], orientation }) {
  const cards = exact.map(record => {
    const article = document.createElement('article');
    article.className = 'evidence verdict-' + record.kind;
    const label = node('p', '', 'verdict-label');
    const icon = node('span', { false: '×', true: '✓', context: '◷', conditional:'◷' }[record.kind], 'verdict-icon');
    icon.setAttribute('aria-hidden', 'true');
    label.append(icon, node('strong', record.finding, 'finding'));
    article.append(label, node('h2', record.claim), node('p', record.explanation));
    if (record.quote) article.append(node('blockquote', record.quote));
    appendSource(article, record);
    return article;
  });
  if (orientation) {
    const article = node('article','','evidence verdict-context');
    article.append(node('h2',orientation.title),node('p',orientation.explanation),node('p','Síntese da orientação geral. Confira abaixo a redação da fonte.','small'));
    const link = node('a','Consultar a fonte oficial (nova aba)');
    link.href=orientation.source.url;link.target='_blank';link.rel='noopener noreferrer';
    article.append(link);cards.unshift(article);
    if (orientation.candidateLookup) {
      const candidates = node('a','Conferir candidaturas na Justiça Eleitoral (nova aba)');
      candidates.href=orientation.candidateLookup;candidates.target='_blank';candidates.rel='noopener noreferrer';article.append(candidates);
    }
  }
  for (const record of related) {
    const article = node('article', '', 'evidence');
    article.append(node('h2', 'Leitura sobre ' + record.topic), node('p', record.explanation));
    appendSource(article, record);
    cards.push(article);
  }
  for (const story of news) {
    const article = node('article', '', 'evidence');
    article.append(node('h2', story.title));
    if (story.passages?.length) for (const passage of story.passages) article.append(node('blockquote', passage));
    else if (story.lead && story.lead !== story.title) article.append(node('p', story.lead));
    const link = node('a', 'Ler em ' + story.source + ' (nova aba)');
    link.href = story.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    article.append(link);
    if (story.date) article.append(node('p', 'Publicada em ' + story.date.split('-').reverse().join('/'), 'small'));
    else article.append(node('p','Data de publicação não informada pela página.','small'));
    if (story.retrievedAt) article.append(node('p', 'Página consultada agora. O trecho mantém a redação da fonte.', 'small'));
    cards.push(article);
  }
  container.replaceChildren(...cards);
}

function appendSource(article, record) {
  const link = node('a', 'Consultar fonte sobre ' + record.topic + ' (nova aba)');
  link.href = record.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const date = record.published || record.consultedAt;
  article.append(link, node('p', record.source + (record.published ? ' · publicada em ' : ' · consultada em ') + date.split('-').reverse().join('/'), 'small'));
  if (record.id === 'voto-online') {
    const partner = node('a', 'Conferir a apuração do Aos Fatos (nova aba)');
    partner.href = 'https://www.aosfatos.org/noticias/tse-nao-liberou-voto-celular-eleicoes/';
    partner.target = '_blank'; partner.rel = 'noopener noreferrer'; article.append(partner);
  }
}

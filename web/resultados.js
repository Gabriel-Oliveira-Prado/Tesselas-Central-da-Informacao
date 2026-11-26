export { evidenceFor } from '../regras-negocio/pesquisa.js';

function node(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

export function showEvidence(container, { exact, related, news = [] }) {
  const cards = exact.map(record => {
    const article = document.createElement('article');
    article.className = 'evidence verdict-' + record.kind;
    const label = node('p', '', 'verdict-label');
    const icon = node('span', { false: '×', true: '✓', context: '◷' }[record.kind], 'verdict-icon');
    icon.setAttribute('aria-hidden', 'true');
    label.append(icon, node('strong', record.finding, 'finding'));
    article.append(label, node('h2', record.claim), node('p', record.explanation));
    appendSource(article, record);
    return article;
  });
  for (const record of related) {
    const article = node('article', '', 'evidence');
    article.append(node('h2', 'Leitura sobre ' + record.topic), node('p', record.explanation));
    appendSource(article, record);
    cards.push(article);
  }
  for (const story of news) {
    const article = node('article', '', 'evidence');
    article.append(node('h2', story.title));
    if (story.lead && story.lead !== story.title) article.append(node('p', story.lead));
    const link = node('a', 'Ler em ' + story.source + ' (nova aba)');
    link.href = story.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    article.append(link);
    if (story.date) article.append(node('p', 'Publicada em ' + story.date.split('-').reverse().join('/'), 'small'));
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

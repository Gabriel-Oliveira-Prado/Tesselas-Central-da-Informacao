export const electionSources = [
  { id: 'tse', name: 'Tribunal Superior Eleitoral', url: 'https://www.tse.jus.br/comunicacao/noticias' },
  { id: 'agencia', name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/tags/eleicoes-2026' },
];

export function extractHeadlines({ source, html }) {
  // O conteúdo de template é inerte. Apenas texto, datas e links validados saem dele.
  const template = document.createElement('template');
  template.innerHTML = html;
  const isTse = source.id === 'tse';
  const cards = template.content.querySelectorAll(isTse ? '.noticia-listagem_destaque article, .news-list-card' : '.ultima-noticia');
  const articles = new Map();
  let feature;
  for (const card of cards) {
    const link = card.querySelector(isTse ? '.noticia-listagem_title a[href], .news-list-title a[href]' : 'a.titulo-noticia[href]');
    const title = link?.textContent.replace(/\s+/g, ' ').trim();
    if (!title) continue;
    if (isTse && !/eleiç|eleitor|votaç|voto|urna|candidatur|diplomaç|prestação de contas/i.test(title)) continue;
    let url;
    try { url = new URL(link.getAttribute('href'), source.url); } catch { continue; }
    if (url.origin !== new URL(source.url).origin || url.username || url.password) continue;
    if (!(isTse ? /^\/comunicacao\/noticias\/\d{4}\// : /^\/[\w-]+\/noticia\/\d{4}-\d{2}\//).test(url.pathname)) continue;
    url.search = '';
    url.hash = '';
    if (isTse && card.closest('.noticia-listagem_destaque')) {
      feature ??= { title, url: url.href, featured: true };
      continue;
    }
    let date = card.querySelector('time')?.getAttribute('datetime')?.slice(0, 10);
    if (!isTse) {
      const match = card.querySelector('.data-publicacao')?.textContent.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      date = match && [match[3], match[2], match[1]].join('-');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) continue;
    articles.set(url.href, { title, url: url.href, date });
  }
  if (feature) {
    feature.date = articles.get(feature.url)?.date ?? null;
    articles.delete(feature.url);
  }
  const latest = [...articles.values()].sort((a, b) => b.date.localeCompare(a.date)
    || Number(/eleições \d{4}/i.test(b.title)) - Number(/eleições \d{4}/i.test(a.title))).slice(0, 3);
  return feature ? [feature, ...latest] : latest;
}

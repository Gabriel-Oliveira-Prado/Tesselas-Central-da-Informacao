import { electionSources, extractHeadlines } from '../regras-negocio/fontes-eleitorais.js';
import { electionEdition } from '../regras-negocio/edicao-eleitoral.js';

const installed = location.protocol === 'chrome-extension:';
const origins = electionSources.map(source => new URL(source.url).origin + '/*');
const edition = { ...electionEdition.sources };
const status = document.getElementById('election-status');
const refresh = document.getElementById('refresh-elections');
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });
let pending = false;
let lastSuccess = 0;

function render() {
  const feature = edition.tse.find(article => article.featured);
  document.getElementById('tse-feature').hidden = !feature;
  if (feature) {
    const link = document.getElementById('tse-feature-link');
    link.href = feature.url;
    link.textContent = feature.title;
  }
  const rows = electionSources.flatMap(source => edition[source.id].filter(article => !article.featured).map(article => ({ ...article, source })));
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const list = document.getElementById('election-headlines');
  list.replaceChildren(...rows.map(article => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = article.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = article.title;
    const meta = document.createElement('div');
    meta.className = 'small';
    const date = document.createElement('time');
    date.dateTime = article.date;
    date.textContent = dateFormat.format(new Date(article.date));
    meta.append(article.source.name + ' · ', date);
    item.append(link, meta);
    return item;
  }));
}

async function update(askPermission) {
  if (pending) return;
  pending = true;
  refresh.setAttribute('aria-disabled', 'true');
  try {
    if (installed) {
      const allowed = askPermission
        ? await chrome.permissions.request({ origins })
        : await chrome.permissions.contains({ origins });
      if (!allowed) {
        status.textContent = 'Seleção incluída em ' + dateFormat.format(new Date(electionEdition.date)) + '. Para consultar as fontes, escolha Atualizar notícias e permita o acesso.';
        return;
      }
    }
    status.textContent = 'Consultando as duas fontes…';
    const results = await Promise.allSettled(electionSources.map(async source => {
      const url = installed ? source.url : '/eleicoes/fontes/' + source.id;
      const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      const articles = extractHeadlines({ source, html: await response.text() });
      if (!articles.length) throw new Error();
      edition[source.id] = articles;
    }));
    render();
    const failed = electionSources.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) {
      status.textContent = 'Seleção anterior mantida para ' + failed.map(source => source.name).join(' e ') + '. A consulta a essas fontes está indisponível.';
    } else {
      lastSuccess = Date.now();
      status.textContent = 'Fontes consultadas às ' + new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(lastSuccess) + '.';
    }
  } catch {
    status.textContent = 'Consulta indisponível. A seleção anterior continua disponível.';
  } finally {
    pending = false;
    refresh.removeAttribute('aria-disabled');
  }
}

refresh.addEventListener('click', () => update(true));
export function openElectionNews() {
  render();
  if (Date.now() - lastSuccess > 15 * 60 * 1000) void update(false);
}

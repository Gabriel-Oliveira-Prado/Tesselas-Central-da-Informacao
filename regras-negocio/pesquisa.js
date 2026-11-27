import { findFactChecks, relatedChecks } from './checagens.js';
import { contextFor, publishedChecks, refreshContext } from './noticias.js';
import { searchOnline } from './busca-online.js';
import { compararFontes } from './comparacao.js';

export function evidenceFor(text, story) {
  const exact = [...findFactChecks(text), ...publishedChecks(text, story)];
  return { exact, related: exact.length ? [] : relatedChecks(text), news: exact.length ? [] : contextFor(text) };
}

export async function research(text, story, options) {
  await refreshContext();
  const evidence = evidenceFor(text, story);
  const online = await searchOnline(text, options);
  const found = online.articles.flatMap(article=>publishedChecks(text,article,false));
  evidence.exact = [...new Map([...evidence.exact,...found].map(record=>[record.id,record])).values()];
  evidence.news = evidence.exact.length ? [] : [...new Map([...online.articles, ...evidence.news].map(row=>[row.url,row])).values()].slice(0,3);
  evidence.orientation = online.orientation;
  if (!evidence.exact.length && !online.orientation && online.paginasLidas?.length) {
    options?.onProgress?.('Comparando a afirmação com os trechos das fontes…');
    evidence.ia = await compararFontes(text, online.paginasLidas, options?.signal);
    if (evidence.ia.registro) evidence.exact.push(evidence.ia.registro);
  }
  evidence.search = online;
  return evidence;
}

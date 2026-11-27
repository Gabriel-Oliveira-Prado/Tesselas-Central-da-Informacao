import { findFactChecks, relatedChecks } from './checagens.js';
import { contextFor, publishedChecks, refreshContext } from './noticias.js';
import { searchOnline } from './busca-online.js';
import { compararFontes } from './comparacao.js';
import { checarVotoJovem } from './idade-eleitoral.js';
import { respostaHorario } from './horario-eleitoral.js';

export function evidenceFor(text, story) {
  const exact = [...findFactChecks(text), ...publishedChecks(text, story)];
  const votoJovem = typeof text === 'string' && checarVotoJovem(text.slice(0, 8000));
  if (votoJovem) exact.push(votoJovem);
  const horario = typeof text === 'string' && respostaHorario(text.slice(0, 8000));
  if (horario) exact.push(horario);
  return { exact, related: exact.length ? [] : relatedChecks(text), news: exact.length ? [] : contextFor(text) };
}

export async function research(text, story, options) {
  await refreshContext();
  const evidence = evidenceFor(text, story);
  const online = await searchOnline(text, {...options, fontesConhecidas:[...(story ? [story] : []), ...evidence.exact]});
  const found = online.articles.flatMap(article=>publishedChecks(text,article,false));
  evidence.exact = [...new Map([...evidence.exact,...found].map(record=>[record.id,record])).values()];
  evidence.news = evidence.exact.length ? [] : [...new Map([...online.articles, ...evidence.news].map(row=>[row.url,row])).values()].slice(0,3);
  if (online.paginasLidas?.length) {
    options?.onProgress?.('Comparando a afirmação com os trechos das fontes…');
    evidence.ia = await compararFontes(text, online.paginasLidas, options?.signal);
    const registro = evidence.ia.registro;
    if (registro) {
      const binario = tipo => ['false','context'].includes(tipo) ? 'false' : 'true';
      const mesmo = evidence.exact.find(item=>item.url === registro.url && binario(item.kind) === binario(registro.kind));
      const orientacao = online.orientation;
      if (orientacao?.kind && !evidence.exact.length && binario(orientacao.kind) !== binario(registro.kind)) {
        evidence.exact.push({id:orientacao.source.url, kind:orientacao.kind, topic:orientacao.title, claim:text,
          explanation:orientacao.explanation, source:orientacao.source.source, url:orientacao.source.url,
          published:orientacao.source.date, consultedAt:orientacao.source.retrievedAt.slice(0,10)});
      }
      if (mesmo) mesmo.quote = registro.quote;
      else evidence.exact.push(registro);
    }
  }
  if (!evidence.exact.length) evidence.orientation = online.orientation;
  evidence.search = online;
  return evidence;
}

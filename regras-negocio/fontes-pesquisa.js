export const sources = [
  { name: 'TSE · Sigilo e liberdade de escolha', url: 'https://www.tse.jus.br/institucional/escola-judiciaria-eleitoral/publicacoes/revistas-da-eje/artigos/revista-eletronica-eje-n.-5-ano-4/protecao-ao-sigilo-do-voto', topics: ['votar','voto','escolha','candidato','proibido','direito','regiao'] },
  { name: 'Constituição Federal · Direitos políticos', url: 'https://www.tse.jus.br/legislacao/codigo-eleitoral/constituicao-federal/constituicao-da-republica-federativa-do-brasil', topics: ['votar','voto','direito','regiao','brasil','proibido'] },
  { name: 'TSE · Local de votação', url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/eleicoes-2026-consulta-aos-locais-de-votacao-ja-esta-disponivel', topics: ['votar','local','regiao','nordeste','cidade','estado','municipio','proibido'] },
  { name: 'TSE · Regras das Eleições 2026', url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/falta-1-dia-veja-o-que-pode-e-o-que-nao-pode-no-1o-turno-das-eleicoes-2026', topics: ['votar','documento','horario','eleicao','candidato','local','proibido'] },
  { name: 'TSE · Votação depois das 17h', url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/o-que-acontece-nas-secoes-eleitorais-apos-as-17h-entenda-as-regras-de-seguranca-e-fiscalizacao', topics: ['horario','fila','17','depois','tarde'] },
  { name: 'Planalto · Constituição Federal', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm', topics: ['direito','voto','regiao'] },
];

export const searchOrigins = ['https://www.bing.com/*', 'https://news.google.com/*', 'https://www.tse.jus.br/*', 'https://www.justicaeleitoral.jus.br/*', 'https://www.aosfatos.org/*', 'https://g1.globo.com/*', 'https://agenciabrasil.ebc.com.br/*', 'https://www.planalto.gov.br/*'];
export const newsPublishers = ['oglobo.globo.com','cbn.globo.com','noticias.uol.com.br','www1.folha.uol.com.br','www.estadao.com.br','sbtnews.sbt.com.br','www.cnnbrasil.com.br','www.bbc.com','www.reuters.com','apnews.com','www.correiobraziliense.com.br'];
export const portaisAdicionais = ['noticias.uol.com.br','www.terra.com.br'];
// Reportagens de referência. A comparação recebe os parágrafos recuperados na consulta.
export const reportagens = [
  { titulo:'Flávio Bolsonaro perde para Lula na seção eleitoral em que vota no Rio de Janeiro', url:'https://www.terra.com.br/noticias/brasil/politica/flavio-bolsonaro-perde-para-lula-na-secao-eleitoral-em-que-vota-no-rio-de-janeiro,23c155bdaf8d161e60f7ec92770b4d595i0ztixh.html' },
  { titulo:'Lula teve mais votos na seção eleitoral onde Flávio Bolsonaro vota', url:'https://noticias.uol.com.br/eleicoes/2026/10/05/lula-teve-mais-votos-na-secao-eleitoral-onde-flavio-bolsonaro-vota.ghtm' },
];

const aliases = { votar:'voto', votacao:'voto', votam:'voto', vota:'voto', eleicoes:'eleicao', eleitoral:'eleicao', eleitores:'eleitor', candidatos:'candidato', proibido:'proibicao', proibida:'proibicao', permitido:'permissao', nordeste:'regiao', sudeste:'regiao', nordestino:'regiao', norte:'regiao', sul:'regiao', cidade:'local', estado:'local', pais:'brasil', consigo:'poder', posso:'poder', pode:'poder' };
const ignored = new Set('uma para pelo pela pelos pelas que como onde qual quais quando isso essa esse aqui sobre todos todas com dos das aos por ser nao sim pode posso proibido proibida verdade falso noticia'.split(' '));
export const normalize = value => (typeof value === 'string' ? value : '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function keywords(text) {
  return [...new Set((normalize(text).match(/[a-z0-9]{3,}/g) || []).filter(word => !ignored.has(word)).map(word => aliases[word] || word))];
}

export function searchPlan(text) {
  let cleaned = (typeof text === 'string' ? text : '').slice(0, 8000)
    .replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d[\d .()-]{7,}\d\b/gi, ' ')
    .replace(/[\u0000-\u0009\u000b-\u001f]/g,' ').trim();
  if (cleaned.length > 240) {
    const fragments = cleaned.split(/[\n.!?]+/).map(value=>value.replace(/\s+/g,' ').trim())
      .filter(value=>keywords(value).length>=3 && value.length>=35)
      .map((value,index)=>({value,index,score:keywords(value).length + (/vot|elei|urna|candidat/i.test(value)?6:0)}))
      .sort((a,b)=>b.score-a.score||a.index-b.index);
    cleaned = fragments[0]?.value || cleaned;
  }
  cleaned = cleaned.replace(/\s+/g,' ').slice(0,240);
  const tokens = keywords(cleaned);
  const electoral = tokens.some(word => ['voto','eleicao','urna','eleitor','candidato','turno'].includes(word));
  const civic = /\b(posso|pode|proibid[oa]|permitid[oa])\b.*\bvotar\s+(?:no|na|em)\b/.test(normalize(cleaned))
    && !/\b(sem|se|preso|presa|cancelado|cancelada|menor|anos|idade|estrangeiro)\b/.test(normalize(cleaned))
    && tokens.every(word=>!['horario','17','fila','celular','documento','internet'].includes(word));
  const regional = tokens.includes('regiao') || /\bbrasil\b/.test(normalize(cleaned));
  const queries = [cleaned];
  const semLocal = cleaned.replace(/\s+(?:em|no|na)\s+(?!.*\s(?:em|no|na)\s)[\p{L}\s-]{3,45}[?.!]?$/iu,'').trim();
  if (semLocal !== cleaned && keywords(semLocal).length >= 4) queries.push(semLocal);
  if (civic) queries.push(regional ? 'direito voto sufrágio universal local de votação' : 'liberdade escolha candidato voto secreto');
  const ranked = sources.map(source => ({ source, score: source.topics.reduce((n, word) => n + (tokens.includes(aliases[word] || word) ? word==='voto'||word==='votar'?1:3:0), 0) })).filter(item => item.score > 0).sort((a,b)=>b.score-a.score).slice(0,3);
  const primary = electoral ? ranked.map(item=>item.source) : [];
  if (civic && !primary.includes(sources.at(-1))) primary.push(sources.at(-1));
  return { query: cleaned, queries: [...new Set(queries)].filter(Boolean), electoral, civic, regional, sources: primary };
}

// Base editorial inicial. O resultado se refere à afirmação, nunca à página inteira.
export const FACT_CHECKS = [
  {
    id: 'urna-internet',
    kind: 'false',
    concepts: [/\burnas?\b/, /internet|wi-?fi|conectad/],
    topic: 'conexão da urna à internet',
    claim: 'A urna eletrônica é conectada à internet durante a votação.',
    variants: ['A urna eletrônica é conectada à internet durante a votação', 'A urna eletrônica tem conexão com a internet durante a votação'],
    finding: 'Falso, segundo a fonte',
    explanation: 'A Justiça Eleitoral informa que a urna funciona sem conexão com a internet durante a votação.',
    source: 'Fato ou Boato · Justiça Eleitoral',
    url: 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/fato-ou-boato-inteligencia-artificial-nao-pode-mudar-o-voto-do-eleitor-na-urna',
    consultedAt: '2026-11-25',
  },
  {
    id: 'voto-online',
    kind: 'false',
    concepts: [/\bvot(ar|o|acao)\b/, /celular|smartphone|on-?line|internet/],
    topic: 'votação pela internet',
    claim: 'É possível votar pela internet nas eleições brasileiras.',
    variants: ['É possível votar pela internet nas eleições brasileiras', 'É possível votar pelo celular nas eleições brasileiras', 'Dá para votar pelo celular se estiver chovendo', 'Dá pra votar pelo celular se estiver chovendo', 'Posso votar pelo celular em caso de chuva', 'Se chover posso votar pelo celular', 'Se chover, posso votar pelo celular', 'Quando chove é permitido votar pelo celular', 'Posso votar pelo celular', 'É possível votar pelo celular', 'Dá pra votar online no Brasil', 'Posso votar pelo aplicativo e-Título', 'Se chover dá para votar online', 'Dá para votar pelo celular em dia de chuva', 'Consigo votar pelo celular se chover'],
    finding: 'Falso, segundo a fonte',
    explanation: 'Mesmo com chuva, a votação é presencial. O celular não permite registrar o voto nas eleições brasileiras.',
    source: 'Fato ou Boato · Justiça Eleitoral',
    url: 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/e-falso-que-eleitores-possam-votar-on-line-pelo-celular-em-caso-de-chuva-no-brasil-votacao-e-sempre-presencial',
    consultedAt: '2026-11-25',
  },
  {
    id: 'celular-cabine',
    kind: 'true',
    concepts: [/celular|telefone/, /cabine/],
    topic: 'uso de celular na cabine',
    claim: 'É proibido entrar na cabine de votação com celular.',
    variants: ['É proibido entrar na cabine de votação com celular', 'É proibido levar celular para a cabine de votação', 'É proibida a entrada de celulares na cabine de votação', 'É proibido entrar na cabine de votação com celulares', 'Não pode levar o celular para a cabine de votação'],
    finding: 'Confirmado pela fonte',
    explanation: 'O TSE informa que o celular deve ficar com a mesa receptora enquanto a pessoa vota, para preservar o sigilo do voto.',
    source: 'Tribunal Superior Eleitoral',
    url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/manual-do-eleitor-uso-de-celular-e-proibido-na-cabine-de-votacao',
    consultedAt: '2026-11-25',
  },
  {
    id: 'documento-foto', kind: 'true', topic: 'identificação pelo e-Título',
    concepts: [/e[- ]titulo/, /foto|identifica/],
    claim: 'O e-Título com foto serve como identificação para votar.',
    variants: ['Posso me identificar com o e-Título com foto', 'O e-Título com foto serve como documento para votar'],
    finding: 'Confirmado pela fonte',
    explanation: 'Na seção eleitoral, você pode mostrar o e-Título com foto. Se a foto não aparecer no aplicativo, apresente um documento oficial com foto.',
    source: 'Tribunal Superior Eleitoral', consultedAt: '2026-11-26',
    url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/faltam-4-dias-e-titulo-com-foto-e-documento-oficial-e-pode-ser-utilizado-para-votar-1',
  },
  {
    id: 'titulo-papel', kind: 'false', topic: 'título de eleitor em papel',
    concepts: [/titulo/, /papel|impresso/],
    claim: 'É obrigatório levar o título de eleitor em papel para votar.',
    variants: ['Preciso levar o título impresso para votar', 'Sem o título de eleitor em papel não posso votar'],
    finding: 'Falso, segundo a fonte',
    explanation: 'O título impresso é opcional. Para se identificar na votação, leve um documento oficial com foto ou use o e-Título com foto.',
    source: 'Tribunal Superior Eleitoral', consultedAt: '2026-11-26',
    url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Abril/eleitor-em-dia-saiba-quais-documentos-sao-validos-para-votar-nas-eleicoes-2026',
  },
  {
    id: 'peritos-2018', kind: 'context', topic: 'vídeo dos peritos e as eleições de 2022',
    concepts: [/perit/, /2022|2018/, /video|fraude/],
    claim: 'O vídeo dos peritos federais comprova fraude nas eleições de 2022.',
    variants: ['Vídeo de peritos federais prova fraude nas eleições de 2022'],
    finding: 'Fora de contexto',
    explanation: 'O vídeo citado na checagem foi gravado em 2018. A fala tratava de testes de segurança. A gravação foi reapresentada como se documentasse a eleição de 2022.',
    source: 'Fato ou Boato · Justiça Eleitoral', consultedAt: '2026-11-26',
    url: 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2022/peritos-federais-nao-comprovaram-fraude-nas-eleicoes-2022',
  },
  {
    id: 'fila-17h', kind: 'conditional', topic: 'votação depois das 17h',
    concepts: [/vot|fila/, /17|dezessete|cinco/],
    claim: 'Quem já estava na fila às 17h pode votar depois desse horário.',
    variants: ['Pode votar depois das 17', 'Posso votar depois das 17 horas', 'Pode votar depois das 17h', 'Dá para votar depois das cinco', 'Posso votar após as 17h', 'Pode votar depois das 17 horas'],
    finding: 'Depende de estar na fila',
    explanation: 'Quem já estava na fila da seção às 17h, no horário de Brasília, recebe senha e pode votar depois. Chegar depois das 17h sem estar na fila não dá esse direito.',
    source: 'Tribunal Superior Eleitoral', consultedAt: '2026-11-26',
    url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/o-que-acontece-nas-secoes-eleitorais-apos-as-17h-entenda-as-regras-de-seguranca-e-fiscalizacao',
  },
];

export function normalizeForLookup(value) {
  return (typeof value === 'string' ? value.slice(0, 8000) : '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/\bproibid[oa](?: de)? entrar\b/g, 'proibido entrar').replace(/\bcom (?:o |um )celular\b/g, 'com celular');
}

export function findFactChecks(text) {
  // Correspondência de frases completas. Negações, paráfrases e tópicos
  // semelhantes ficam sem conclusão, em vez de receber um veredito por engano.
  if (typeof text !== 'string') return [];
  const sentences = new Set(text.slice(0, 8000).split(/[.!?\n]+/).map((part) => normalizeForLookup(part).replace(/^[\s“”"'«»]+|[\s“”"'«»]+$/g, '')));
  return FACT_CHECKS.filter(item => [item.claim.replace(/[.!?]$/, ''), ...item.variants].some(variant => sentences.has(normalizeForLookup(variant))))
    .map(({ variants, concepts, ...record }) => record);
}

// Recuperação por conceitos só sugere leitura. Uma negação pode conter todos os mesmos termos.
export function relatedChecks(text) {
  const parts = normalizeForLookup(text).split(/[.!?]/);
  return FACT_CHECKS.filter(item => parts.some(part => item.concepts.every(term => term.test(part)))).slice(0, 2);
}

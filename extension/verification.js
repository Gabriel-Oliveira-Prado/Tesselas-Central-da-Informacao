// Base editorial inicial. O resultado se refere à afirmação, nunca à página inteira.
export const FACT_CHECKS = [
  {
    id: 'urna-internet',
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
    claim: 'É possível votar pela internet nas eleições brasileiras.',
    variants: ['É possível votar pela internet nas eleições brasileiras', 'É possível votar pelo celular nas eleições brasileiras'],
    finding: 'Falso, segundo a fonte',
    explanation: 'A Justiça Eleitoral esclarece que a votação é presencial. Mensagens oferecendo voto pelo celular em caso de chuva são falsas.',
    source: 'Fato ou Boato · Justiça Eleitoral',
    url: 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/e-falso-que-eleitores-possam-votar-on-line-pelo-celular-em-caso-de-chuva-no-brasil-votacao-e-sempre-presencial',
    consultedAt: '2026-11-25',
  },
  {
    id: 'celular-cabine',
    claim: 'É proibido entrar na cabine de votação com celular.',
    variants: ['É proibido entrar na cabine de votação com celular', 'É proibido levar celular para a cabine de votação'],
    finding: 'Confirmado pela fonte',
    explanation: 'O TSE informa que o celular deve ficar com a mesa receptora enquanto a pessoa vota, para preservar o sigilo do voto.',
    source: 'Tribunal Superior Eleitoral',
    url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/manual-do-eleitor-uso-de-celular-e-proibido-na-cabine-de-votacao',
    consultedAt: '2026-11-25',
  },
];

export function normalizeForLookup(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function findFactChecks(text) {
  // Correspondência de frases completas. Negações, paráfrases e tópicos
  // semelhantes ficam sem conclusão, em vez de receber um veredito por engano.
  const sentences = new Set(String(text).split(/[.!?\n]+/).map((part) => normalizeForLookup(part).replace(/^[\s“”"'«»]+|[\s“”"'«»]+$/g, '')));
  return FACT_CHECKS.filter((item) => item.variants.some((variant) => sentences.has(normalizeForLookup(variant))))
    .map(({ variants, ...record }) => ({ ...record }));
}

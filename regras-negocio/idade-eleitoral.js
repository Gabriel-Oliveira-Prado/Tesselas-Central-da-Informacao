export const fonteVotoJovem = {
  name: 'TSE · Voto aos 16 e 17 anos',
  url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Julho/manual-do-eleitor-jovens-se-preparam-para-participar-das-eleicoes-2026',
};

// Esta regra só responde a uma pergunta completa sobre idade e voto no Brasil.
// Condições adicionais, países, eleições escolares e outras idades seguem para a pesquisa.
export function checarVotoJovem(texto) {
  const frase = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
    .replace(/[?.!]+$/, '').replace(/[,;:]/g, ' ').replace(/\bdezesseis\b/g, '16').replace(/\bdezessete\b/g, '17')
    .replace(/\bno brasil\b/g, '').replace(/\s+/g, ' ').trim();
  const fonte = {
    source: fonteVotoJovem.name, url: fonteVotoJovem.url, topic: 'idade para votar', consultedAt: '2026-11-27',
  };
  if (/^(?:qual (?:e )?a idade minima (?:pra|para) votar|(?:a partir de |com )?quantos anos (?:eu )?(?:posso|pode|se pode) votar|a partir de que idade (?:eu )?(?:posso|pode|se pode) votar)$/.test(frase)) {
    return { ...fonte, id:'idade-minima-voto', kind:'answer', claim:'Qual é a idade mínima para votar no Brasil?',
      finding:'Orientação do TSE', explanation:'A partir dos 16 anos. Para votar, é preciso completar 16 até o primeiro turno e fazer o alistamento eleitoral dentro do prazo. Aos 16 e 17 anos, votar é opcional.' };
  }
  const idade = /\b(?:(?:quem tem|quem fez|eu tenho|tenho|se tenho|uma pessoa de|aos|com|de) )?(16|17) anos\b/.exec(frase);
  if (!idade) return;
  const pergunta = frase.replace(idade[0], '').replace(/\s+/g, ' ').trim();
  const opcional = /^(?:(?:o )?voto (?:e )?(?:facultativo|opcional)|votar (?:e )?(?:facultativo|opcional|so se (?:eu )?quiser)|(?:eu )?(?:posso|pode) votar(?: (?:so )?se (?:eu )?quiser)?|(?:eu )?(?:voto|vota) (?:so |apenas )?se (?:eu )?quiser)$/;
  const obrigatorio = /^(?:(?:o )?voto (?:e )?obrigatorio|votar (?:e )?obrigatorio|(?:e (?:obrigatorio|preciso)|(?:eu )?(?:sou|e) obrigad[oa]|precis[oa]|(?:eu )?tenho que|tem que|(?:eu )?devo) (?:a )?votar)$/;
  const sim = opcional.test(pergunta);
  if (!sim && !obrigatorio.test(pergunta)) return;
  return {
    ...fonte,
    id: 'voto-jovem-' + (sim ? 'opcional' : 'obrigatorio'), kind: sim ? 'true' : 'false',
    claim: sim ? 'Aos 16 e 17 anos, votar é opcional no Brasil.' : 'Aos 16 e 17 anos, votar é obrigatório no Brasil.',
    finding: sim ? 'Confirmado pelo TSE' : 'Falso, segundo o TSE',
    explanation: (sim ? 'Sim.' : 'Não.') + ' No Brasil, quem tem 16 ou 17 anos pode escolher se quer votar. Para votar, é preciso ter feito o alistamento eleitoral no prazo.',
  };
}

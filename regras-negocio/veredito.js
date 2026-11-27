// Uma publicação relacionada não comprova nem desmente a afirmação.
export function conclusionFor({ exact = [], ia, orientation } = {}) {
  if (!exact.length && orientation?.source && orientation.explanation) {
    const kind = orientation.kind;
    if (kind !== 'true' && kind !== 'false') {
      return { kind:'unverified', label:'Não verificado', explanation:ia?.detalhe || orientation.explanation };
    }
    return { kind, label:kind === 'false' ? 'Falso' : 'Verdadeiro', explanation:orientation.explanation };
  }
  if (!exact.length && ia?.status === 'sem-evidencia' && ia.detalhe) {
    return { kind:'unverified', label:'Não verificado', explanation:ia.detalhe };
  }
  // Conserve o contexto nos registros, com um veredito uniforme em todas as entradas.
  const verdicts = { true:'true', false:'false', context:'false', answer:'true', conditional:'true' };
  const kinds = new Set(exact.map(record => verdicts[record.kind]));
  if (kinds.size === 1) {
    const kind = [...kinds][0];
    const labels = { false: 'Falso', true: 'Verdadeiro' };
    if (labels[kind]) return { kind, label: labels[kind], explanation: exact.map(record => record.explanation).join(' ') };
  }
  return { kind: 'unverified', label: 'Não verificado', explanation: kinds.size > 1
    ? 'As checagens encontradas têm conclusões diferentes. Compare cada afirmação e sua fonte abaixo.'
    : 'Ainda não há evidência suficiente para afirmar se este conteúdo é verdadeiro ou falso. Notícias relacionadas servem para investigar.' };
}

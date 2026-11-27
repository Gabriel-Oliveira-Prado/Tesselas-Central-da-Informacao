// Uma publicação relacionada não comprova nem desmente a afirmação.
export function conclusionFor({ exact = [], ia, orientation } = {}) {
  if (!exact.length && orientation?.source && orientation.explanation) {
    return { kind:'answer', label:'Orientação da fonte', explanation:orientation.explanation };
  }
  if (!exact.length && ia?.status === 'sem-evidencia' && ia.detalhe) {
    return { kind:'unverified', label:'Não verificado', explanation:ia.detalhe };
  }
  if(exact.some(record=>record.kind==='conditional')) return {
    kind:'unverified',label:'Não verificado',
    explanation:'A resposta depende das condições do caso. '+exact.map(record=>record.explanation).join(' '),
  };
  const kinds = new Set(exact.map(record => record.kind));
  if (kinds.size === 1) {
    const kind = exact[0].kind;
    const labels = { false: 'Falso', true: 'Verdadeiro', context: 'Fora de contexto', answer: 'Resposta da fonte' };
    if (labels[kind]) return { kind, label: labels[kind], explanation: exact.map(record => record.explanation).join(' ') };
  }
  return { kind: 'unverified', label: 'Não verificado', explanation: kinds.size > 1
    ? 'As checagens encontradas têm conclusões diferentes. Compare cada afirmação e sua fonte abaixo.'
    : 'Ainda não há evidência suficiente para afirmar se este conteúdo é verdadeiro, falso ou fora de contexto. Notícias relacionadas servem para investigar.' };
}

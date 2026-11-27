// A origem de produção é gravada no manifesto durante o empacotamento.
async function consultarCentral(caminho, afirmacao, dados, signal, limite) {
  const manifesto = globalThis.chrome?.runtime?.id && chrome.runtime.getManifest();
  const endpoint = new URL(caminho, manifesto ? manifesto.homepage_url : location.origin);
  const limpa = afirmacao.replace(/[\w.+-]+@[\w.-]+\.\w+|\b\d[\d .()-]{7,}\d\b|https?:\/\/\S+/gi,'[omitido]');
  try {
    const resposta = await fetch(endpoint, { method:'POST', credentials:'omit', redirect:'error',
      headers:{'content-type':'application/json'}, referrerPolicy:'no-referrer',
      signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(limite)]) : AbortSignal.timeout(limite),
      body:JSON.stringify({ afirmacao:limpa, ...dados }) });
    const dado = await resposta.json();
    return resposta.ok ? dado : {status:dado.status || 'indisponivel'};
  } catch { signal?.throwIfAborted(); return { status:'indisponivel' }; }
}

export function buscarConsultas(afirmacao, signal) {
  return consultarCentral('/api/consultas', afirmacao, {}, signal, 26000);
}

export async function compararFontes(afirmacao, artigos, signal) {
  const fontes = artigos.filter(a => a.retrievedAt && a.passages?.length).slice(0,4);
  if (!fontes.length) return {};
  const dado = await consultarCentral('/api/comparar', afirmacao,
    {fontes:fontes.map(a=>({titulo:a.title.slice(0,300),trechos:a.passages.slice(0,4)}))}, signal, 38000);
  if (dado.status !== 'comparado') return { status:dado.status, detalhe:dado.detalhe };
  const fonte = fontes[dado.indice];
  if (!fonte || !['true','false','context','answer'].includes(dado.tipo) || typeof dado.explicacao !== 'string' || typeof dado.trecho !== 'string' || !dado.trecho.trim() || !fonte.passages.some(t=>t.includes(dado.trecho))) return {};
  return { status:'comparado', registro:{ id:'gemini:'+fonte.url, kind:dado.tipo, claim:afirmacao,
    finding:'Comparação com fonte · Central', explanation:dado.explicacao, quote:dado.trecho,
    topic:fonte.title, url:fonte.url, source:fonte.source, published:fonte.date,
    consultedAt:new Date().toISOString().slice(0,10) } };
}

// A origem de produção é gravada no manifesto durante o empacotamento.
export async function compararFontes(afirmacao, artigos, signal) {
  const fontes = artigos.filter(a => a.retrievedAt && a.passages?.length).slice(0,4);
  if (!fontes.length) return {};
  const manifesto = globalThis.chrome?.runtime?.id && chrome.runtime.getManifest();
  const endpoint = new URL('/api/comparar', manifesto ? manifesto.homepage_url : location.origin);
  const limpa = afirmacao.replace(/[\w.+-]+@[\w.-]+\.\w+|\b\d[\d .()-]{7,}\d\b|https?:\/\/\S+/gi,'[omitido]');
  try {
    const resposta = await fetch(endpoint, { method:'POST', credentials:'omit', redirect:'error',
      headers:{'content-type':'application/json'}, referrerPolicy:'no-referrer',
      signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(22000)]) : AbortSignal.timeout(22000),
      body:JSON.stringify({ afirmacao:limpa, fontes:fontes.map(a=>({titulo:a.title.slice(0,300),trechos:a.passages.slice(0,4)})) }) });
    const dado = await resposta.json();
    if (!resposta.ok || dado.status !== 'comparado') return { status:dado.status, detalhe:dado.detalhe };
    const fonte = fontes[dado.indice];
    if (!fonte || !['true','false','context','answer'].includes(dado.tipo) || !dado.trecho || !fonte.passages.some(t=>t.includes(dado.trecho))) return {};
    return { status:'comparado', registro:{ id:'gemini:'+fonte.url, kind:dado.tipo, claim:afirmacao,
      finding:'Comparação com fonte · Central', explanation:dado.explicacao, quote:dado.trecho,
      topic:fonte.title, url:fonte.url, source:fonte.source, published:fonte.date,
      consultedAt:new Date().toISOString().slice(0,10) } };
  } catch { signal?.throwIfAborted(); return { status:'indisponivel' }; }
}

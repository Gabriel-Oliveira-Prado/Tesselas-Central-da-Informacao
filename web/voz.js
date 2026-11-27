import { falasFixas } from './falas-fixas.js';

const arquivos = new Map(Object.entries(falasFixas).map(([arquivo, texto]) => [texto, arquivo]));
let sessao;

export function pararVoz() {
  if (sessao) {
    sessao.cancelar.abort();
    sessao.audio?.pause();
    sessao = null;
  }
  window.speechSynthesis?.cancel();
}

export function pausarVoz(pausar) {
  if (!sessao) return pausar ? window.speechSynthesis?.pause() : window.speechSynthesis?.resume();
  sessao.pausada = pausar;
  if (pausar) sessao.audio?.pause();
  else sessao.retomar?.();
}

async function reproduzir(audio, estado) {
  const sinal = estado.cancelar.signal;
  sinal.throwIfAborted();
  estado.audio = audio;
  try {
    await new Promise((resolve, reject) => {
      const abortar = () => reject(sinal.reason);
      const limpar = () => sinal.removeEventListener('abort', abortar);
      sinal.addEventListener('abort', abortar, {once:true});
      audio.onended = () => { limpar(); resolve(); };
      audio.onerror = () => { limpar(); reject(new Error('Áudio indisponível')); };
      estado.retomar = () => audio.play().catch(erro => { limpar(); reject(erro); });
      if (!estado.pausada) estado.retomar();
    });
  } finally {
    audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    estado.audio = estado.retomar = null;
  }
}

export async function falar(frase) {
  pararVoz();
  const voz = document.body.dataset.voz;
  if (!['alex','dora'].includes(voz)) {
    window.speechSynthesis.speak(frase);
    return;
  }
  const estado = { cancelar:new AbortController(), pausada:false };
  sessao = estado;
  const arquivo = arquivos.get(frase.text.trim());
  const servidor = globalThis.chrome?.runtime?.id ? chrome.runtime.getManifest().homepage_url : location.href;
  try {
    const partes = arquivo ? [frase.text] : frase.text.match(/.{1,400}(?:[.!?]\s+|\s+|$)|.{1,400}/gs) || [];
    for (const texto of partes) {
      let url;
      if (arquivo) url = new URL('assets/vozes/' + voz + '/' + arquivo + '.mp3', import.meta.url).href;
      else {
        const resposta = await fetch(new URL('/api/voz', servidor), {method:'POST', credentials:'omit', redirect:'error',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify({voz,texto}), signal:estado.cancelar.signal});
        if (!resposta.ok || !resposta.headers.get('content-type')?.startsWith('audio/')) throw new Error('Voz indisponível');
        url = URL.createObjectURL(await resposta.blob());
      }
      try {
        const audio = new Audio(url);
        audio.playbackRate = frase.rate || 1;
        await reproduzir(audio, estado);
      } finally { if (!arquivo) URL.revokeObjectURL(url); }
    }
    if (sessao === estado) { sessao = null; frase.onend?.(); }
  } catch {
    if (sessao !== estado || estado.cancelar.signal.aborted) return;
    sessao = null;
    const aviso = document.getElementById('estado-voz');
    const mensagem = 'A voz escolhida está indisponível. A leitura segue com a voz do navegador.';
    if (aviso) aviso.textContent = mensagem;
    const status = document.getElementById('app-status');
    if (status && !aviso?.getClientRects().length) status.textContent = mensagem;
    window.speechSynthesis.speak(frase);
  }
}

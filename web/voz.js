import { falasFixas } from './falas-fixas.js';

const arquivos = new Map(Object.entries(falasFixas).map(([arquivo, texto]) => [texto, arquivo]));
let sessao;
let perfilPreparado;
const audiosPreparados = new Map();

function urlDaFala(voz, arquivo) {
  return new URL('assets/vozes/' + voz + '/' + arquivo + '.mp3', import.meta.url).href;
}

export function prepararFalas(mensagens) {
  if (typeof Audio !== 'function' || document.body.dataset.speakFocus === 'false') return;
  const voz = document.body.dataset.voz === 'alex' ? 'alex' : 'dora';
  if (perfilPreparado !== voz) {
    audiosPreparados.clear();
    perfilPreparado = voz;
  }
  for (const mensagem of mensagens) {
    const arquivo = arquivos.get(mensagem.trim());
    if (!arquivo || audiosPreparados.has(arquivo)) continue;
    const audio = new Audio(urlDaFala(voz, arquivo));
    audio.preload = 'auto';
    audiosPreparados.set(arquivo, audio);
  }
}

export function pararVoz() {
  if (sessao) {
    sessao.cancelar.abort();
    sessao.audio?.pause();
    sessao = null;
  }
}

export function pausarVoz(pausar) {
  if (!sessao) return;
  sessao.pausada = pausar;
  if (pausar) sessao.audio?.pause();
  else sessao.retomar?.();
}

// O modelo entrega o áudio do trecho sem marcas de tempo por palavra.
function acompanharPalavras(audio, trecho, inicio, avisar) {
  const palavras = [...trecho.matchAll(/\S+/g)];
  let anterior;
  const atualizar = () => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    const posicao = trecho.length * audio.currentTime / audio.duration;
    const palavra = palavras.findLast(p => p.index <= posicao);
    if (palavra && palavra !== anterior) {
      anterior = palavra;
      avisar({name:'word', charIndex:inicio + palavra.index});
    }
  };
  audio.addEventListener('playing', atualizar);
  audio.addEventListener('timeupdate', atualizar);
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
  const voz = document.body.dataset.voz === 'alex' ? 'alex' : 'dora';
  const estado = { cancelar:new AbortController(), pausada:false };
  sessao = estado;
  const arquivo = arquivos.get(frase.text.trim());
  const servidor = globalThis.chrome?.runtime?.id ? chrome.runtime.getManifest().homepage_url : location.href;
  try {
    const partes = arquivo ? [frase.text] : frase.text.match(/.{1,400}(?:[.!?]\s+|\s+|$)|.{1,400}/gs) || [];
    let inicio = 0;
    for (const texto of partes) {
      let url;
      if (arquivo) url = urlDaFala(voz, arquivo);
      else {
        const resposta = await fetch(new URL('/api/voz', servidor), {method:'POST', credentials:'omit', redirect:'error',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify({voz,texto}), signal:estado.cancelar.signal});
        if (!resposta.ok || !resposta.headers.get('content-type')?.startsWith('audio/')) throw new Error('Voz indisponível');
        url = URL.createObjectURL(await resposta.blob());
      }
      try {
        const preparado = arquivo && perfilPreparado === voz && audiosPreparados.get(arquivo);
        const audio = preparado || new Audio(url);
        if (preparado) audiosPreparados.delete(arquivo);
        audio.playbackRate = frase.rate || 1;
        if (frase.onboundary) acompanharPalavras(audio, texto, inicio, frase.onboundary);
        await reproduzir(audio, estado);
      } finally { if (!arquivo) URL.revokeObjectURL(url); }
      inicio += texto.length;
    }
    if (sessao === estado) { sessao = null; frase.onend?.(); }
  } catch {
    if (sessao !== estado || estado.cancelar.signal.aborted) return;
    sessao = null;
    const aviso = document.getElementById('estado-voz');
    const mensagem = 'O áudio de ' + (voz === 'alex' ? 'Alex' : 'Dora') + ' está indisponível. Tente ouvir novamente.';
    if (aviso) aviso.textContent = mensagem;
    const status = document.getElementById('app-status');
    if (status && !aviso?.getClientRects().length) status.textContent = mensagem;
    frase.onerror?.();
  }
}

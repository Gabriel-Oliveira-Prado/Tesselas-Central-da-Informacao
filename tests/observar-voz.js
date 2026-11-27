import { falasFixas } from '../web/falas-fixas.js';

// O teste de reprodução dos MP3 usa o decodificador real em vozes-extensao.spec.js.
// Aqui o áudio permanece tocando até que o teste acione os controles.
export async function observarVoz(page) {
  await page.addInitScript(falas => {
    const carregar = window.fetch.bind(window);
    window.leituras = [];
    window.acoesDeAudio = [];
    window.fetch = (url, opcoes) => {
      if (new URL(url, location.href).pathname !== '/api/voz') return carregar(url, opcoes);
      const {texto} = JSON.parse(opcoes.body);
      return Promise.resolve({ok:true, headers:new Headers({'content-type':'audio/wav'}),
        blob: async () => new Blob([texto], {type:'audio/wav'})});
    };
    const criarURL = URL.createObjectURL.bind(URL);
    const falasPorURL = new Map();
    URL.createObjectURL = blob => {
      const url = criarURL(blob);
      if (blob.type === 'audio/wav') falasPorURL.set(url, blob.text());
      return url;
    };
    window.Audio = class extends Audio {
      constructor(url) { super(); this.origem = url; }
      async play() {
        const texto = await (falasPorURL.get(this.origem) || falas[this.origem.split('/').pop().replace('.mp3','')]);
        window.leituras.push({texto, velocidade:this.playbackRate});
        window.acoesDeAudio.push(this.iniciada ? 'continuar' : 'ouvir');
        this.iniciada = true;
      }
      pause() { if (this.iniciada) window.acoesDeAudio.push('pausar'); }
    };
  }, falasFixas);
}

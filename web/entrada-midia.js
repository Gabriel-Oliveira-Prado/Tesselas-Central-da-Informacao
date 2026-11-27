import { transcribe } from './transcricao.js';
import { createReader, readFrame } from './captura-tela.js';
import { MAX_TEXT_LENGTH } from '../regras-negocio/validacao.js';

export function setupMediaInputs({ onReview, onResult, onCommand, onShareRequest = action => action() }) {
  const $ = id => document.getElementById(id);
  let active;
  async function begin(kind, file, paste = false) {
    active?.abort();
    const owner = new AbortController();
    const { signal } = owner;
    active = owner;
    const status = $(paste ? 'caption-status' : 'audio-input-status');
    status.classList.add('research-progress');
    status.dataset.busy = 'true';
    const stop = $(paste ? 'paste-media-stop' : 'audio-input-stop');
    const transcript = $(paste ? 'claim' : 'audio-transcript');
    let stream, player, objectURL, reader, timer, audioReady, inFrame, finishing = false;
    let collected = '', lastFrame = '', reachedLimit = false, speechText = '';
    const visualTexts = [];
    const display = text => { if (paste) transcript.value = text; else transcript.textContent = text; };
    const append = (text, audio = false) => {
      if (audio) speechText = (speechText+' '+text).trim().slice(0,MAX_TEXT_LENGTH);
      else {
        const clean = text.split('\n').map(line=>line.trim()).filter(line=>(line.match(/[\p{L}\p{N}]{2,}/gu)||[]).length>=3).join(' ');
        if (!clean || visualTexts.includes(clean)) return;
        const words = new Set(clean.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
        const repeated = visualTexts.some(previous=>{
          const before = new Set(previous.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
          return [...words].filter(word=>before.has(word)).length / Math.max(words.size,before.size) > .75;
        });
        if (!repeated) visualTexts.push(clean.slice(0,1000));
        if (visualTexts.length>8) visualTexts.shift();
      }
      collected = [speechText,...visualTexts].filter(Boolean).join('\n\n').slice(0, MAX_TEXT_LENGTH);
      display(collected);
      if (collected.length === MAX_TEXT_LENGTH && kind !== 'mic' && !reachedLimit) {
        reachedLimit = true;
        queueMicrotask(complete);
      }
    };
    function cleanup() {
      status.dataset.busy = 'false';
      clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (player) { player.onended = player.onerror = null; player.pause(); player.removeAttribute('src'); player.load(); }
      if (objectURL) URL.revokeObjectURL(objectURL);
      if (reader) void reader.terminate();
      stop.hidden = true;
      stop.onclick = null;
    }
    signal.addEventListener('abort', cleanup, { once: true });
    async function complete() {
      if (finishing || signal.aborted) return;
      finishing = true;
      if (kind === 'mic') stream.getTracks().forEach(track => track.stop());
      status.dataset.busy = 'true';
      status.textContent = kind === 'mic' ? 'Microfone encerrado. Lendo sua fala…' : 'Concluindo a transcrição. Aguarde…';
      player?.pause();
      clearTimeout(timer);
      try {
        const finishAudio = await audioReady;
        await finishAudio?.();
        await inFrame;
        if (signal.aborted) return;
        owner.abort();
        if (collected) {
          status.textContent = reachedLimit ? 'Primeiros 8.000 caracteres prontos para revisão.' : 'Transcrição pronta. Confira o trecho reconhecido.';
          const command = collected.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
          if (kind === 'mic' && ['abrir eleicoes', 'abrir acessibilidade', 'abrir configuracoes', 'colar informacao', 'voltar ao inicio'].includes(command)) onCommand(command);
          else if (paste) onReview(collected); else onResult(collected);
        } else status.textContent = 'Nenhuma fala ou frase legível encontrada. Tente outra fonte ou escreva o trecho.';
      } catch { if (!signal.aborted) { owner.abort(); status.textContent = 'Não foi possível concluir a leitura.'; } }
    }
    status.textContent = file ? 'Abrindo ' + file.name + '…' : 'Aguardando sua permissão…';
    display('');
    try {
      if (kind === 'mic') stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (kind === 'tab') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, selfBrowserSurface: 'exclude' });
        if (!stream.getAudioTracks().length) throw new Error('Escolha uma aba e marque Compartilhar áudio da aba.');
      }
      if (signal.aborted) { stream?.getTracks().forEach(t => t.stop()); return; }
      if (file) {
        player = document.createElement('video');
        player.playsInline = true;
        objectURL = URL.createObjectURL(file);
        player.src = objectURL;
        player.preload = 'auto';
      }
      const input = player || new MediaStream(stream.getAudioTracks());
      stop.hidden = false;
      stop.onclick = complete;
      stop.textContent = kind === 'mic' ? 'Encerrar microfone e pesquisar' : 'Concluir e verificar';
      if (kind !== 'mic') status.textContent = 'Preparando a transcrição em português…';
      audioReady = transcribe(input, signal, (words, final) => {
        if (final) append(words,true); else display((speechText + ' ' + words + '\n' + visualTexts.join('\n')).trim().slice(0, MAX_TEXT_LENGTH));
      }, () => {
        if (kind !== 'mic' || finishing) return;
        status.dataset.busy = 'false';
        status.textContent = 'Escutando. Fale agora e toque em Encerrar microfone e pesquisar quando terminar.';
      });
      await audioReady;
      if (signal.aborted || finishing) return;
      if (player) {
        player.onended = complete;
        player.onerror = () => { owner.abort(); status.textContent = 'Formato não reconhecido pelo navegador. Tente MP3, WAV, MP4 ou WebM.'; };
        await player.play();
        if (player.videoWidth) {
          const canvas = document.createElement('canvas');
          reader = await createReader(signal);
          if (signal.aborted) { await reader.terminate(); return; }
          const sample = async () => {
            if (signal.aborted || finishing) return;
            const scale = Math.min(1, 1440 / player.videoWidth);
            canvas.width = Math.round(player.videoWidth * scale); canvas.height = Math.round(player.videoHeight * scale);
            canvas.getContext('2d').drawImage(player, 0, 0, canvas.width, canvas.height);
            const { text } = await readFrame(reader, canvas, signal);
            if (text && text !== lastFrame) append(text);
            lastFrame = text;
          };
          const next = () => {
            inFrame = sample().catch(() => {});
            inFrame.then(() => { if (!signal.aborted && !finishing) timer = setTimeout(next, 1800); });
          };
          next();
        }
      } else if (kind === 'tab') stream.getTracks().forEach(track => track.addEventListener('ended', complete, { once: true }));
      if (!signal.aborted && kind !== 'mic') status.textContent = file ? 'Lendo ' + file.name + '. Você pode concluir o trecho antes do fim.' : 'Escutando a aba compartilhada. Escolha Concluir e verificar quando terminar.';
    } catch (err) {
      if (!signal.aborted) {
        owner.abort();
        status.textContent = err.name === 'NotAllowedError'
          ? kind === 'mic' ? 'Microfone bloqueado. Permita o microfone nas configurações do navegador e tente novamente.' : 'Compartilhamento cancelado. Escolha Compartilhar tela e ouvir para selecionar uma aba com áudio.'
          : err.message || 'Não foi possível abrir este áudio. Escolha outro arquivo.';
      }
    }
  }
  $('mic-input').onclick = () => begin('mic');
  $('tab-input').onclick = () => onShareRequest(() => begin('tab'));
  for (const id of ['audio-file', 'caption-file']) {
    $(id).addEventListener('change', () => {
      const file = $(id).files[0];
      if (file && !/\.(srt|vtt)$/i.test(file.name)) { begin('file', file, id === 'caption-file'); $(id).value = ''; }
      else active?.abort();
    });
  }
  return () => active?.abort();
}

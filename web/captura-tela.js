import { MAX_TEXT_LENGTH } from '../regras-negocio/validacao.js';
import { frameBytes } from './quadro-imagem.js';

function paragraphText(paragraph) {
  let text = '';
  let previous;
  for (const line of paragraph.lines) {
    const box = line.bbox;
    // Uma linha em branco pode separar um título e o texto mesmo dentro
    // do mesmo parágrafo detectado. Quebras normais continuam como espaços.
    if (previous) {
      const lineHeight = Math.min(box.y1 - box.y0, previous.y1 - previous.y0);
      text += box.y0 - previous.y1 > lineHeight ? '\n\n' : ' ';
    }
    text += line.text.trim();
    previous = box;
  }
  return text;
}

function chooseScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('sharing-unavailable');
  const controller = globalThis.CaptureController ? new CaptureController() : undefined;
  controller?.setFocusBehavior('no-focus-change');
  return navigator.mediaDevices.getDisplayMedia({
    video: true, audio: true, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', controller,
  });
}

export async function createReader(signal) {
  const { default: ocr } = await import('./vendor/ocr/tesseract.esm.min.js');
  signal.throwIfAborted();
  const assets = new URL('./vendor/ocr/', import.meta.url).href;
  const worker = await ocr.createWorker('por', 1, {
    workerPath: assets + 'worker.min.js', workerBlobURL: false,
    corePath: assets + 'tesseract-core-lstm.wasm.js', langPath: assets, cacheMethod: 'none',
  });
  try {
    signal.throwIfAborted();
    // Uma captura pode conter cabeçalhos, colunas e parágrafos independentes.
    await worker.setParameters({ tessedit_pageseg_mode: ocr.PSM.AUTO });
    return worker;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

export async function readFrame(worker, canvas, signal, centralContent = false) {
  signal.throwIfAborted();
  // A conversão assíncrona de canvas feita pelo motor pode ficar suspensa
  // quando o painel está em segundo plano. Um PNG síncrono preserva o quadro
  // recebido e permite ao worker começar a leitura sem depender dessa fila.
  const bytes = frameBytes(canvas);
  const { data } = await worker.recognize(bytes, {}, { text: true, blocks: true });
  signal.throwIfAborted();
  const blocks = data.blocks || [];
  const centralBlocks = blocks.filter(block => {
    const box = block.bbox;
    if (!box) return true;
    const center = (box.x0 + box.x1) / 2;
    return center > canvas.width * .15 && center < canvas.width * .85 && box.y1 > canvas.height * .1;
  });
  const selected = centralContent && centralBlocks.length ? centralBlocks : blocks;
  const paragraphs = selected.flatMap(block => block.paragraphs);
  const text = paragraphs.map(paragraphText).filter(Boolean).join('\n\n') || data.text.trim();
  return { text: text.slice(0, MAX_TEXT_LENGTH), truncated: text.length > MAX_TEXT_LENGTH, screen: true };
}

export async function followScreen(controller, { onStart, onFrame, onPreview = () => {}, onProgress = () => {}, isPaused = () => false }) {
  const { signal } = controller;
  const stream = await chooseScreen();
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const track = stream.getVideoTracks()[0];
  const end = () => controller.abort();
  const stop = () => {
    stream.getTracks().forEach(item => item.stop());
    video.srcObject = null;
  };
  signal.addEventListener('abort', stop, { once: true });
  track.addEventListener('ended', end, { once: true });
  let worker;
  let firstFrame = true;
  try {
    signal.throwIfAborted();
    if (track.getCaptureHandle?.()?.handle === 'central-painel') throw new Error('own-panel');
    onStart(stream);
    video.muted = video.playsInline = true;
    video.srcObject = stream;
    onProgress('Preparando os quadros da área compartilhada…');
    await video.play();
    onProgress('Carregando o reconhecimento de texto no dispositivo…');
    worker = await createReader(signal);
    onProgress('Reconhecendo o primeiro quadro…');
    while (!signal.aborted) {
      if (!isPaused() && video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const sampledAt = new Date();
        onPreview(canvas,sampledAt);
        if(firstFrame) { onProgress('Lendo o texto do primeiro quadro…');firstFrame=false; }
        const content = await readFrame(worker, canvas, signal, true);
        if (track.getCaptureHandle?.()?.handle === 'central-painel') throw new Error('own-panel');
        const ownInterface = /trecho em an[aá]lise|como podemos ajudar\?|resultados do acompanhamento/i.test(content.text);
        if (ownInterface) throw new Error('own-panel');
        await onFrame(content, canvas, sampledAt);
      }
      if (!signal.aborted) await new Promise(resolve => {
        const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, 1800);
        signal.addEventListener('abort', done, { once: true });
      });
    }
  } finally {
    stop();
    track.removeEventListener('ended', end);
    signal.removeEventListener('abort', stop);
    canvas.width = canvas.height = 0;
    await worker?.terminate();
  }
}

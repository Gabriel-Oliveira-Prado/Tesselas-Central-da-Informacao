import { MAX_TEXT_LENGTH } from './core.js';

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

// A escolha da superfície precisa acontecer dentro do clique da pessoa.
export async function readSharedScreen(signal, onProgress) {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('sharing-unavailable');
  const controller = globalThis.CaptureController ? new CaptureController() : undefined;
  controller?.setFocusBehavior('no-focus-change');
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true, audio: false, selfBrowserSurface: 'exclude', controller,
  });
  const stop = () => stream.getTracks().forEach((track) => track.stop());
  signal.addEventListener('abort', stop, { once: true });
  let canvas;
  try {
    signal.throwIfAborted();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    let timer;
    try {
      const frameReady = new Promise((resolve, reject) => {
        video.requestVideoFrameCallback(resolve);
        stream.getVideoTracks()[0].addEventListener('ended', () => reject(new Error('capture-ended')), { once: true });
        timer = setTimeout(() => reject(new Error('capture-ended')), 8000);
      });
      await Promise.all([video.play(), frameReady]);
      signal.throwIfAborted();
      canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
    } finally {
      clearTimeout(timer);
      video.srcObject = null;
    }
  } finally {
    stop();
    signal.removeEventListener('abort', stop);
  }

  onProgress('Compartilhamento encerrado. Lendo o texto da imagem…');
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
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    signal.throwIfAborted();
    // O OCR quebra linhas quando o texto chega à margem da janela.
    const paragraphs = (data.blocks || []).flatMap((block) => block.paragraphs);
    const text = paragraphs.map(paragraphText).filter(Boolean).join('\n\n') || data.text.trim();
    if (!text) throw new Error('no-text');
    return { text: text.slice(0, MAX_TEXT_LENGTH), truncated: text.length > MAX_TEXT_LENGTH, screen: true };
  } finally {
    canvas.width = canvas.height = 0;
    await worker.terminate();
  }
}

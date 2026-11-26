const modelURL = new URL('./vendor/speech/pt.tar.gz', import.meta.url).href;

export async function transcribe(input, signal, onWords) {
  const context = new AudioContext({ sampleRate: 16000 });
  let model, recognizer, source, node, drained, final;
  const close = () => {
    node?.disconnect();
    source?.disconnect();
    model?.terminate();
    if (context.state !== 'closed') void context.close();
    drained?.();
    final?.();
  };
  signal.addEventListener('abort', close, { once: true });
  try {
    await context.resume();
    await import('./vendor/speech/vosk.js');
    signal.throwIfAborted();
    model = new Vosk.Model(modelURL, -2);
    await new Promise((resolve, reject) => {
      const cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      model.on('load', msg => { signal.removeEventListener('abort', cancel); msg.result ? resolve() : reject(new Error('Falha ao abrir o modelo de português.')); });
      model.on('error', () => reject(new Error('Não consegui iniciar a transcrição local.')));
    });
    signal.throwIfAborted();
    recognizer = new model.KaldiRecognizer(context.sampleRate);
    recognizer.on('partialresult', msg => { if (!signal.aborted && msg.result.partial) onWords(msg.result.partial, false); });
    recognizer.on('result', msg => {
      if (!signal.aborted && msg.result.text) onWords(msg.result.text, true);
      if (msg.final) final?.();
    });
    await context.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url));
    signal.throwIfAborted();
    source = input instanceof MediaStream ? context.createMediaStreamSource(input) : context.createMediaElementSource(input);
    node = new AudioWorkletNode(context, 'speech-samples', { channelCount: 1, channelCountMode: 'explicit' });
    node.port.onmessage = ({ data }) => {
      if (data === 'flushed') drained?.();
      else if (!signal.aborted) recognizer.acceptWaveformFloat(data, context.sampleRate);
    };
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(context.destination);
    return async function finish() {
      if (signal.aborted) return;
      source.disconnect();
      let timeout;
      try {
        const flush = async () => {
          await new Promise(resolve => { drained = resolve; node.port.postMessage('flush'); });
          if (!signal.aborted) await new Promise(resolve => { final = resolve; recognizer.retrieveFinalResult(); });
        };
        await Promise.race([flush(), new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('A transcrição foi interrompida.')), 8000);
        })]);
      } finally { clearTimeout(timeout); }
    };
  } catch (error) {
    signal.removeEventListener('abort', close);
    if (!signal.aborted) close();
    throw error;
  }
}

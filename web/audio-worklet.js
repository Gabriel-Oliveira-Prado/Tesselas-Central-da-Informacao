class SpeechSamples extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(4096);
    this.used = 0;
    this.port.onmessage = () => {
      if (this.used) this.port.postMessage(this.samples.slice(0, this.used));
      this.used = 0;
      this.port.postMessage('flushed');
    };
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) for (const value of channel) {
      this.samples[this.used++] = value;
      if (this.used === this.samples.length) {
        this.port.postMessage(this.samples, [this.samples.buffer]);
        this.samples = new Float32Array(4096);
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor('speech-samples', SpeechSamples);

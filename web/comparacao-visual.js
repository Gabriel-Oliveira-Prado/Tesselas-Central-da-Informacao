import { references } from '../regras-negocio/referencias-visuais.js';

const samples = references.map(ref => ({ ...ref, bytes: Uint8Array.from(atob(ref.rgb), c => c.charCodeAt(0)) }));

// Compara a composição e as cores da arte completa. Um encontro sugere a publicação de origem.
export function findVisualReference(frame) {
  const preview = document.createElement('canvas');
  const scale = 120 / Math.max(frame.width, frame.height);
  preview.width = Math.max(1, Math.round(frame.width * scale));
  preview.height = Math.max(1, Math.round(frame.height * scale));
  const ctx = preview.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(frame, 0, 0, preview.width, preview.height);
  const pixels = ctx.getImageData(0, 0, preview.width, preview.height).data;
  let best;
  let lowest = 13;
  for (const ref of samples) {
    const maximum = Math.min(preview.width, preview.height * ref.ratio);
    for (const fraction of [1, .9, .8, .7, .6, .5]) {
      const width = Math.floor(maximum * fraction);
      const height = Math.round(width / ref.ratio);
      if (height < 12) continue;
      for (let y = 0; y <= preview.height - height; y += 2) {
        for (let x = 0; x <= preview.width - width; x += 2) {
          let error = 0;
          for (let i = 0; i < 144 && error < lowest * 432; i++) {
            // A média de quatro amostras reduz o efeito de uma linha fina ou letra.
            const col = i % 12, row = Math.floor(i / 12);
            const left = x + Math.floor((col + .25) * width / 12);
            const right = x + Math.floor((col + .75) * width / 12);
            const top = (y + Math.floor((row + .25) * height / 12)) * preview.width;
            const bottom = (y + Math.floor((row + .75) * height / 12)) * preview.width;
            for (let channel = 0; channel < 3; channel++) {
              const mean = (pixels[(top + left) * 4 + channel] + pixels[(top + right) * 4 + channel]
                + pixels[(bottom + left) * 4 + channel] + pixels[(bottom + right) * 4 + channel]) / 4;
              error += Math.abs(mean - ref.bytes[i * 3 + channel]);
            }
          }
          if (error / 432 < lowest) { lowest = error / 432; best = ref.id; }
        }
      }
    }
  }
  return best;
}

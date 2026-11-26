import { MAX_TEXT_LENGTH } from '../regras-negocio/validacao.js';

const fileInput = document.getElementById('caption-file');
const choice = document.getElementById('caption-choice');
const select = document.getElementById('caption-cue');
const status = document.getElementById('caption-status');
let cues = [];
let revision = 0;

function readCues(source) {
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n+/);
  const time = /^(?:(?:\d{2,}):)?\d{2}:\d{2}[.,]\d{3}$/;
  const result = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (/^(?:WEBVTT|NOTE|REGION|STYLE)(?:\s|$)/.test(lines[0])) continue;
    const timing = lines[0].includes('-->') ? 0 : 1;
    const [start, end] = (lines[timing] || '').trim().split(/\s+-->\s+/);
    if (!time.test(start) || !time.test(end?.split(/\s+/)[0])) continue;
    const payload = lines.slice(timing + 1).join(' ').trim();
    const text = new VTTCue(0, 1, payload).getCueAsHTML().textContent.trim();
    if (text) result.push({ start, text });
  }
  return result;
}

fileInput.addEventListener('change', async () => {
  const current = ++revision;
  const file = fileInput.files[0];
  choice.hidden = true;
  select.replaceChildren();
  cues = [];
  fileInput.removeAttribute('aria-invalid');
  status.textContent = '';
  if (!file) return;
  if (!/\.(srt|vtt)$/i.test(file.name)) return;
  try {
    if (file.size > 2000000) {
      throw new Error('Escolha uma legenda SRT ou VTT de até 2 MB.');
    }
    const source = await file.text();
    if (revision !== current) return;
    cues = readCues(source);
    if (!cues.length) throw new Error('Nenhuma fala com marcação de tempo foi encontrada. Você também pode colar a transcrição abaixo.');
    const options = document.createDocumentFragment();
    for (const [index, cue] of cues.entries()) {
      options.append(new Option(`${cue.start} · ${cue.text.slice(0, 85)}`, String(index)));
    }
    select.append(options);
    choice.hidden = false;
    status.textContent = `Falas disponíveis: ${cues.length}. Escolha uma para revisar.`;
  } catch (error) {
    if (revision !== current) return;
    fileInput.setAttribute('aria-invalid', 'true');
    status.textContent = error.name === 'Error' ? error.message : 'Não foi possível abrir a legenda. Tente outro arquivo ou cole a fala abaixo.';
  }
});

document.getElementById('use-caption').addEventListener('click', () => {
  const cue = cues[select.selectedIndex];
  if (!cue) return;
  if (cue.text.length > MAX_TEXT_LENGTH) {
    status.textContent = 'Esta fala ultrapassa 8.000 caracteres. Copie um trecho menor do arquivo ou escolha outra fala.';
    return;
  }
  const field = document.getElementById('claim');
  field.value = cue.text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.focus();
});

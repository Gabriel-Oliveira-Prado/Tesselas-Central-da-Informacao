import { MAX_TEXT_LENGTH, MAX_SEARCH_LENGTH, validateClaim, createSearchLinks, safePreferences } from './core.js';
import { readPageContent } from './page-reader.js';
import { readSharedScreen } from './screen-reader.js';
import { findFactChecks } from './verification.js';

const $ = (id) => document.getElementById(id);
const extension = Boolean(globalThis.chrome?.runtime?.id && globalThis.chrome?.scripting);
if (extension) $('project-version').textContent = `Versão ${chrome.runtime.getManifest().version}`;
const voiceAvailable = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let lastContent = null;
let speech = null;
let speechPaused = false;
let preferenceRevision = 0;
let captureRevision = 0;
let homeTrigger = 'analyze-page';
document.querySelectorAll('.action-card').forEach((button) => {
  button.addEventListener('click', () => { homeTrigger = button.id; }, { capture: true });
});
let activeCapture;

function announce(message) { $('app-status').textContent = message; }

function resetSpeech() {
  speech = null;
  speechPaused = false;
  if (voiceAvailable) window.speechSynthesis.cancel();
  $('speak').disabled = !voiceAvailable;
  $('pause-speech').disabled = true;
  $('pause-speech').textContent = 'Pausar';
  $('stop-speech').disabled = true;
}

function showView(name, focusId) {
  activeCapture?.abort();
  captureRevision += 1;
  if (name !== 'audio') resetSpeech();
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  $(focusId).focus();
  window.scrollTo(0, 0);
}

function goHome() {
  $('analyze-page').disabled = false;
  showView('home', homeTrigger);
  $('loading-message').hidden = true;
  $('home-view').removeAttribute('aria-busy');
}
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', goHome));

function openPaste() { showView('paste', 'paste-title'); }
$('open-paste').addEventListener('click', openPaste);
$('retry-paste').addEventListener('click', openPaste);
$('open-settings').addEventListener('click', () => showView('settings', 'settings-title'));
$('open-audio').addEventListener('click', () => {
  $('audio-text-details').hidden = !lastContent;
  $('audio-text').textContent = lastContent?.text || '';
  $('audio-description').textContent = lastContent ? 'Ouça o último texto analisado e o resultado da consulta.'
    : extension ? 'Permita a leitura do texto da aba aberta para ouvi-lo.' : 'Escolha uma tela com texto para ouvir seu conteúdo.';
  $('speak').textContent = lastContent ? 'Ouvir' : extension ? 'Permitir leitura da aba e ouvir' : 'Compartilhar tela e ouvir';
  showView('audio', 'audio-title');
});

function clearError() {
  $('claim').removeAttribute('aria-invalid');
  $('claim-error').hidden = true;
  $('claim-error').textContent = '';
}

$('claim').addEventListener('input', () => {
  clearError();
  lastContent = null;
  $('result-matches').replaceChildren();
  $('search-links').replaceChildren();
  resetSpeech();
});

async function captureTabText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('missing-tab');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id }, func: readPageContent, args: [{ mode: 'page', limit: MAX_TEXT_LENGTH }],
  });
  if (!result?.text || result.error) throw new Error('empty-page');
  return result;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderSearchLinks() {
  const links = createSearchLinks($('search-query').value);
  $('search-links').replaceChildren();
  $('search-query-error').hidden = Boolean(links.length);
  $('search-query-error').textContent = links.length ? '' : 'Escreva um trecho de até 300 caracteres.';
  if (links.length) $('search-query').removeAttribute('aria-invalid');
  else $('search-query').setAttribute('aria-invalid', 'true');
  for (const item of links) {
    const link = element('a', `${item.label} (nova aba)`);
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const li = document.createElement('li');
    li.append(link);
    $('search-links').append(li);
  }
}
$('search-query').addEventListener('input', renderSearchLinks);

function renderResult(content) {
  lastContent = content;
  const matches = findFactChecks(content.text);
  $('result-title').textContent = matches.length ? 'Checagem encontrada' : 'Sem conclusão';
  $('result-summary').textContent = matches.length
    ? 'Compare a afirmação encontrada com a explicação da fonte.'
    : 'Não encontrei esta afirmação na base inicial. Isso não confirma nem desmente a informação.';
  $('result-scope').textContent = matches.length
    ? 'Esta checagem se refere ao trecho indicado, não à página inteira. A base inicial tem apenas três checagens.'
    : 'A base inicial tem apenas três checagens. Você pode consultar outras fontes abaixo.';
  if (content.truncated) $('result-scope').textContent += ' Foram lidos apenas os primeiros 8.000 caracteres.';
  $('allow-tab').hidden = true;
  if (content.screen) $('result-scope').textContent += ' Confira o texto lido na imagem. Você pode corrigir uma palavra e consultar novamente.';
  $('result-matches').replaceChildren();
  for (const match of matches) {
    const article = document.createElement('article');
    article.className = 'evidence';
    article.setAttribute('aria-label', `Checagem: ${match.claim}`);
    article.append(element('p', 'Afirmação na base', 'small'), element('blockquote', match.claim), element('p', match.finding, 'finding'), element('p', match.explanation));
    const link = element('a', 'Consultar fonte (nova aba)');
    link.href = match.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    article.append(link, element('p', `${match.source} · consultada em ${match.consultedAt.split('-').reverse().join('/')}`, 'small'));
    $('result-matches').append(article);
  }
  $('reviewed-claim').textContent = content.text;
  $('source-context').hidden = !content.url;
  $('source-context').textContent = content.url ? `Origem: ${content.title || content.url}. ${content.url}` : '';
  $('read-text-details').hidden = false;
  $('search-details').hidden = false;
  $('read-text-details').open = false;
  $('search-details').open = false;
  $('retry-paste').hidden = true;
  $('search-query').value = content.text.slice(0, MAX_SEARCH_LENGTH);
  renderSearchLinks();
  showView('result', 'result-title');
  announce(`${$('result-title').textContent}. ${$('result-summary').textContent}`);
}

function showCaptureError(error, fromScreen) {
  lastContent = null;
  const denied = error.name === 'NotAllowedError';
  const messages = {
    'sharing-unavailable': 'Abra este painel no Chrome ou Edge de computador para escolher uma tela, ou cole o texto abaixo.',
    'no-text': 'Amplie o trecho na tela e tente novamente. Você também pode colar a informação.',
    'capture-ended': 'A captura foi interrompida. Volte para escolher a tela novamente.',
  };
  $('result-title').textContent = denied ? 'Tela não compartilhada' : 'Não consegui ler o conteúdo';
  $('result-summary').textContent = denied ? 'Volte para escolher uma tela ou cole a informação.'
    : messages[error.message] || (fromScreen ? 'Tente compartilhar novamente no Chrome ou Edge de computador. Você também pode colar o texto.' : 'Abra a extensão pelo ícone na aba desejada ou cole a informação.');
  $('result-scope').textContent = '';
  $('result-matches').replaceChildren();
  $('read-text-details').hidden = true;
  $('search-details').hidden = true;
  $('retry-paste').hidden = false;
  $('allow-tab').hidden = !extension || !fromScreen;
  showView('result', 'result-title');
  announce($('result-title').textContent);
}

function reportCapture(message) {
  $('loading-message').textContent = message;
  announce(message);
}

async function analyze(fromScreen) {
  resetSpeech();
  activeCapture?.abort();
  activeCapture = new AbortController();
  const revision = ++captureRevision;
  $('analyze-page').disabled = true;
  $('allow-tab').disabled = true;
  $('home-view').setAttribute('aria-busy', 'true');
  $('loading-message').hidden = false;
  reportCapture(fromScreen ? 'Escolha uma aba, janela ou tela no navegador.' : 'Lendo o texto da aba…');
  try {
    const content = fromScreen ? await readSharedScreen(activeCapture.signal, reportCapture) : await captureTabText();
    if (revision === captureRevision) renderResult(content);
  } catch (error) {
    if (revision === captureRevision) showCaptureError(error, fromScreen);
  } finally {
    if (revision === captureRevision || !activeCapture || activeCapture.signal.aborted) {
      $('analyze-page').disabled = false;
      $('allow-tab').disabled = false;
      $('home-view').removeAttribute('aria-busy');
      $('loading-message').hidden = true;
    }
  }
}
$('analyze-page').addEventListener('click', () => analyze(true));
$('allow-tab').addEventListener('click', () => analyze(false));
$('edit-read-text').addEventListener('click', () => {
  $('claim').value = lastContent.text;
  clearError();
  showView('paste', 'claim');
});

$('review-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const validation = validateClaim($('claim').value);
  if (!validation.valid) {
    $('claim-error').textContent = validation.message;
    $('claim-error').hidden = false;
    $('claim').setAttribute('aria-invalid', 'true');
    $('claim').focus();
    announce(validation.message);
    return;
  }
  clearError();
  renderResult({ text: validation.text });
});

function applyPreferences(preferences) {
  const safe = safePreferences(preferences);
  document.documentElement.style.fontSize = `${safe.fontSize}%`;
  document.body.dataset.contrast = safe.highContrast ? 'high' : 'default';
  document.body.dataset.largeText = Number(safe.fontSize) >= 150 ? 'true' : 'false';
  $('font-size').value = safe.fontSize;
  $('standard-colors').checked = !safe.highContrast;
}
async function readPreferences() {
  const revision = preferenceRevision;
  try {
    const stored = extension ? (await chrome.storage.local.get('readingPreferences')).readingPreferences : JSON.parse(localStorage.getItem('central-reading') || localStorage.getItem('clareia-reading') || '{}');
    if (revision === preferenceRevision) applyPreferences(stored || {});
  } catch { if (revision === preferenceRevision) applyPreferences({}); }
}
async function savePreferences() {
  preferenceRevision += 1;
  const preferences = safePreferences({ fontSize: $('font-size').value, highContrast: !$('standard-colors').checked });
  applyPreferences(preferences);
  try {
    if (extension) await chrome.storage.local.set({ readingPreferences: preferences });
    else {
      localStorage.setItem('central-reading', JSON.stringify(preferences));
      localStorage.removeItem('clareia-reading');
    }
    announce('Ajustes de leitura salvos neste dispositivo.');
  } catch { announce('Ajustes aplicados. Não foi possível salvá-los.'); }
}
$('font-size').addEventListener('change', savePreferences);
$('standard-colors').addEventListener('change', savePreferences);
readPreferences();

if (!voiceAvailable) {
  $('speak').disabled = true;
  $('speech-help').textContent = 'A voz não está disponível neste navegador. Você pode usar seu leitor de tela.';
}

$('speak').addEventListener('click', async () => {
  const revision = ++captureRevision;
  $('speak').disabled = true;
  if (!lastContent) {
    try {
      activeCapture = new AbortController();
      const content = extension ? await captureTabText() : await readSharedScreen(activeCapture.signal, (message) => {
        $('audio-description').textContent = message;
        announce(message);
      });
      if (revision !== captureRevision) return;
      lastContent = content;
    } catch {
      if (revision === captureRevision) {
        $('speak').disabled = false;
        $('audio-description').textContent = 'Não consegui ler a página. Volte e use Colar informação para inserir um texto.';
        announce($('audio-description').textContent);
      }
      return;
    }
  }
  resetSpeech();
  $('audio-text').textContent = lastContent.text;
  $('audio-text-details').hidden = false;
  $('speak').textContent = 'Ouvir';
  $('audio-description').textContent = 'Ouça o texto e o resultado da consulta.';
  const checks = findFactChecks(lastContent.text);
  const explanation = checks.length
    ? checks.map((item) => `Afirmação na base: ${item.claim} ${item.finding}. ${item.explanation} Fonte: ${item.source}.`).join(' ')
    : 'Sem conclusão. Não encontrei esta afirmação na base inicial.';
  const utterance = new SpeechSynthesisUtterance(`Texto lido: ${lastContent.text} Resultado da consulta: ${explanation}`);
  utterance.lang = 'pt-BR';
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((item) => item.localService && /^pt[-_]BR$/i.test(item.lang)) || voices.find((item) => item.localService && /^pt/i.test(item.lang)) || voices.find((item) => /^pt/i.test(item.lang));
  if (voice) utterance.voice = voice;
  speech = utterance;
  function finish(message) {
    if (speech !== utterance) return;
    const restoreFocus = [$('pause-speech'), $('stop-speech')].includes(document.activeElement);
    resetSpeech();
    if (restoreFocus) $('speak').focus();
    announce(message);
  }
  utterance.onend = () => finish('Leitura concluída.');
  utterance.onerror = () => finish('Não foi possível concluir a leitura. Confira as vozes do navegador.');
  $('speak').disabled = true;
  $('pause-speech').disabled = false;
  $('stop-speech').disabled = false;
  window.speechSynthesis.speak(utterance);
  $('pause-speech').focus();
  announce('Leitura iniciada. Use Pausar ou Parar para controlar.');
});
$('pause-speech').addEventListener('click', () => {
  if (!speech) return;
  if (speechPaused) window.speechSynthesis.resume(); else window.speechSynthesis.pause();
  speechPaused = !speechPaused;
  $('pause-speech').textContent = speechPaused ? 'Continuar' : 'Pausar';
  announce(speechPaused ? 'Leitura pausada.' : 'Leitura retomada.');
});
$('stop-speech').addEventListener('click', () => {
  resetSpeech();
  $('speak').focus();
  announce('Leitura interrompida.');
});
window.addEventListener('pagehide', () => { activeCapture?.abort(); resetSpeech(); });

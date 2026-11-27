import { MAX_TEXT_LENGTH, MAX_SEARCH_LENGTH, validateClaim, createSearchLinks, safePreferences } from '../regras-negocio/validacao.js';
import { loadReadingPreferences, applyReadingPreferences } from './preferencias.js';
import './legendas.js';
import { openElectionNews } from './eleicoes.js';
import { readPageContent } from './leitura-pagina.js';
import { readSharedScreen, followScreen } from './captura-tela.js';
import { evidenceFor, showEvidence, renderVerdict } from './resultados.js';
import { createVisualAssistant, describeFrame, visualAvailability } from './assistente-visual.js';
import { findVisualReference } from './comparacao-visual.js';
import { setupMediaInputs } from './entrada-midia.js';
import { transcribe } from './transcricao.js';
import { prepareIndicator } from './indicador-captura.js';
import { readArticle, articleUrl, refreshContext } from '../regras-negocio/noticias.js';
import { FACT_CHECKS } from '../regras-negocio/checagens.js';
import { research } from '../regras-negocio/pesquisa.js';
import { enableAccessibleNavigation, highlightSpeech } from './navegacao-acessivel.js';
import { setLibras } from './libras.js';
import { conclusionFor } from '../regras-negocio/veredito.js';

const $ = (id) => document.getElementById(id);
const extension = Boolean(globalThis.chrome?.runtime?.id && globalThis.chrome?.scripting);
document.body.classList.remove('no-js');
if (extension) $('project-version').textContent = `Versão ${chrome.runtime.getManifest().version}`;
const voiceAvailable = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let lastContent = null;
let speech = null;
let speechPaused = false;
let audioFromResult = false;
let preferenceRevision = 0;
let captureRevision = 0;
let homeTrigger = 'analyze-page';
document.querySelectorAll('.action-card').forEach((button) => {
  button.addEventListener('click', () => { homeTrigger = button.id; }, { capture: true });
});
let activeCapture;
let activeResearch;
let liveSession;
let finishLiveAudio;
let sessionHistory = [];
let checkScope = 'general';
let shareAction;
let shareOrigin = 'screen';
try { navigator.mediaDevices?.setCaptureHandleConfig?.({ handle: 'central-painel', permittedOrigins: ['*'] }); } catch { /* Disponibilidade varia com a superfície. */ }
enableAccessibleNavigation();
const stopMediaInputs = setupMediaInputs({
  onShareRequest(action) { requestSharing(action, 'audio'); },
  onReview(text) { $('claim').value = text; $('claim').dispatchEvent(new Event('input')); $('claim').focus(); },
  async onResult(text) {
    activeResearch?.abort();
    activeResearch = new AbortController();
    const current = ++captureRevision;
    progress('audio-input-status', true, 'Pesquisando o trecho reconhecido nas fontes…');
    try {
      const evidence = await research(text,undefined,{signal:activeResearch.signal});
      if (current === captureRevision) renderResult({ text, evidence });
    } catch { if (current===captureRevision) $('audio-input-status').textContent='A pesquisa foi interrompida. Tente novamente.'; }
  },
  onCommand(command) {
    if (command === 'voltar ao inicio') { goHome(); return; }
    const button = command === 'abrir eleicoes' ? 'open-elections' : command === 'colar informacao' ? 'open-paste' : 'open-settings';
    $(button).click();
  },
});

if (!extension) {
  for (const link of document.querySelectorAll('.libras-link')) link.href = '../demo/libras.html';
}
$('copy-libras').addEventListener('click', async () => {
  const field = $('libras-text');
  try {
    await navigator.clipboard.writeText(field.value);
    $('libras-status').textContent = 'Conclusão copiada.';
  } catch {
    field.focus();
    field.select();
    $('libras-status').textContent = 'O texto está selecionado. Use a opção Copiar do navegador.';
  }
});

function announce(message) { $('app-status').textContent = message; }
function progress(id, busy, message) {
  const status = $(id);
  status.classList.add('research-progress');
  status.dataset.busy = String(busy);
  status.textContent = message;
}
function setLiveConclusion(evidence, pending) {
  const verdict = conclusionFor(evidence);
  renderVerdict($('live-verdict'), pending ? 'pending' : verdict.kind, pending ? 'Verificação em andamento' : verdict.label);
  progress('live-progress', pending, pending ? 'Buscando evidências. Aguarde o resultado deste trecho…' : 'Checagem deste trecho concluída. Continuo acompanhando novas informações.');
}
function requestSharing(action, origin = 'screen') {
  shareAction = action;
  shareOrigin = origin;
  $('read-tab-alternative').hidden = !extension;
  progress('capture-help-status',false,'');
  showView('capture-help', 'capture-help-title');
}
$('start-sharing').addEventListener('click', () => {
  const action = shareAction;
  shareAction = undefined;
  if (shareOrigin === 'audio') showView('audio', 'audio-title');
  action?.();
});
$('share-paste-alternative').addEventListener('click', () => openPaste());
$('read-tab-alternative').addEventListener('click', () => analyze(false));

function resetSpeech() {
  speech = null;
  speechPaused = false;
  if (voiceAvailable) window.speechSynthesis.cancel();
  $('speak').disabled = !voiceAvailable;
  $('speech-rate').disabled = !voiceAvailable;
  $('pause-speech').disabled = true;
  $('pause-speech').textContent = 'Pausar';
  $('stop-speech').disabled = true;
}

function showView(name, focusId) {
  activeResearch?.abort();
  stopMediaInputs();
  if (name !== 'live') liveSession?.abort();
  activeCapture?.abort();
  captureRevision += 1;
  if (name !== 'audio') resetSpeech();
  if (name === 'paste' || name === 'elections') $(name === 'paste' ? 'paste-entry' : 'election-entry').append($('checker-entry'));
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  document.title = `${$(name + '-view').querySelector('h1').textContent} — Central da Informação`;
  window.scrollTo(0, 0);
  $(focusId).focus();
}

let supportTrigger;
for (const button of document.querySelectorAll('[data-support]')) {
  button.addEventListener('click', () => {
    supportTrigger = button.id;
    for (const part of document.querySelectorAll('.support-content')) part.hidden = part.id !== button.dataset.support;
    $('support-title').textContent = button.textContent;
    showView('support', 'support-title');
  });
}
function goHome() {
  if (!$('support-view').hidden) { showView('result', supportTrigger); return; }
  if (audioFromResult && !$('audio-view').hidden) {
    audioFromResult = false;
    showView('result', 'listen-result');
    return;
  }
  $('analyze-page').disabled = false;
  showView('home', homeTrigger);
  $('loading-message').hidden = true;
  $('home-view').removeAttribute('aria-busy');
}
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', goHome));

function openPaste() { checkScope = 'general'; progress('research-status',false,''); void refreshContext(); showView('paste', 'paste-title'); }
$('open-elections').addEventListener('click', () => {
  checkScope = 'elections';
  showView('elections', 'elections-title');
  openElectionNews();
});
$('open-paste').addEventListener('click', openPaste);
$('retry-paste').addEventListener('click', openPaste);
$('open-settings').addEventListener('click', () => showView('settings', 'settings-title'));
function prepareAudio(fromResult) {
  if (!fromResult) checkScope = 'general';
  audioFromResult = fromResult;
  $('speech-help').textContent = '';
  $('audio-description').textContent = '';
  $('reading-controls').hidden = !lastContent;
  $('speak').textContent = 'Ouvir última informação';
  showView('audio', 'audio-title');
}
$('open-audio').addEventListener('click', () => prepareAudio(false));
$('listen-result').addEventListener('click', () => {
  prepareAudio(true);
  $('speak').click();
});
$('new-query').addEventListener('click', () => {
  $('claim').value = '';
  clearError();
  progress('research-status',false,'');
  showView(checkScope === 'elections' ? 'elections' : 'paste', 'claim');
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
  const evidence = content.evidence || evidenceFor(content.text, content.story);
  if (content.story && !evidence.exact.some(item => item.url === content.story.url)) evidence.news = [content.story, ...evidence.news.filter(n => n.url !== content.story.url)];
  const matches = evidence.exact;
  for (const id of ['research-status','audio-input-status']) $(id).dataset.busy = 'false';
  const context = evidence.related.length || evidence.news.length;
  const conclusion = conclusionFor(evidence);
  renderVerdict($('result-title'), conclusion.kind, conclusion.label);
  $('result-summary').textContent = conclusion.explanation;
  $('result-scope').textContent = matches.length ? 'Esta checagem se refere ao trecho indicado, não à página inteira.' : 'Você pode consultar outras fontes abaixo.';
  if (evidence.search?.status === 'unavailable') $('result-scope').textContent += ' As fontes online estão indisponíveis neste momento. Você pode tentar pesquisar novamente.';
  const avisosIA = { 'sem-chave':'A comparação por IA ainda não foi ativada neste servidor.', quota:'A cota de comparação por IA foi atingida.', indisponivel:'A comparação por IA está indisponível agora.' };
  if (avisosIA[evidence.ia?.status]) $('result-scope').textContent += ' ' + avisosIA[evidence.ia.status];
  if (content.truncated) $('result-scope').textContent += ' Foram lidos apenas os primeiros 8.000 caracteres.';
  $('allow-tab').hidden = true;
  if (content.screen) $('result-scope').textContent += ' Confira o texto lido na imagem. Você pode corrigir uma palavra e consultar novamente.';
  $('result-matches').replaceChildren();
  $('listen-result').hidden = !voiceAvailable;
  $('result-tools').hidden = false;
  $('libras-status').textContent = '';
  $('libras-text').value = evidence.orientation ? evidence.orientation.explanation : matches.length ? matches.map((item) => `${item.claim} ${item.finding}. ${item.explanation} Fonte: ${item.source}.`).join('\n\n') : [$('result-title').textContent, $('result-summary').textContent, ...evidence.related.map(r => r.explanation), ...evidence.news.map(r => r.title + '. ' + r.source)].join(' ');
  showEvidence($('result-matches'), evidence);
  $('reviewed-claim').value = content.text;
  $('source-context').hidden = !content.url;
  $('source-context').textContent = content.url ? `Origem: ${content.title || content.url}. ${content.url}` : '';
  $('retry-paste').hidden = true;
  $('search-query').value = content.text.slice(0, MAX_SEARCH_LENGTH);
  renderSearchLinks();
  showView('result', 'result-title');
  announce('');
}

function showCaptureError(error, fromScreen) {
  lastContent = null;
  $('listen-result').hidden = true;
  $('result-tools').hidden = true;
  $('libras-text').value = '';
  const denied = error.name === 'NotAllowedError';
  const messages = {
    'own-panel': 'A área escolhida inclui o painel da Central. Escolha a aba do vídeo ou da notícia para analisar o conteúdo.',
    'sharing-unavailable': 'Abra este painel no Chrome ou Edge de computador para escolher uma tela, ou cole o texto abaixo.',
    'no-text': 'Amplie o trecho na tela e tente novamente. Você também pode colar a informação.',
    'capture-ended': 'A captura foi interrompida. Volte para escolher a tela novamente.',
  };
  renderVerdict($('result-title'), 'unverified', denied ? 'Tela não compartilhada' : 'Não consegui ler o conteúdo');
  $('result-summary').textContent = denied ? 'Volte para escolher uma tela ou cole a informação.'
    : messages[error.message] || (fromScreen ? 'Tente compartilhar novamente no Chrome ou Edge de computador. Você também pode colar o texto.' : 'Abra a extensão pelo ícone na aba desejada ou cole a informação.');
  $('result-scope').textContent = '';
  $('result-matches').replaceChildren();
  $('retry-paste').hidden = false;
  $('allow-tab').hidden = !extension || !fromScreen;
  showView('result', 'result-title');
  announce('');
}

function reportCapture(message) {
  $('loading-message').textContent = message;
  progress('capture-help-status', true, message);
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
    progress('research-status',true,'Pesquisando a informação reconhecida…');
    content.evidence = await research(content.text,content.story,{signal:activeCapture.signal,onProgress:reportCapture});
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
let visualAssistant;
function localPortugueseVoice() {
  return voiceAvailable && speechSynthesis.getVoices().find(voice => voice.localService && /^pt\b/i.test(voice.lang));
}
let visualSupport;
visualAvailability().then(value => { visualSupport = value; });
$('stop-live').addEventListener('click', async () => {
  if ($('stop-live').getAttribute('aria-disabled') === 'true') return;
  const session = liveSession;
  $('stop-live').setAttribute('aria-disabled', 'true');
  try { await finishLiveAudio?.(); } catch { /* Os trechos já concluídos ficam no histórico. */ }
  if (session !== liveSession) return;
  session?.abort();
  $('stop-live').removeAttribute('aria-disabled');
  showSessionResults();
});
$('restart-analysis').addEventListener('click', () => requestSharing(() => analyzeLive()));
function showSessionResults() {
  $('history-matches').replaceChildren();
  $('history-summary').textContent = sessionHistory.length ? sessionHistory.length + ' trechos analisados. Confira a origem e o horário de cada trecho.' : 'Nenhum trecho foi reconhecido. Tente novamente escolhendo a aba que contém a informação.';
  for (const item of sessionHistory) {
    const section = document.createElement('section');
    const verdict = conclusionFor(item.evidence);
    const heading = element('h2', '');
    renderVerdict(heading, verdict.kind, verdict.label);
    section.append(heading, element('p', item.origin + ' · ' + item.time.toLocaleTimeString('pt-BR')), element('p', item.text));
    showEvidence(section.appendChild(document.createElement('div')), item.evidence);
    if (!item.evidence.exact.length && !item.evidence.related.length && !item.evidence.news.length) section.append(element('p', 'Sem evidência suficiente para concluir sobre este trecho.'));
    const search = element('button', 'Pesquisar este trecho', 'button button-secondary');
    search.type = 'button';
    search.addEventListener('click', () => { $('claim').value = item.text; showView('paste','claim'); $('review-form').requestSubmit(); });
    section.append(search);
    $('history-matches').append(section);
  }
  showView('history', 'history-title');
}

async function analyzeLive() {
  const session = new AbortController();
  const { signal } = session;
  liveSession?.abort();
  liveSession = session;
  finishLiveAudio = undefined;
  sessionHistory = [];
  const remember = (text, evidence, origin, time) => {
    if (!text || sessionHistory.some(item => item.text === text.slice(0,650) && item.origin === origin)) return;
    sessionHistory.push({ text: text.slice(0, 650), evidence, origin, time });
    if (sessionHistory.length > 50) sessionHistory.shift();
  };
  let lastKey, heard = '', heardAt = 0, track, audioTrack, listening = false, failedAudio = false, badge;
  let pendingResearch, currentText = '', searchedText = '';
  const enrich = (text, origin) => {
    if (pendingResearch || text.length < 15 || text === searchedText || evidenceFor(text).exact.length) return;
    searchedText = text;
    progress('live-progress', true, 'Pesquisando fontes para este trecho…');
    pendingResearch = research(text, undefined, { signal }).then(evidence=>{
      if (signal.aborted) return;
      const item = sessionHistory.find(item=>item.text===text.slice(0,650) && item.origin===origin);
      if (item) item.evidence = evidence;
      if (currentText===text) {
        setLiveConclusion(evidence, false);
        showEvidence($('live-matches'), evidence);
        $('live-summary').textContent = conclusionFor(evidence).explanation;
        if (lastContent) lastContent.evidence = evidence;
      }
    }).catch(()=>{if (!signal.aborted && currentText === text) progress('live-progress',false,'Pesquisa interrompida. O trecho ainda não foi verificado.');}).finally(()=>{pendingResearch=undefined;});
  };
  const state = () => listening && audioTrack?.readyState === 'live' && !audioTrack.muted ? 'Lendo tela e escutando áudio' : failedAudio ? 'Lendo tela · áudio indisponível' : 'Lendo tela';
  const indicate = () => { if (!signal.aborted && track) { $('live-state').textContent = state(); badge?.(track, 'Central · ' + state()); } };
  prepareIndicator(signal).then(result => { badge = result; indicate(); });
  const startVisual = async () => {
    if ((visualSupport || await visualAvailability()) === 'unavailable' || signal.aborted) return;
    try { const model = await createVisualAssistant(signal); if (signal.aborted) model.destroy(); else visualAssistant = model; }
    catch { /* O reconhecimento local de texto e das artes continua disponível. */ }
  };
  void startVisual();
  void refreshContext();

  let started = false;
  $('analyze-page').disabled = true;
  $('loading-message').hidden = false;
  reportCapture('Escolha uma aba, janela ou tela para acompanhar.');
  signal.addEventListener('abort', () => {
    visualAssistant?.destroy();
    visualAssistant = undefined;
    $('analyze-page').disabled = false;
    $('loading-message').hidden = true;
    if (voiceAvailable) speechSynthesis.cancel();
    $('live-state').textContent = 'Compartilhamento encerrado.';
    $('live-preview').removeAttribute('src');
    $('live-preview').hidden = true;
    $('stop-live').textContent = 'Voltar ao início';
    if (started && lastKey === undefined) $('live-summary').textContent = 'Nenhum quadro analisado.';
  }, { once: true });
  try {
    await followScreen(session, {
      onProgress(message) { if (!signal.aborted) progress('live-progress',true,message); },
      onPreview(canvas,time) {
        if(signal.aborted) return;
        $('live-preview').src=canvas.toDataURL('image/jpeg',.6);
        $('live-preview').hidden=false;
        $('live-time').textContent='Quadro recebido às '+time.toLocaleTimeString('pt-BR')+'.';
      },
      onStart(stream) {
        started = true;
        $('stop-live').removeAttribute('aria-disabled');
        $('stop-live').textContent = 'Encerrar acompanhamento';
        lastContent = null;
        $('loading-message').hidden = true;
        track = stream.getVideoTracks()[0];
        track.addEventListener('capturehandlechange', () => {
          heard = '';
          heardAt = 0;
          lastKey = undefined;
          $('live-heard').textContent = '';
          $('live-matches').replaceChildren();
          $('vision-result').textContent = '';
          $('live-summary').textContent = 'Lendo a nova superfície escolhida…';
        }, { signal });
        audioTrack = stream.getAudioTracks()[0];
        indicate();
        if (audioTrack) {
          for (const event of ['mute','unmute','ended']) audioTrack.addEventListener(event, indicate, { signal });
          transcribe(new MediaStream([audioTrack]), signal, (text, final) => {
            if (signal.aborted) return;
            $('live-heard').textContent = 'Áudio · ' + text;
            if (final) { heard = text; heardAt = Date.now(); remember(text, evidenceFor(text), 'Áudio da superfície escolhida', new Date()); enrich(text,'Áudio da superfície escolhida'); }
          }).then(finish => { finishLiveAudio = finish; listening = true; indicate(); }).catch(() => { failedAudio = true; indicate(); });
        }
        $('live-matches').replaceChildren();
        $('visual-source').hidden = true;
        $('live-summary').textContent = 'Lendo o primeiro quadro…';
        renderVerdict($('live-verdict'), 'pending', 'Aguardando leitura');
        progress('live-progress',true,'Reconhecendo o conteúdo da área compartilhada…');
        for (const id of ['live-text', 'live-time', 'vision-result', 'live-heard']) $(id).textContent = '';
        showView('live', 'live-title');
      },
      async onFrame(content, canvas, time) {
        indicate();
        const spoken = Date.now() - heardAt < 9000 ? heard : '';
        const combined = [content.text, spoken].filter(Boolean).join('\n');
        currentText = spoken.length >= 15 ? spoken : content.text;
        lastContent = combined ? { ...content, text: combined } : null;
        const referenceId = findVisualReference(canvas);
        const reference = referenceId && FACT_CHECKS.find(item => item.id === referenceId);
        $('visual-source').hidden = !reference;
        if (reference) {
          $('visual-source-link').href = reference.url;
          $('visual-source-link').textContent = 'Ver a arte original sobre ' + reference.topic + ' (nova aba)';
        }
        const evidence = evidenceFor(content.text);
        const audioEvidence = spoken ? evidenceFor(spoken) : { exact: [], related: [], news: [] };
        for (const key of ['exact','related','news']) evidence[key] = [...new Map([...evidence[key], ...audioEvidence[key]].map(item => [item.id || item.url, item])).values()];
        remember(content.text, evidenceFor(content.text), 'Texto na superfície escolhida', time);
        if (reference) remember('Imagem parecida com a arte da checagem sobre ' + reference.topic, { exact: [], related: [reference], news: [] }, 'Imagem', time);
        const summary = conclusionFor(evidence).label + '. ' + conclusionFor(evidence).explanation;
        const key = JSON.stringify([currentText, summary, evidence.exact.map(item => item.id), evidence.related.map(item => item.id), evidence.news.map(item => item.url)]);
        if (lastKey !== key) {
          setLiveConclusion(evidence, !evidence.exact.length && currentText.length >= 15);
          showEvidence($('live-matches'), evidence);
          $('live-summary').textContent = conclusionFor(evidence).explanation;
          if (evidence.exact.length) $('live-summary').append(element('span', ' ' + summary, 'sr-only'));
          const voice = $('speak-changes').checked && localPortugueseVoice();
          if (voice) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(conclusionFor(evidence).label + '. ' + (evidence.exact.length
              ? evidence.exact.map(item => item.claim + ' ' + item.finding + '. ' + item.explanation + ' Fonte: ' + item.source).join(' ') : summary));
            utterance.voice = voice;
            utterance.lang = voice.lang;
            speechSynthesis.speak(utterance);
          }
          lastKey = key;
        }
        $('live-text').textContent = content.text.slice(0, 650) || 'Sem texto visível neste quadro.';
        $('live-preview').src = canvas.toDataURL('image/jpeg', .6);
        $('live-preview').hidden = false;
        enrich(currentText, spoken.length >= 15 ? 'Áudio da superfície escolhida' : 'Texto na superfície escolhida');
        $('live-time').textContent = 'Quadro analisado às ' + time.toLocaleTimeString('pt-BR') + '.';
        if (visualAssistant) {
          try {
            const description = await describeFrame(visualAssistant, canvas, signal);
            if (!signal.aborted) {
              $('vision-result').textContent = description;
              if (!description.startsWith('Nenhum')) remember(description, { exact: [], related: [], news: [] }, 'Reconhecimento visual de objetos', time);
            }
          } catch {
            if (!signal.aborted) $('vision-result').textContent = 'Descrição visual indisponível neste quadro.';
          }
        }
      },
    });
  } catch (error) {
    if (!signal.aborted) {
      session.abort();
      if (error.message === 'own-panel') showCaptureError(error, true);
      else if (started) $('live-state').textContent = 'A leitura foi interrompida. Volte para escolher a tela novamente.';
      else showCaptureError(error, true);
    }
  } finally {
    if (liveSession === session) {
      session.abort();
      liveSession = undefined;
      finishLiveAudio = undefined;
      if (started && !$('live-view').hidden) showSessionResults();
    }
  }
}
$('analyze-page').addEventListener('click', () => { checkScope = 'general'; requestSharing(() => $('live-mode').checked ? analyzeLive() : analyze(true)); });
$('allow-tab').addEventListener('click', () => analyze(false));
$('edit-read-text').addEventListener('click', () => {
  $('claim').value = lastContent.text;
  clearError();
  showView('paste', 'claim');
});

$('review-form').addEventListener('submit', async (event) => {
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
  activeResearch?.abort();
  const controller = new AbortController();
  activeResearch = controller;
  const current = ++captureRevision;
  const submit = $('review-form').querySelector('[type=submit]');
  submit.setAttribute('aria-disabled', 'true');
  progress('research-status',true,'Pesquisando nas fontes disponíveis…');
  await new Promise(resolve => requestAnimationFrame(resolve));
  let evidence;
  try {
    evidence = await research(validation.text, undefined, { signal:controller.signal, onProgress: message => { if (current === captureRevision) $('research-status').textContent = message; } });
  } catch {
    if (current === captureRevision) progress('research-status',false,'A pesquisa foi interrompida. Tente novamente.');
    submit.removeAttribute('aria-disabled');
    return;
  }
  submit.removeAttribute('aria-disabled');
  if (current !== captureRevision || $('claim').value.trim() !== validation.text) return;
  progress('research-status',false,'Consulta às fontes concluída.');
  if (/^https?:\/\/\S+$/i.test(validation.text)) {
    const url = articleUrl(validation.text);
    if (!url) { $('claim-error').hidden = false; $('claim-error').textContent = 'Para este site, cole o trecho da notícia. Links do UOL Notícias, Terra, g1, Agência Brasil, TSE, Justiça Eleitoral e Aos Fatos podem ser lidos diretamente.'; return; }
    const revision = ++captureRevision;
    try {
      const story = await readArticle(url);
      const text = [story.title, story.lead].filter(Boolean).join('\n');
      const evidence = await research(text,story,{signal:controller.signal});
      if (revision === captureRevision && $('claim').value.trim() === validation.text) renderResult({ text, evidence, url: story.url, title: story.title, story });
    } catch (err) { if (revision === captureRevision) { $('claim-error').hidden = false; $('claim-error').textContent = err.message; } }
    return;
  }
  renderResult({ text: validation.text, evidence });
});
$('use-example').addEventListener('click', () => {
  $('claim').value = checkScope === 'elections' ? 'Dá para votar pelo celular se estiver chovendo?' : 'Vídeo mostra resgate de onça no rio Negro, em Manaus, em 2025';
  $('claim').dispatchEvent(new Event('input'));
  $('claim').focus();
});

function applyPreferences(preferences) {
  const safe = applyReadingPreferences(preferences);
  $('text-spacing').value = safe.textSpacing;
  $('speak-changes').checked = !!safe.speakChanges;
  $('color-profile').value = safe.colorProfile || 'normal';
  $('font-size').value = safe.fontSize;
  $('standard-colors').checked = !safe.highContrast;
  $('speak-focus').checked = safe.speakFocus !== false;
  $('enable-libras').checked = !!safe.libras;
  $('reduce-motion').checked = !!safe.reduceMotion;
  void setLibras(!!safe.libras);
}
async function readPreferences() {
  const revision = preferenceRevision;
  try {
    const stored = await loadReadingPreferences();
    if (revision === preferenceRevision) applyPreferences(stored || {});
  } catch { if (revision === preferenceRevision) applyPreferences({}); }
}
async function savePreferences() {
  preferenceRevision += 1;
  const preferences = safePreferences({ fontSize: $('font-size').value, highContrast: !$('standard-colors').checked, textSpacing: $('text-spacing').value, speakChanges: $('speak-changes').checked, colorProfile: $('color-profile').value, speakFocus: $('speak-focus').checked, libras: $('enable-libras').checked, reduceMotion: $('reduce-motion').checked });
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
$('text-spacing').addEventListener('change', savePreferences);
$('color-profile').addEventListener('change', savePreferences);
$('speak-changes').addEventListener('change', savePreferences);
$('speak-focus').addEventListener('change', savePreferences);
$('enable-libras').addEventListener('change', savePreferences);
$('reduce-motion').addEventListener('change', savePreferences);
readPreferences();

if (!voiceAvailable) {
  $('speak').disabled = true;
  $('speech-rate').disabled = true;
  $('speech-help').textContent = 'A voz não está disponível neste navegador. Você pode usar seu leitor de tela.';
}

function readingText(content) {
  const { exact: checks, related, news, orientation } = content.evidence || evidenceFor(content.text, content.story);
  const explanation = orientation ? orientation.explanation : checks.length
    ? checks.map((item) => `Afirmação na base: ${item.claim} ${item.finding}. ${item.explanation} Fonte: ${item.source}.`).join(' ')
    : related.length || news.length || content.story ? 'Contexto encontrado. ' + [...related.map(item => item.explanation + ' Fonte: ' + item.source), ...(content.story ? [content.story] : news).map(item => item.title + '. Fonte: ' + item.source)].join(' ') : 'Sem conclusão. Não encontrei esta afirmação na base.';
  const verdict = conclusionFor(content.evidence || evidenceFor(content.text,content.story));
  if (audioFromResult) return `${verdict.label}. ${explanation}`;
  return `${verdict.label}. ${explanation}\n\nTexto analisado: ${content.text}`;
}
function audioStatus(message) {
  $('speech-help').textContent = message;
  announce(message);
}

$('speak').addEventListener('click', async () => {
  const revision = ++captureRevision;
  $('speak').disabled = true;
  if (!lastContent) {
    $('reading-controls').hidden = true;
    return;
  }
  resetSpeech();
  const spokenText = readingText(lastContent);
  $('speak').textContent = 'Ouvir última informação';
  $('audio-description').textContent = '';
  const utterance = new SpeechSynthesisUtterance(spokenText);
  highlightSpeech(utterance, spokenText, $('spoken-preview'));
  utterance.rate = Number($('speech-rate').value);
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
    audioStatus(message);
  }
  utterance.onend = () => finish('Leitura concluída.');
  utterance.onerror = () => finish('Não foi possível concluir a leitura. Confira as vozes do navegador.');
  $('speak').disabled = true;
  $('pause-speech').disabled = false;
  $('stop-speech').disabled = false;
  $('speech-rate').disabled = true;
  window.speechSynthesis.speak(utterance);
  $('pause-speech').focus();
  audioStatus('Leitura iniciada. Use Pausar ou Parar para controlar.');
});
$('pause-speech').addEventListener('click', () => {
  if (!speech) return;
  if (speechPaused) window.speechSynthesis.resume(); else window.speechSynthesis.pause();
  speechPaused = !speechPaused;
  $('pause-speech').textContent = speechPaused ? 'Continuar' : 'Pausar';
  audioStatus(speechPaused ? 'Leitura pausada.' : 'Leitura retomada.');
});
$('stop-speech').addEventListener('click', () => {
  resetSpeech();
  $('speak').focus();
  audioStatus('Leitura interrompida.');
});
window.addEventListener('pagehide', () => { stopMediaInputs(); liveSession?.abort(); activeCapture?.abort(); resetSpeech(); });

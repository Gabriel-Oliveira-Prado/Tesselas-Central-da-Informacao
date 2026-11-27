export function enableAccessibleNavigation() {
  let keyboard = false, utterance, timer;
  const prepareText = root => {
    for (const el of root.querySelectorAll('h1,h2,h3,p,blockquote')) {
      if (el.id === 'home-instructions' || el.closest('[hidden],.sr-only,header,footer,[vw],#vlibras-app-root')) continue;
      if (!el.textContent.trim() || el.querySelector('button,input,textarea,select,a, p, h2')) continue;
      if (el.tabIndex < 0) el.tabIndex = 0;
    }
  };
  prepareText(document);
  const observer = new MutationObserver(() => prepareText(document));
  observer.observe(document.querySelector('main'), { childList: true, subtree: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') keyboard = true;
    if (event.defaultPrevented || event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.target.matches('input:not([type=checkbox]),textarea,select') || event.target.isContentEditable) return;
    // Botões já aceitam ambas as teclas. Complete apenas a tecla ausente.
    if ((event.key === ' ' && event.target.matches('a[href]')) ||
        (event.key === 'Enter' && event.target.matches('input[type=checkbox]:enabled'))) {
      event.preventDefault();
      if (!event.repeat) event.target.click();
      return;
    }
    const buttons = [...document.querySelectorAll('.action-card')];
    const button = buttons[Number(event.key) - 1];
    if (/^[1-5]$/.test(event.key) && button && !document.getElementById('home-view')?.hidden) {
      const help = button.closest('.card-shell').querySelector('.card-info');
      if (help.getAttribute('aria-expanded') === 'true') help.click();
      event.preventDefault();
      keyboard = true;
      if (document.activeElement === button) speakFocus(button);
      else button.focus();
    }
  });
  document.addEventListener('pointerdown', () => { keyboard = false; clearTimeout(timer); });
  function speakFocus(el) {
    if (!keyboard || document.body.dataset.speakFocus === 'false' || !globalThis.speechSynthesis) return;
    clearTimeout(timer);
    if (utterance) speechSynthesis.cancel();
    if (el.closest('[hidden]') || el.matches('body,main,section,html')) return;
    const label = el.getAttribute('aria-label') || el.labels?.[0]?.textContent ||
      el.querySelector('img[alt]')?.alt || el.querySelector('.card-label')?.textContent || el.textContent;
    const description = (el.getAttribute('aria-describedby') || '').split(/\s+/)
      .map(id => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(' ');
    const text = [label?.trim(), el.selectedOptions?.[0]?.textContent, description].filter(Boolean).join(' ');
    if (!text?.trim()) return;
    timer = setTimeout(() => {
      if (document.activeElement !== el) return;
      utterance = new SpeechSynthesisUtterance(text.trim().slice(0, 1200));
      utterance.lang = 'pt-BR';
      utterance.voice = speechSynthesis.getVoices().find(v => v.localService && /^pt/i.test(v.lang)) || null;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }, 120);
  }
  document.addEventListener('focusin', event => speakFocus(event.target));
  const skip = document.querySelector('.skip-link');
  skip?.addEventListener('click', event => {
    const view = document.querySelector('.view:not([hidden])');
    const first = view?.querySelector('.action-card');
    const target = first || [...(view?.querySelectorAll('textarea,select,input,button:not([data-back]),a[href]') || [])]
      .find(el => !el.disabled && el.getClientRects().length) ||
      document.querySelector('main h1');
    if (!target) return;
    event.preventDefault();
    if (first && !first.getClientRects().length) first.parentElement.querySelector('.card-info')?.click();
    target.focus();
  });
  for (const button of document.querySelectorAll('.card-info')) {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      const description = document.getElementById(button.getAttribute('aria-controls'));
      description.hidden = !open;
      if (open) { description.tabIndex = 0; description.focus(); }
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = document.activeElement.closest('.card-shell')?.querySelector('.card-info[aria-expanded=true]');
    if (open) { open.click(); open.focus(); }
  });
  return function anunciarAutomaticamente(mensagem) {
    if (document.body.dataset.speakFocus === 'false' || !globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) return;
    clearTimeout(timer);
    utterance = new SpeechSynthesisUtterance(mensagem);
    utterance.lang = 'pt-BR';
    utterance.voice = speechSynthesis.getVoices().find(v => v.localService && /^pt/i.test(v.lang)) || null;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };
}

export function highlightSpeech(utterance, text, container) {
  const parts = text.split(/(\s+)/);
  let offset = 0;
  const words = parts.map(part => {
    const start = offset;
    offset += part.length;
    const el = document.createElement('span');
    el.textContent = part;
    return { el, start, end: offset };
  });
  container.replaceChildren(...words.map(word => word.el));
  let active;
  utterance.onboundary = event => {
    if (event.name !== 'word') return;
    active?.removeAttribute('data-spoken-word');
    const word = words.find(word => event.charIndex >= word.start && event.charIndex < word.end);
    if (!word) return;
    active = word.el;
    active.setAttribute('data-spoken-word', '');
    active.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };
}

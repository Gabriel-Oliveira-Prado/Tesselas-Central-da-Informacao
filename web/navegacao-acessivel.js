export function enableAccessibleNavigation() {
  let keyboard = false, utterance, timer;
  const prepareText = root => {
    for (const el of root.querySelectorAll('h1,h2,h3,p,blockquote')) {
      if (el.closest('[hidden],.sr-only,header,footer,[vw],#vlibras-app-root')) continue;
      if (!el.textContent.trim() || el.querySelector('button,input,textarea,select,a, p, h2')) continue;
      if (el.tabIndex < 0) el.tabIndex = 0;
    }
  };
  prepareText(document);
  const observer = new MutationObserver(() => prepareText(document));
  observer.observe(document.querySelector('main'), { childList: true, subtree: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') keyboard = true;
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    const buttons = [...document.querySelectorAll('.action-card')];
    const button = buttons[Number(event.key) - 1];
    if (/^[1-5]$/.test(event.key) && button && !document.getElementById('home-view')?.hidden) {
      const help = button.closest('.card-shell').querySelector('.card-info');
      if (help.getAttribute('aria-expanded') === 'true') help.click();
      event.preventDefault();
      button.click();
    }
  });
  document.addEventListener('pointerdown', () => { keyboard = false; clearTimeout(timer); });
  document.addEventListener('focusin', event => {
    if (!keyboard || document.body.dataset.speakFocus === 'false' || !globalThis.speechSynthesis) return;
    clearTimeout(timer);
    if (utterance) speechSynthesis.cancel();
    const el = event.target;
    if (el.closest('[hidden]') || el.matches('textarea,input:not([type=checkbox],[type=file])')) return;
    const text = el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent;
    if (!text?.trim()) return;
    timer = setTimeout(() => {
      if (document.activeElement !== el) return;
      utterance = new SpeechSynthesisUtterance(text.trim().slice(0, 1200));
      utterance.lang = 'pt-BR';
      utterance.voice = speechSynthesis.getVoices().find(v => v.localService && /^pt/i.test(v.lang)) || null;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }, 120);
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

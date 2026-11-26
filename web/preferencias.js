import { safePreferences } from '../regras-negocio/validacao.js';

export async function loadReadingPreferences() {
  if (globalThis.chrome?.runtime?.id && chrome.storage?.local) {
    return (await chrome.storage.local.get('readingPreferences')).readingPreferences;
  }
  return JSON.parse(localStorage.getItem('central-reading') || localStorage.getItem('clareia-reading') || '{}');
}

export function applyReadingPreferences(value) {
  const safe = safePreferences(value || {});
  document.documentElement.style.fontSize = `${safe.fontSize}%`;
  document.body.dataset.contrast = safe.highContrast ? 'high' : 'default';
  document.body.dataset.colorProfile = safe.colorProfile || 'normal';
  document.body.dataset.speakFocus = String(safe.speakFocus !== false);
  document.body.dataset.largeText = String(Number(safe.fontSize) >= 150);
  document.body.toggleAttribute('data-wide-spacing', safe.wideSpacing);
  document.body.toggleAttribute('data-reduce-motion', safe.reduceMotion === true);
  return safe;
}

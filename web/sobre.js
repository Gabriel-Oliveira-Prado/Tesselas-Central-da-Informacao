import { loadReadingPreferences, applyReadingPreferences } from './preferencias.js';
import { setLibras } from './libras.js';
import { enableAccessibleNavigation } from './navegacao-acessivel.js';

enableAccessibleNavigation();

async function refresh() {
  try {
    const preferences = await loadReadingPreferences();
    applyReadingPreferences(preferences);
    void setLibras(!!preferences?.libras);
  } catch {
    applyReadingPreferences({});
  }
}
window.addEventListener('pageshow', refresh);
window.addEventListener('storage', refresh);
globalThis.chrome?.storage?.onChanged?.addListener(refresh);

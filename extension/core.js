export const MAX_TEXT_LENGTH = 8000;
export const MAX_SEARCH_LENGTH = 300;

export function validateClaim(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { valid: false, message: 'Cole uma informação antes de verificar.' };
  if (text.length > MAX_TEXT_LENGTH) return { valid: false, message: 'Use até 8.000 caracteres. Escolha um trecho menor para conferir.' };
  return { valid: true, text };
}

export function createSearchLinks(value) {
  const query = typeof value === 'string' ? value.trim() : '';
  if (!query || query.length > MAX_SEARCH_LENGTH) return [];
  return [
    { label: 'Buscar no Fato ou Boato', filter: 'site:justicaeleitoral.jus.br/fato-ou-boato' },
    { label: 'Buscar no Aos Fatos', filter: 'site:aosfatos.org' },
    { label: 'Buscar em outras fontes', filter: '' },
  ].map(({ label, filter }) => {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', [filter, query].filter(Boolean).join(' '));
    return { label, href: url.href };
  });
}

export function safePreferences(value = {}) {
  const sizes = ['100', '125', '150', '200'];
  return {
    fontSize: sizes.includes(String(value.fontSize)) ? String(value.fontSize) : '100',
    highContrast: value.highContrast !== false,
  };
}

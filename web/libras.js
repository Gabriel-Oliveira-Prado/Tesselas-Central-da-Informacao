let loading, enabled = false;

export async function setLibras(active) {
  enabled = active;
  const status = document.getElementById('libras-global-status');
  let root = document.getElementById('vlibras-app-root');
  const pronto = 'VLibras disponível em todas as telas. Abra o tradutor e selecione o texto.';
  if (!active) {
    if (root) { root.hidden = true; root.dataset.active = 'false'; }
    if (status) status.textContent = '';
    return;
  }
  if (root) {
    root.hidden = false;
    root.dataset.active = 'true';
    if (status) status.textContent = pronto;
    return;
  }
  if (loading) return loading;
  if (status) status.textContent = 'Carregando o tradutor em Libras…';
  window.VLibrasWidget = { path: 'https://vlibras.gov.br/app' };
  loading = import('./vendor/libras/vlibras-plugin-app.js').then(() => {
    root = document.getElementById('vlibras-app-root');
    if (root) {
      root.hidden = !enabled;
      root.dataset.active = String(enabled);
    }
    if (status && enabled) status.textContent = pronto;
  }).catch(() => {
    if (status && enabled) status.textContent = 'O tradutor não abriu. Confira a conexão e ative Libras novamente.';
  }).finally(() => { loading = undefined; });
  return loading;
}

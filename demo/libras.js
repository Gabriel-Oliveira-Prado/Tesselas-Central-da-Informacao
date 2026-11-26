const enable = document.getElementById('load-widget');
const status = document.getElementById('libras-progress');

enable.addEventListener('click', () => {
  if (enable.getAttribute('aria-disabled') === 'true') return;
  enable.setAttribute('aria-disabled', 'true');
  status.textContent = 'Carregando o VLibras…';
  const script = document.createElement('script');
  script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
  script.referrerPolicy = 'no-referrer';
  script.onload = () => { status.textContent = 'Use o botão do VLibras para abrir o avatar.'; };
  script.onerror = () => {
    script.remove();
    enable.removeAttribute('aria-disabled');
    status.textContent = 'Não foi possível carregar o tradutor. Tente novamente ou abra o site oficial.';
  };
  document.head.append(script);
});

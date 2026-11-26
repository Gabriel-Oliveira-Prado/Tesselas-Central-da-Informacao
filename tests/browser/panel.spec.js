import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const panelPath = '/extension/panel.html';
const knownClaim = 'A urna eletrônica é conectada à internet durante a votação.';
async function pasteAndVerify(page, text) {
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await page.getByLabel('O que você quer conferir?').fill(text);
  await page.getByRole('button', { name: 'Verificar informação', exact: true }).click();
}
async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Somente nos testes. A imagem entra pelo mesmo fluxo de vídeo e OCR do painel.
async function shareTestImage(page) {
  await page.addInitScript((claim) => {
    navigator.mediaDevices.getDisplayMedia = async (options) => {
      window.captureOptions = options;
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      const draw = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '32px Arial';
        ctx.fillText(claim, 30, 100);
      };
      draw();
      window.testStream = canvas.captureStream(15);
      const timer = setInterval(() => {
        if (window.testStream.active) draw(); else clearInterval(timer);
      }, 60);
      return window.testStream;
    };
  }, knownClaim);
}

test('início tem somente quatro cards; teclado e retorno preservam o foco', async ({ page }) => {
  await shareTestImage(page);
  await page.goto(panelPath);
  await expect(page.locator('.action-grid button')).toHaveCount(4);
  await expect(page.locator('.action-grid button')).toHaveText(['Analisar tela', 'Colar informação', 'Ouvir conteúdo', 'Acessibilidade']);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Analisar tela', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Checagem encontrada', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analisar tela', exact: true })).toBeFocused();
  await page.screenshot({ path: 'test-results/central-inicio.png', fullPage: true });
});

test('analisar tela lê imagem por OCR local e encerra o compartilhamento', async ({ page }) => {
  await shareTestImage(page);
  const outsideRequests = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1')) outsideRequests.push(request.url()); });
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.testStream?.active)).toBe(false);
  expect(await page.evaluate(() => window.captureOptions.audio)).toBe(false);
  await expect(page.getByText('Falso, segundo a fonte', { exact: true })).toBeVisible();
  await expect(page.locator('#result-scope')).toContainText('não à página inteira');
  await expect(page.getByRole('link', { name: 'Consultar fonte (nova aba)', exact: true })).toHaveAttribute('href', /justicaeleitoral.jus.br\/fato-ou-boato\/checagens/);
  await expect(page.getByText(/consultada em 25\/11\/2026/)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByText('Ver texto lido', { exact: true }).click();
  await expect(page.locator('#reviewed-claim')).toHaveText(knownClaim);
  expect(outsideRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/central-analise.png', fullPage: true });
});

test('colar texto informa erros e mantém resultado inconclusivo para conteúdo desconhecido', async ({ page }) => {
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar informação', exact: true }).click();
  await expect(page.getByLabel('O que você quer conferir?')).toBeFocused();
  await expect(page.getByLabel('O que você quer conferir?')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#claim-error')).toBeVisible();
  await page.getByLabel('O que você quer conferir?').fill(knownClaim);
  await page.getByRole('button', { name: 'Verificar informação', exact: true }).click();
  await expect(page.locator('.finding')).toHaveText('Falso, segundo a fonte');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await pasteAndVerify(page, 'A escola do meu bairro mudou de endereço.');
  await expect(page.getByRole('heading', { name: 'Sem conclusão', exact: true })).toBeFocused();
  await expect(page.locator('.evidence')).toHaveCount(0);
  await expect(page.locator('#result-summary')).toContainText('não confirma nem desmente');
});

test('HTML permanece texto, consulta é editável e conteúdo não é persistido', async ({ page }) => {
  await page.goto(panelPath);
  const malicious = '<img src=x onerror="window.injetado=true"> & uma alegação';
  await pasteAndVerify(page, malicious);
  await page.getByText('Ver texto lido', { exact: true }).click();
  await expect(page.locator('#reviewed-claim')).toHaveText(malicious);
  expect(await page.evaluate(() => window.injetado)).toBeUndefined();
  await page.getByText('Buscar outras fontes', { exact: true }).click();
  await page.getByLabel('Trecho para buscar').fill('Consulta sem dados pessoais');
  const link = page.getByRole('link', { name: 'Buscar no Fato ou Boato (nova aba)', exact: true });
  expect(new URL(await link.getAttribute('href')).searchParams.get('q')).toBe('site:justicaeleitoral.jus.br/fato-ou-boato Consulta sem dados pessoais');
  await page.getByLabel('Trecho para buscar').fill('');
  await expect(page.locator('#search-links a')).toHaveCount(0);
  await expect(page.locator('#search-query-error')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await expect(page.getByLabel('O que você quer conferir?')).toHaveValue('');
});

test('texto a 200% e alto contraste funcionam em 320 pixels em todas as opções', async ({ page }) => {
  await shareTestImage(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
  await page.getByLabel('Tamanho do texto').selectOption('200');
  await page.getByLabel('Usar cores suaves').uncheck();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checagem encontrada', exact: true })).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: 'test-results/central-320-texto-200.png', fullPage: true });
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Ouvir conteúdo', exact: true }).click();
  await expectNoOverflow(page);
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('font-size', '32px');
  await expect(page.locator('body')).toHaveAttribute('data-contrast', 'high');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['central-reading']);
});

test('voz tem acionamento explícito, lê a explicação e permite pausa e parada', async ({ page }) => {
  await shareTestImage(page);
  await page.addInitScript(() => {
    window.voiceActions = [];
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [],
      speak: (utterance) => { window.spokenText = utterance.text; window.voiceActions.push('speak'); },
      cancel: () => window.voiceActions.push('cancel'),
      pause: () => window.voiceActions.push('pause'),
      resume: () => window.voiceActions.push('resume'),
    } });
  });
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Ouvir conteúdo', exact: true }).click();
  expect(await page.evaluate(() => window.voiceActions.includes('speak'))).toBe(false);
  await page.getByRole('button', { name: 'Compartilhar tela e ouvir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.spokenText)).toContain('Falso, segundo a fonte');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Parar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ouvir', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.voiceActions.filter((action) => action !== 'cancel'))).toEqual(['speak', 'pause', 'resume']);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ouvir conteúdo', exact: true })).toBeFocused();
});

test('mudar de opção durante a captura não troca a tela nem rouba o foco depois', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () => new Promise((resolve, reject) => {
      window.cancelShare = () => reject(new DOMException('Cancelado', 'NotAllowedError'));
    });
  });
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await expect(page.locator('#loading-message')).toBeVisible();
  await page.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
  await page.evaluate(() => window.cancelShare());
  await expect(page.locator('#loading-message')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Acessibilidade', exact: true })).toBeFocused();
});

test('captura exclui formulários e texto oculto; seleção privada continua recusada', async ({ page }) => {
  await page.goto('/demo/noticia.html');
  const imported = await page.evaluate(async () => {
    const { readPageContent } = await import('/extension/page-reader.js');
    return readPageContent({ mode: 'page' });
  });
  expect(imported.text).toContain(knownClaim);
  expect(imported.text).not.toMatch(/DADO PRIVADO|Campo de teste|CONTEÚDO OCULTO/);
  const privateResult = await page.evaluate(async () => {
    const { readPageContent } = await import('/extension/page-reader.js');
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('form label'));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return readPageContent({ mode: 'selection' });
  });
  expect(privateResult.error).toBe('private-selection');
});

test('quatro opções, resultado e página explicativa passam no axe-core', async ({ page }) => {
  await shareTestImage(page);
  async function scan() {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.goto(panelPath);
  await scan();
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar informação', exact: true }).click();
  await scan();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checagem encontrada', exact: true })).toBeVisible();
  await scan();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
  await page.getByLabel('Usar cores suaves').uncheck();
  await scan();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Ouvir conteúdo', exact: true }).click();
  await scan();
  await page.goto('/extension/sobre.html');
  await scan();
});

test('extensão permite autorizar a leitura do texto da aba após cancelar a captura e apresenta uma checagem com fonte', async () => {
  const extensionPath = resolve('extension');
  const userDataDir = await mkdtemp(join(tmpdir(), 'central-test-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true, channel: 'chromium', viewport: { width: 1280, height: 900 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--enable-unsafe-extension-debugging', '--enable-usermedia-screen-capturing', '--auto-select-tab-capture-source-by-title=Teste de captura autorizada'],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    await expect.poll(() => worker.evaluate(() => chrome.action.onClicked.hasListeners())).toBe(true);
    const demoPage = await context.newPage();
    await demoPage.goto('http://127.0.0.1:4173/demo/noticia.html');
    await demoPage.evaluate(() => { document.title = 'Teste de captura autorizada'; });
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/panel.html`);
    // O seletor nativo aceita apenas a aba de teste no perfil isolado.
    await extensionPage.bringToFront();
    await extensionPage.locator('#analyze-page').click();
    await expect(extensionPage.locator('.finding')).toHaveText('Falso, segundo a fonte', { timeout: 20000 });
    await expect(extensionPage.locator('#reviewed-claim')).toContainText(knownClaim);
    await extensionPage.getByRole('button', { name: 'Voltar', exact: true }).click();
    await extensionPage.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('Cancelado', 'NotAllowedError'); };
    });
    await extensionPage.getByRole('button', { name: 'Analisar tela', exact: true }).click();
    await expect(extensionPage.getByRole('heading', { name: 'Tela não compartilhada', exact: true })).toBeFocused();
    await demoPage.bringToFront();
    const browserCdp = await context.browser().newBrowserCDPSession();
    const { targetInfos } = await browserCdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
    const demoTarget = targetInfos.find((target) => target.url.endsWith('/demo/noticia.html'));
    await browserCdp.send('Extensions.triggerAction', { id: extensionId, targetId: demoTarget.targetId });
    await expect.poll(async () => {
      const { targetInfos: targets } = await browserCdp.send('Target.getTargets');
      return targets.filter((target) => target.url === `chrome-extension://${extensionId}/panel.html`).length;
    }).toBe(2);
    // O painel nativo é um target CDP. Os mesmos handlers são exercitados em
    // uma aba de teste, sem mudar o foco da aba autorizada. As APIs são reais.
    await extensionPage.evaluate(() => document.getElementById('allow-tab').click());
    await expect(extensionPage.getByRole('heading', { name: 'Checagem encontrada', exact: true })).toBeFocused();
    await expect(extensionPage.locator('#reviewed-claim')).toContainText(knownClaim);
    await expect(extensionPage.locator('#reviewed-claim')).not.toContainText('DADO PRIVADO');
    await expect(extensionPage.locator('.finding')).toHaveText('Falso, segundo a fonte');
    await extensionPage.getByRole('button', { name: 'Voltar', exact: true }).click();
    await extensionPage.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
    await extensionPage.getByLabel('Tamanho do texto').selectOption('125');
    await expect(extensionPage.getByRole('status')).toHaveText('Ajustes de leitura salvos neste dispositivo.');
    expect(await worker.evaluate(() => chrome.storage.local.get(null))).toEqual({ readingPreferences: { fontSize: '125', highContrast: true } });
  } finally {
    await context?.close();
    if (resolve(userDataDir).startsWith(resolve(tmpdir()) + sep)) await rm(userDataDir, { recursive: true, force: true });
  }
});

test('cancelar o seletor permite voltar com foco e não carrega OCR', async ({ page }) => {
  const ocrRequests = [];
  page.on('request', (r) => { if (r.url().includes('/vendor/ocr/')) ocrRequests.push(r.url()); });
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('Cancelado', 'NotAllowedError'); };
  });
  await page.goto(panelPath);
  await expect(page.locator('body')).toHaveAttribute('data-contrast', 'high');
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tela não compartilhada' })).toBeFocused();
  expect(ocrRequests).toEqual([]);
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.locator('#analyze-page')).toBeFocused();
  await page.locator('#open-settings').click();
  await page.getByLabel('Usar cores suaves').check();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-contrast', 'default');
});

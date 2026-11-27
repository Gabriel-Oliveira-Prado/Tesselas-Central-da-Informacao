import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const panelPath = '/web/index.html';
const knownClaim = 'A urna eletrônica é conectada à internet durante a votação.';
async function pasteAndVerify(page, text) {
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await page.getByLabel('O que você quer conferir?').fill(text);
  await page.getByRole('button', { name: 'Pesquisar informação', exact: true }).click();
  await expect(page.locator('#result-view')).toBeVisible();
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
        ctx.fillText(window.testCaption ?? claim, 30, 100);
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

test('início tem cinco cards; teclado e retorno preservam o foco', async ({ page }) => {
  await shareTestImage(page);
  await page.goto(panelPath);
  await expect(page.locator('.action-grid .action-card')).toHaveCount(5);
  await expect(page.locator('.action-grid .card-label')).toHaveText(['Analisar tela', 'Colar informação', 'Ouvir conteúdo', 'Acessibilidade', 'Eleições']);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#analyze-page')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#capture-help-title')).toBeFocused();
  await page.locator('#start-sharing').click();
  await expect(page.getByRole('heading', { name: 'Análise ao vivo', exact: true })).toBeFocused();
  await page.locator('#stop-live').click();
  await expect(page.locator('#history-title')).toBeFocused();
  await page.locator('#history-view [data-back]').click();
  await page.screenshot({ path: 'test-results/central-inicio.png', fullPage: true });
});

test('Eleições ocupa a linha e mantém a seleção quando uma fonte falha', async ({ page }) => {
  await page.route('**/eleicoes/fontes/tse', route => route.fulfill({ status: 503 }));
  await page.route('**/eleicoes/fontes/agencia', route => route.fulfill({ body: `
    <div class="ultima-noticia"><a class="titulo-noticia" href="/politica/noticia/2026-11/exemplo">Cobertura de teste</a><span class="data-publicacao">25/11/2026</span></div>
    <div class="ultima-noticia"><a class="titulo-noticia" href="https://example.org/politica/noticia/2026-11/teste">Outro domínio</a><span class="data-publicacao">26/11/2026</span></div>` }));
  await page.goto(panelPath);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const card = page.getByRole('button', { name: 'Eleições', exact: true });
  expect((await card.boundingBox()).width).toBe((await page.locator('.action-grid').boundingBox()).width);
  await card.press('Enter');
  await expect(page.locator('#elections-title')).toBeFocused();
  await expect(page.locator('#election-status')).toContainText('anterior mantida para Tribunal Superior Eleitoral');
  await expect(page.getByRole('link', { name: 'Cobertura de teste' })).toHaveAttribute('href', 'https://agenciabrasil.ebc.com.br/politica/noticia/2026-11/exemplo');
  await expect(page.getByRole('link', { name: 'Outro domínio' })).toHaveCount(0);
  await page.route('**/eleicoes/fontes/agencia', route => route.abort());
  await page.getByRole('button', { name: 'Atualizar notícias' }).press('Enter');
  await expect(page.locator('#election-status')).toContainText('e Agência Brasil');
  await expect(page.getByRole('link', { name: 'Cobertura de teste' })).toBeVisible();
  await expect(page.getByRole('link', { name: /resultados oficiais/ })).toHaveCount(0);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.locator('#elections-view [data-back]').press('Enter');
  await expect(card).toBeFocused();
  await page.locator('#open-settings').press('Enter');
  await page.locator('#standard-colors').check();
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 248, 243)');
});

test('analisar tela lê imagem por OCR local e encerra o compartilhamento', async ({ page }) => {
  await shareTestImage(page);
  const outsideRequests = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1')) outsideRequests.push(request.url()); });
  await page.goto(panelPath);
  await page.locator('#live-mode').uncheck();
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await page.locator('#start-sharing').click();
  await expect.poll(() => page.evaluate(() => window.testStream?.active)).toBe(false);
  expect(await page.evaluate(() => window.captureOptions.audio)).toBe(false);
  await expect(page.getByText('Falso, segundo a fonte', { exact: true })).toBeVisible();
  await expect(page.locator('#result-scope')).toContainText('não à página inteira');
  await expect(page.getByRole('link', { name: /^Consultar fonte sobre conexão da urna/ })).toHaveAttribute('href', /justicaeleitoral.jus.br\/fato-ou-boato\/checagens/);
  await expect(page.getByText(/consultada em 25\/11\/2026/)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByText('Ver texto lido', { exact: true }).click();
  await expect(page.locator('#reviewed-claim')).toHaveValue(knownClaim);
  expect(outsideRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/central-analise.png', fullPage: true });
});

test('vídeo reproduzido ao vivo muda o veredito e descarta o anterior, sem envio externo', async ({ page }) => {
  test.setTimeout(55000);
  const external = [];
  page.on('request', req => { if (req.url().startsWith('https:')) external.push(req.url()); });
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const video = document.createElement('video');
      video.muted = true;
      video.src = '/demo/acompanhamento.webm';
      window.testPlayer = video;
      await video.play();
      return window.testStream = video.captureStream();
    };
  });
  await page.goto(panelPath);
  await page.locator('#analyze-page').click();
  await page.locator('#start-sharing').click();
  const verdict = page.locator('#live-matches .finding');
  for (const label of ['Falso, segundo a fonte', 'Confirmado pela fonte', 'Fora de contexto']) {
    await expect(verdict).toHaveText(label, { timeout: 11000 });
  }
  await expect(page.locator('#live-summary')).toContainText('evidência suficiente', { timeout: 11000 });
  await expect(verdict).toHaveCount(0);
  await page.locator('#stop-live').press('Enter');
  await expect(page.locator('#live-state')).toHaveText('Compartilhamento encerrado.');
  expect(await page.evaluate(() => window.testStream.active)).toBe(false);
  await expect(page.locator('#history-title')).toBeFocused();
  expect(external).toEqual([]);
});

test('pergunta de exemplo e tema relacionado têm tratamentos distintos', async ({ page }) => {
  await page.goto(panelPath);
  await page.locator('#open-paste').click();
  await page.locator('#use-example').click();
  await page.getByRole('button', { name: 'Pesquisar informação' }).click();
  await expect(page.locator('#result-title')).toHaveText('Verdadeiro');
  await expect(page.locator('#result-matches .verdict-true')).toContainText('resgate de onça');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.locator('#result-view [data-back]').click();
  await pasteAndVerify(page, 'É falso que dá para votar pelo celular se estiver chovendo.');
  await expect(page.locator('#result-title')).toHaveText('Não verificado');
  await expect(page.locator('#result-matches .finding')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Leitura sobre votação pela internet' })).toBeVisible();
});

test('a descrição visual opcional permanece separada da checagem e libera o modelo ao parar', async ({ page }) => {
  await shareTestImage(page);
  await page.addInitScript(() => {
    window.testCaption = 'Uma imagem qualquer.';
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: {
      availability: async () => 'available',
      create: async () => ({
        clone: async () => ({
          prompt: async messages => {
            if (!(messages[0].content[1].value instanceof Blob)) throw Error('Quadro ausente');
            return '"phone"';
          },
          destroy() {},
        }),
        destroy() { window.modelReleased = true; },
      }),
    } });
  });
  await page.goto(panelPath);
  await page.locator('#analyze-page').click();
  await page.locator('#start-sharing').click();
  await expect(page.locator('#live-view button')).toHaveCount(1);
  await expect(page.locator('#vision-result')).toHaveText('Possível aparelho celular.', { timeout: 10000 });
  await expect(page.locator('#live-summary')).toContainText('evidência suficiente');
  await expect(page.locator('#live-matches .finding')).toHaveCount(0);
  await page.locator('#stop-live').click();
  expect(await page.evaluate(() => window.modelReleased && !window.testStream.active)).toBe(true);
});

test('colar texto informa erros e mantém resultado inconclusivo para conteúdo desconhecido', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*', route => route.fulfill({body:'<rss><channel></channel></rss>'}));
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await page.getByRole('button', { name: 'Pesquisar informação', exact: true }).click();
  await expect(page.getByLabel('O que você quer conferir?')).toBeFocused();
  await expect(page.getByLabel('O que você quer conferir?')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#claim-error')).toBeVisible();
  await page.getByLabel('O que você quer conferir?').fill(knownClaim);
  await page.getByRole('button', { name: 'Pesquisar informação', exact: true }).click();
  await expect(page.locator('.finding')).toHaveText('Falso, segundo a fonte');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await pasteAndVerify(page, 'A escola do meu bairro mudou de endereço.');
  await expect(page.getByRole('heading', { name: 'Não verificado', exact: true })).toBeFocused();
  await expect(page.locator('#result-matches .evidence')).toHaveCount(0);
  await expect(page.locator('#result-summary')).toContainText('não há evidência suficiente');
});

test('HTML permanece texto, consulta é editável e conteúdo não é persistido', async ({ page }) => {
  await page.goto(panelPath);
  const malicious = '<img src=x onerror="window.injetado=true"> & uma alegação';
  await pasteAndVerify(page, malicious);
  await page.getByText('Ver texto lido', { exact: true }).click();
  await expect(page.locator('#reviewed-claim')).toHaveValue(malicious);
  expect(await page.evaluate(() => window.injetado)).toBeUndefined();
  await page.locator('#support-view [data-back]').click();
  await page.getByRole('button', { name: 'Buscar outras fontes' }).click();
  await page.getByLabel('Trecho para buscar').fill('Consulta sem dados pessoais');
  const link = page.getByRole('link', { name: 'Buscar no g1 Fato ou Fake (nova aba)', exact: true });
  expect(new URL(await link.getAttribute('href')).searchParams.get('q')).toBe('site:g1.globo.com/fato-ou-fake Consulta sem dados pessoais');
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
  await page.locator('#live-mode').uncheck();
  await page.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
  await page.getByLabel('Tamanho do texto').selectOption('200');
  await page.getByLabel('Usar cores suaves').uncheck();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await page.locator('#start-sharing').click();
  await expect(page.getByRole('heading', { name: 'Falso', exact: true })).toBeVisible();
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
  await page.locator('#audio-view [data-back]').click();
  await pasteAndVerify(page, knownClaim);
  await page.locator('#listen-result').click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.spokenText)).toContain('Falso, segundo a fonte');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Parar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ouvir última informação', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.voiceActions.filter((action) => action !== 'cancel'))).toEqual(['speak', 'pause', 'resume']);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.locator('#listen-result')).toBeFocused();
});

test('mudar de opção durante a captura não troca a tela nem rouba o foco depois', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () => new Promise((resolve, reject) => {
      window.cancelShare = () => reject(new DOMException('Cancelado', 'NotAllowedError'));
    });
  });
  await page.goto(panelPath);
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await page.locator('#start-sharing').click();
  await expect(page.locator('#capture-help-status')).toBeVisible();
  await page.locator('#capture-help-view [data-back]').click();
  await page.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
  await page.evaluate(() => window.cancelShare());
  await expect(page.locator('#loading-message')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Acessibilidade', exact: true })).toBeFocused();
});

test('captura exclui formulários e texto oculto; seleção privada continua recusada', async ({ page }) => {
  await page.goto('/demo/noticia.html');
  const imported = await page.evaluate(async () => {
    const { readPageContent } = await import('/web/leitura-pagina.js');
    return readPageContent({ mode: 'page' });
  });
  expect(imported.text).toContain(knownClaim);
  expect(imported.text).not.toMatch(/DADO PRIVADO|Campo de teste|CONTEÚDO OCULTO/);
  const privateResult = await page.evaluate(async () => {
    const { readPageContent } = await import('/web/leitura-pagina.js');
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('form label'));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return readPageContent({ mode: 'selection' });
  });
  expect(privateResult.error).toBe('private-selection');
});

test('painel, resultado e página explicativa passam no axe-core', async ({ page }) => {
  test.setTimeout(60000);
  await shareTestImage(page);
  async function scan() {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.goto(panelPath);
  await scan();
  await page.locator('#live-mode').uncheck();
  await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
  await page.getByRole('button', { name: 'Pesquisar informação', exact: true }).click();
  await scan();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Analisar tela', exact: true }).click();
  await page.locator('#start-sharing').click();
  await expect(page.getByRole('heading', { name: 'Falso', exact: true })).toBeVisible({timeout:20000});
  await scan();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
  await page.getByLabel('Usar cores suaves').uncheck();
  await scan();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Ouvir conteúdo', exact: true }).click();
  await scan();
  await page.goto('/web/sobre.html');
  await scan();
});

test('extensão permite autorizar a leitura do texto da aba após cancelar a captura e apresenta uma checagem com fonte', async () => {
  test.setTimeout(60000);
  const extensionPath = resolve('extensao');
  const userDataDir = await mkdtemp(join(tmpdir(), 'central-test-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true, channel: 'chromium', viewport: { width: 1280, height: 900 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--enable-unsafe-extension-debugging', '--enable-usermedia-screen-capturing', '--auto-select-tab-capture-source-by-title=Teste de captura autorizada'],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    await expect.poll(() => worker.evaluate(() => chrome.action.onClicked.hasListeners()),{timeout:15000}).toBe(true);
    const demoPage = await context.newPage();
    await demoPage.goto('http://127.0.0.1:4176/demo/noticia.html');
    await demoPage.evaluate(() => { document.title = 'Teste de captura autorizada'; });
    const extensionPage = await context.newPage();
    const extensionErrors=[];
    extensionPage.on('pageerror',error=>extensionErrors.push(error.message));
    await extensionPage.goto(`chrome-extension://${extensionId}/web/index.html`);
    // O seletor nativo aceita apenas a aba de teste no perfil isolado.
    await extensionPage.bringToFront();
    await extensionPage.locator('#analyze-page').click();
    await extensionPage.locator('#start-sharing').click();
    await demoPage.bringToFront();
    await extensionPage.bringToFront();
    await extensionPage.locator('#live-preview').waitFor({timeout:15000});
    await extensionPage.locator('#live-preview').screenshot({path:'test-results/previa-real.png'});
    await expect(extensionPage.locator('.finding')).toHaveText('Falso, segundo a fonte', { timeout: 20000 });
    await expect(extensionPage.locator('#live-text')).toContainText(knownClaim);
    await demoPage.evaluate(() => { document.body.innerHTML = '<main style="padding:45px;font:32px Arial">Dá para votar pelo celular se estiver chovendo?</main>'; });
    await expect(extensionPage.locator('#live-matches')).toContainText('votação é presencial', { timeout: 15000 });
    await extensionPage.locator('#stop-live').click();
    await expect(extensionPage.locator('#history-title')).toBeFocused();
    await extensionPage.locator('#history-view [data-back]').click();
    await demoPage.reload();
    await extensionPage.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('Cancelado', 'NotAllowedError'); };
    });
    await extensionPage.getByRole('button', { name: 'Analisar tela', exact: true }).click();
    await extensionPage.locator('#start-sharing').click();
    await expect(extensionPage.getByRole('heading', { name: 'Tela não compartilhada', exact: true })).toBeFocused();
    await demoPage.bringToFront();
    const browserCdp = await context.browser().newBrowserCDPSession();
    const { targetInfos } = await browserCdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
    const demoTarget = targetInfos.find((target) => target.url.endsWith('/demo/noticia.html'));
    await browserCdp.send('Extensions.triggerAction', { id: extensionId, targetId: demoTarget.targetId });
    await expect.poll(async () => {
      const { targetInfos: targets } = await browserCdp.send('Target.getTargets');
      return targets.filter((target) => target.url === `chrome-extension://${extensionId}/web/index.html`).length;
    }).toBe(2);
    // O painel nativo é um target CDP. Os mesmos handlers são exercitados em
    // uma aba de teste, sem mudar o foco da aba autorizada. As APIs são reais.
    await extensionPage.evaluate(() => document.getElementById('allow-tab').click());
    await expect(extensionPage.getByRole('heading', { name: 'Falso', exact: true })).toBeFocused();
    await expect(extensionPage.locator('#reviewed-claim')).toHaveValue(new RegExp('A urna eletrônica'));
    await expect(extensionPage.locator('#reviewed-claim')).not.toHaveValue(/DADO PRIVADO/);
    await expect(extensionPage.locator('#result-view .finding')).toHaveText('Falso, segundo a fonte');
    await extensionPage.getByRole('button', { name: 'Voltar', exact: true }).click();
    await extensionPage.getByRole('button', { name: 'Acessibilidade', exact: true }).click();
    await extensionPage.getByLabel('Tamanho do texto').selectOption('125');
    await expect(extensionPage.locator('#app-status')).toHaveText('Ajustes de leitura salvos neste dispositivo.');
    expect(await worker.evaluate(() => chrome.storage.local.get(null))).toEqual({ readingPreferences: { fontSize: '125', highContrast: true, textSpacing: 'normal' } });
    expect(extensionErrors).toEqual([]);
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
  await page.locator('#start-sharing').click();
  await expect(page.getByRole('heading', { name: 'Tela não compartilhada' })).toBeFocused();
  expect(ocrRequests).toEqual([]);
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.locator('#analyze-page')).toBeFocused();
  await page.locator('#open-settings').click();
  await page.getByLabel('Usar cores suaves').check();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-contrast', 'default');
});

test('legendas VTT e SRT podem ser consultadas sem som, por teclado e sem envio', async ({ page }) => {
  const external = [];
  page.on('request', (request) => { if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()); });
  await page.goto(panelPath);
  for (const ext of ['vtt', 'srt']) {
    await page.getByRole('button', { name: 'Colar informação', exact: true }).click();
    const file = page.locator('#caption-file');
    await file.setInputFiles({ name: 'vazio.' + ext, mimeType: 'text/plain', buffer: Buffer.from('sem tempos') });
    await expect(file).toHaveAttribute('aria-invalid', 'true');
    const content = ext === 'vtt'
      ? 'WEBVTT\n\nNOTE comentário\n\n00:00.000 --> 00:01.500\nPrimeira fala.\n\n00:02.000 --> 00:08.000\n<b>' + knownClaim + '</b>'
      : '1\r\n00:00:00,000 --> 00:00:01,500\r\nPrimeira fala.\r\n\r\n2\r\n00:00:02,000 --> 00:00:08,000\r\n' + knownClaim;
    await file.setInputFiles({ name: 'video.' + ext, mimeType: 'text/plain', buffer: Buffer.from(content) });
    await expect(page.locator('#caption-status')).toHaveText(/Falas disponíveis: 2/);
    await page.getByLabel('Escolha a fala pelo tempo ou pelo texto').press('End');
    await page.locator('#use-caption').press('Enter');
    await expect(page.locator('#claim')).toBeFocused();
    await expect(page.locator('#claim')).toHaveValue(knownClaim);
    await page.getByRole('button', { name: 'Pesquisar informação' }).press('Enter');
    await expect(page.locator('.finding')).toHaveText('Falso, segundo a fonte');
    await page.locator('#result-view [data-back]').press('Enter');
  }
  expect(external).toEqual([]);
});

test('ampliação e espaçamento acompanham a pessoa até a página de privacidade', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 620 });
  await page.goto(panelPath);
  await page.locator('#open-settings').click();
  await page.getByLabel('Tamanho do texto').selectOption('200');
  await page.getByLabel('Distância entre letras e palavras').selectOption('wide');
  const opened = context.waitForEvent('page');
  await page.getByRole('link', { name: /Sobre e privacidade/ }).press('Enter');
  const about = await opened;
  await about.setViewportSize({ width: 320, height: 620 });
  await expect(about.locator('body')).toHaveAttribute('data-text-spacing', 'wide');
  await expect(about.locator('html')).toHaveCSS('font-size', '32px');
  await expectNoOverflow(about);
  await page.getByLabel('Distância entre letras e palavras').selectOption('normal');
  await expect(about.locator('body')).not.toHaveAttribute('data-text-spacing', 'wide');
});

test('resultado falado tem equivalente escrito, velocidade ajustável e retorno de foco', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [], speak: (u) => { window.lastSpeech = { text: u.text, rate: u.rate }; },
      cancel() {}, pause() {}, resume() {},
    } });
  });
  await page.goto(panelPath);
  await pasteAndVerify(page, knownClaim);
  await page.getByRole('button', { name: 'Ouvir resultado' }).press('Enter');
  await expect(page.locator('#pause-speech')).toBeFocused();
  await expect(page.locator('#speech-help')).toContainText('Leitura iniciada');
  await page.locator('#stop-speech').press('Enter');
  await page.getByLabel('Velocidade da voz').selectOption('0.75');
  await page.locator('#speak').press('Enter');
  const spoken = await page.evaluate(() => window.lastSpeech);
  expect(spoken.rate).toBe(0.75);
  expect(spoken.text).toContain('Falso, segundo a fonte');
  await expect(page.getByText('Ver texto para ouvir', { exact: true })).toHaveCount(0);
  await page.locator('#audio-view [data-back]').press('Enter');
  await expect(page.getByRole('button', { name: 'Ouvir resultado' })).toBeFocused();
});

test('cards com rótulos, alvo amplo, contraste e foco em cores forçadas', async ({ page }) => {
  await page.goto(panelPath);
  for (const soft of [false, true]) {
    if (soft) {
      await page.locator('#open-settings').click();
      await page.getByLabel('Usar cores suaves').check();
      await page.locator('#settings-view [data-back]').click();
    }
    const cards = page.locator('.action-card');
    const metrics = await cards.evaluateAll(items => {
      function luminance(color) {
        const weights = [.2126, .7152, .0722];
        return color.match(/\d+/g).reduce((sum, n, i) => {
          const value = Number(n) / 255;
          return sum + weights[i] * (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        }, 0);
      }
      function ratio(a,b) { return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
      return items.map(el => {
        const bg = luminance(getComputedStyle(el).backgroundColor);
        return { text: ratio(bg, luminance(getComputedStyle(el).color)), icon: ratio(bg, luminance(getComputedStyle(el.querySelector('.card-icon')).color)), area: Math.min(el.clientWidth, el.clientHeight) };
      });
    });
    for (let i = 0; i < metrics.length; i++) {
      await expect(cards.nth(i)).toHaveAccessibleName(await cards.nth(i).locator('.card-label').innerText());
      expect(metrics[i].text).toBeGreaterThanOrEqual(7);
      expect(metrics[i].icon).toBeGreaterThanOrEqual(3);
      expect(metrics[i].area).toBeGreaterThanOrEqual(44);
    }
  }
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.reload();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#analyze-page')).toBeFocused();
  await expect(page.locator('#analyze-page')).toHaveCSS('outline-style', 'solid');
});

test('legenda e resultado preservam o fluxo com espaçamento personalizado e janela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 256 });
  await page.goto(panelPath);
  await page.addStyleTag({ content: '* { line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important } p { margin-bottom:2em !important }' });
  await page.getByRole('button', { name: 'Colar informação', exact: true }).press('Enter');
  await page.locator('#caption-file').setInputFiles({ name: 'teste.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:08.000\n' + knownClaim) });
  await expect(page.locator('#caption-choice')).toBeVisible();
  await expectNoOverflow(page);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.locator('#use-caption').press('Enter');
  await expect(page.locator('#claim')).toBeInViewport();
  await page.getByRole('button', { name: 'Pesquisar informação' }).press('Enter');
  await expect(page.locator('#result-title')).toBeInViewport();
  await expectNoOverflow(page);
  await page.locator('#result-view [data-back]').press('Enter');
  await expect(page.locator('#open-paste')).toBeFocused();
  await expect(page.locator('#open-paste')).toBeInViewport();
});

test('Voltar tem contorno, alvo amplo e retorno por teclado nos dois temas', async ({ page }) => {
  await page.goto(panelPath);
  for (const soft of [false, true]) {
    await page.locator('#open-settings').press('Enter');
    await page.locator('#standard-colors').setChecked(soft);
    const back = page.getByRole('button', { name: 'Voltar', exact: true });
    await back.focus();
    await expect(back).toHaveCSS('border-top-style', 'solid');
    await expect(back).toHaveCSS('border-top-width', '2px');
    const box = await back.boundingBox();
    expect(Math.min(box.height, box.width)).toBeGreaterThanOrEqual(44);
    await back.press('Enter');
    await expect(page.locator('#open-settings')).toBeFocused();
  }
});

test('VLibras preserva a conclusão no painel e somente conecta a pedido', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const external = [];
  await context.route(/^https:\/\//, route => { external.push(route.request().url()); return route.abort(); });
  await page.goto(panelPath);
  await pasteAndVerify(page, knownClaim);
  await page.locator('#open-libras-details').press('Enter');
  const value = await page.getByLabel('Texto para o tradutor').inputValue();
  expect(value).toContain('Falso, segundo a fonte');
  await page.locator('#copy-libras').press('Enter');
  await expect(page.locator('#libras-status')).toHaveText('Conclusão copiada.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
  const opened = context.waitForEvent('page');
  await page.locator('#libras-details a').press('Enter');
  const libras = await opened;
  await expect(libras.locator('h1')).toHaveText('Traduzir em Libras');
  expect(new URL(libras.url()).search).toBe('');
  expect(external).toEqual([]);
  await libras.getByRole('button', { name: 'Ativar VLibras nesta página' }).press('Enter');
  await expect(libras.getByRole('status')).toContainText('Não foi possível carregar');
  expect(external).toEqual(['https://vlibras.gov.br/app/vlibras-plugin.js']);
});

import { observarVoz } from '../observar-voz.js';
import { test, expect } from '@playwright/test';

test('orientação por teclado vem antes da permissão e oferece alternativa sem captura', async ({ page }) => {
  await page.addInitScript(() => { window.requested = false; navigator.mediaDevices.getDisplayMedia = async () => { window.requested = true; throw new DOMException('Cancelado','NotAllowedError'); }; });
  await page.goto('/web/index.html');
  await page.locator('#analyze-page').click();
  await expect(page.locator('#capture-help-title')).toBeFocused();
  expect(await page.evaluate(() => window.requested)).toBe(false);
  await expect(page.locator('#capture-help-view')).toContainText('Shift + Tab');
  await page.locator('#share-paste-alternative').click();
  await expect(page.locator('#paste-title')).toBeFocused();
  expect(await page.evaluate(() => window.requested)).toBe(false);
});

test('títulos ficam ao lado de Voltar e Libras começa desligado', async ({ page }) => {
  const requests = []; page.on('request',r=>{if(r.url().includes('vlibras.gov.br'))requests.push(r.url());});
  await page.goto('/web/index.html');
  await page.locator('#open-settings').click();
  await expect(page.locator('#enable-libras')).not.toBeChecked();
  const title = await page.locator('#settings-title').boundingBox();
  const back = await page.locator('#settings-view [data-back]').boundingBox();
  expect(title.x).toBeGreaterThanOrEqual(back.x + back.width);
  expect(Math.abs((title.y+title.height/2)-(back.y+back.height/2))).toBeLessThan(2);
  expect(requests).toEqual([]);
  const ids = await page.locator('[id]').evaluateAll(items=>items.map(el=>el.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('Eleições verifica legenda com o mesmo formulário e permite outra checagem', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*',route=>route.fulfill({body:'<rss><channel></channel></rss>'}));
  await page.goto('/web/index.html');
  await page.locator('#open-elections').click();
  await expect(page.locator('#election-entry #review-form')).toBeVisible();
  await page.locator('#caption-file').setInputFiles({name:'noticia.vtt',mimeType:'text/vtt',buffer:Buffer.from('WEBVTT\n\n00:00.000 --> 00:03.000\nA urna eletrônica é conectada à internet durante a votação.\n')});
  await page.locator('#use-caption').click();
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-title')).toHaveText('Falso');
  await page.locator('#new-query').click();
  await expect(page.locator('#elections-view')).toBeVisible();
  await expect(page.locator('#claim')).toBeFocused();
  await expect(page.locator('#claim')).toHaveValue('');
  await expect(page.locator('#review-form')).toHaveCount(1);
  await expect(page.locator('#election-headlines a').first()).toContainText(/Tribunal Superior Eleitoral|Agência Brasil/);
});

test('legenda com o ano trocado leva o foco ao veredito e informa o ano confirmado', async ({ page }) => {
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  const legenda = 'WEBVTT\n\n00:00.000 --> 00:05.000\nVídeo mostra resgate de onça no rio Negro, em Manaus, em 2020.';
  await page.locator('#caption-file').setInputFiles({ name: 'resgate.vtt', mimeType: 'text/vtt', buffer: Buffer.from(legenda) });
  await page.locator('#use-caption').click();
  await page.locator('#review-form [type=submit]').click();
  const titulo = page.getByRole('heading', { name: 'Falso', exact: true });
  await expect(titulo).toBeFocused({ timeout: 25000 });
  await expect(titulo).toHaveClass(/verdict-false/);
  await expect(page.locator('#result-matches')).toContainText('A checagem confirma 2025');
  await expect(page.locator('#result-matches a').first()).toHaveAttribute('href', /g1\.globo\.com\/fato-ou-fake\//);
});

test('perguntas e detalhes trocados mostram e falam o veredito seguido do contexto', async ({ page }) => {
  await observarVoz(page);
  await page.route('**/pesquisa/fonte?*', route => route.fulfill({status:503}));
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  for (const [pergunta, veredito, contexto] of [
    ['Vídeo mostra resgate de onça no rio Negro, em Manaus, em 2020', 'Falso', 'A checagem confirma 2025'],
    ['Qual a idade mínima para votar?', 'Verdadeiro', 'A partir dos 16 anos'],
    ['pode votar de 20horas da noite?', 'Falso', 'fila já estará fechada'],
  ]) {
    await page.locator('#claim').fill(pergunta);
    await page.locator('#review-form [type=submit]').click();
    await expect(page.locator('#result-title')).toHaveText(veredito);
    await expect(page.locator('#result-summary')).toContainText(contexto);
    await expect(page.locator('#result-matches .finding')).toHaveText(veredito);
    expect(await page.evaluate(() => window.leituras.map(fala => fala.texto).at(-1))).toContain(veredito + '. ');
    await expect(page.locator('#result-view')).not.toContainText(/Fora de contexto|Resposta da fonte|Orientação da fonte/);
    await page.locator('#open-libras-details').click();
    await expect(page.locator('#libras-text')).toHaveValue(new RegExp('^' + veredito));
    await expect(page.locator('#libras-text')).not.toHaveValue(/Fora de contexto|Resposta da fonte/);
    await page.locator('#support-view [data-back]').click();
    await page.locator('#new-query').click();
  }
});

test('pesquisa tem sinal de espera e respeita redução de movimento', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*',async route=>{await new Promise(r=>setTimeout(r,1200));await route.fulfill({body:'<rss><channel></channel></rss>'});});
  await page.goto('/web/index.html');
  await page.locator('#open-settings').click();await page.locator('#reduce-motion').check();await page.locator('#settings-view [data-back]').click();
  await page.locator('#open-paste').click();await page.locator('#claim').fill('Uma notícia ainda não confirmada sobre astronomia');await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#research-status')).toHaveAttribute('data-busy','true');
  expect(await page.locator('#research-status').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
  await expect(page.locator('#result-title')).toHaveText('Não verificado');
  await expect(page.locator('#result-matches .finding')).toHaveCount(0);
});

test('OCR não depende de conversão assíncrona do canvas em segundo plano', async ({ page }) => {
  await page.goto('/web/index.html');
  const text=await page.evaluate(async()=>{
    const {createReader,readFrame}=await import('/web/captura-tela.js');
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=200;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,200);ctx.fillStyle='black';ctx.font='32px Arial';ctx.fillText('Informação para verificar com uma fonte.',30,100);
    canvas.toBlob=()=>{throw Error('Fila assíncrona indisponível.');};
    const controller=new AbortController();const worker=await createReader(controller.signal);
    try{return(await readFrame(worker,canvas,controller.signal)).text;}finally{await worker.terminate();}
  });
  expect(text).toContain('Informação para verificar com uma fonte');
});

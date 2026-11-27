import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const origem = process.env.TEST_URL || 'http://127.0.0.1:4177';
const videoDir = resolve('dist/validacao-0.14.0');
const gravacoes = resolve('docs/gravacoes');
await mkdir(gravacoes, { recursive: true });
const tamanho = { width: 900, height: 988 };
const opcoes = { viewport: tamanho, recordVideo: { dir: videoDir, size: tamanho } };
const trecho = ano => 'Vídeo mostra resgate de onça no rio Negro, em Manaus, em ' + ano;
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
const recorte = { x: 162, y: 0, width: 576, height: 988 };

async function gravarSite() {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext(opcoes);
  const pagina = await contexto.newPage();
  const video = pagina.video();
  try {
    await pagina.goto(origem + '/web/index.html');
    await pagina.screenshot({ path: 'docs/inicio.png', clip: recorte });
    await pagina.locator('#open-settings').click();
    await expect(pagina.locator('#enable-libras')).not.toBeChecked();
    await pagina.locator('#settings-view [data-back]').click();
    await pagina.locator('#open-paste').click();
    for (const [ano, veredito] of [[2020, 'Fora de contexto'], [2025, 'Verdadeiro']]) {
      await pagina.locator('#claim').pressSequentially(trecho(ano), { delay: 24 });
      await pagina.locator('#review-form [type=submit]').click();
      await expect(pagina.getByRole('heading', { name: veredito, exact: true })).toBeFocused({ timeout: 35000 });
      await expect(pagina.locator('#result-matches a').first()).toHaveAttribute('href', /g1\.globo\.com/);
      if (ano === 2020) {
        await expect(pagina.locator('#result-matches')).toContainText('A checagem confirma 2025');
        await pagina.screenshot({ path: 'docs/checagem.png', clip: recorte });
        await pausa(1500);
        await pagina.locator('#new-query').click();
      }
    }
    await pausa(1500);
    await pagina.goto(origem + '/web/index.html');
    await pagina.locator('#open-elections').click();
    await pagina.locator('#candidaturas li').first().waitFor();
    await expect(pagina.locator('#elections-view a[href*="resultados.tse.jus.br"]')).toHaveCount(0);
    await pagina.locator('#local-apuracao').evaluate(el => el.closest('section').scrollIntoView());
    await pagina.screenshot({ path: 'docs/apuracao.png', clip: recorte });
  } finally {
    await contexto.close();
    await navegador.close();
  }
  await copyFile(await video.path(), join(gravacoes, 'checagem-de-ano.webm'));
}

async function gravarExtensao() {
  const extensao = resolve('extensao');
  const titulo = 'Checagem de data na aba de teste';
  const contexto = await chromium.launchPersistentContext('', {
    ...opcoes, channel: 'chromium', headless: true,
    args: ['--disable-extensions-except=' + extensao, '--load-extension=' + extensao,
      '--enable-usermedia-screen-capturing', '--auto-select-tab-capture-source-by-title=' + titulo],
  });
  let video;
  try {
    const worker = contexto.serviceWorkers()[0] || await contexto.waitForEvent('serviceworker');
    const fonte = await contexto.newPage();
    await fonte.goto(origem + '/demo/noticia.html');
    await fonte.evaluate(({ titulo, texto }) => {
      document.title = titulo;
      const manchete = document.createElement('main');
      manchete.style.cssText = 'padding:40px;background:white;color:black;font:36px/1.5 Arial;';
      manchete.textContent = texto;
      document.body.replaceChildren(manchete);
    }, { titulo, texto: trecho(2020) });
    const painel = await contexto.newPage();
    video = painel.video();
    await painel.goto(new URL('/web/index.html', worker.url()).href);
    await painel.locator('#analyze-page').click();
    await pausa(900);
    await painel.locator('#start-sharing').click();
    await fonte.bringToFront();
    await painel.bringToFront();
    for (const [ano, veredito] of [[2020, 'Fora de contexto'], [2025, 'Verdadeiro']]) {
      if (ano === 2025) await fonte.locator('main').evaluate((el, texto) => { el.textContent = texto; }, trecho(ano));
      await expect(painel.locator('#live-text')).toContainText(String(ano), { timeout: 35000 });
      await expect(painel.locator('#live-verdict')).toHaveText(veredito, { timeout: 15000 });
      if (ano === 2020) await expect(painel.locator('#live-matches')).toContainText('A checagem confirma 2025');
      await pausa(1800);
    }
    await painel.locator('#stop-live').click();
    await expect(painel.locator('#history-title')).toBeFocused();
    for (const nome of ['Fora de contexto', 'Verdadeiro']) {
      await expect(painel.locator('#history-matches').getByRole('heading', { name: nome, exact: true })).toBeVisible();
    }
    await pausa(1400);
  } finally {
    await contexto.close();
  }
  await copyFile(await video.path(), join(gravacoes, 'ano-na-analise-de-tela.webm'));
}

await gravarSite();
await gravarExtensao();
console.log('Gravações e imagens verificadas em docs.');

import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pasta = resolve('dist/demo-celular');
await mkdir(pasta, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR',
  });
  await context.addInitScript(() => { navigator.mediaDevices.getDisplayMedia = undefined; });
  const page = await context.newPage();
  await page.setContent('<main style="font: 28px Arial; padding: 32px; width: 550px">Posso entrar na cabine de votação com o celular?</main>');
  const imagem = await page.locator('main').screenshot();
  await page.goto('http://127.0.0.1:4177/web/index.html');
  await page.locator('#analyze-page').tap();
  await expect(page.getByLabel('Escolher captura de tela')).toBeVisible();
  await page.screenshot({ path: pasta + '/1.png' });
  await page.getByLabel('Escolher captura de tela').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: imagem });
  await expect(page.locator('#result-view')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: pasta + '/2.png' });
  await page.locator('#result-view [data-back]').tap();
  await page.locator('#open-settings').tap();
  await page.locator('#font-size').selectOption('125');
  await page.screenshot({ path: pasta + '/3.png' });
  await page.locator('#settings-view [data-back]').tap();
  await page.locator('#open-audio').tap();
  await page.evaluate(async wav => {
    const context = new AudioContext();
    await context.resume();
    const buffer = await context.decodeAudioData(Uint8Array.from(atob(wav), c => c.charCodeAt(0)).buffer);
    const dest = context.createMediaStreamDestination();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);
    navigator.mediaDevices.getUserMedia = async () => dest.stream;
    window.falarAmostra = () => new Promise(resolve => { source.onended = resolve; source.start(); });
  }, (await readFile('tests/fixtures/cabine.wav')).toString('base64'));
  await page.locator('#mic-input').tap();
  await expect(page.locator('#audio-input-status')).toContainText('Escutando');
  await page.locator('#audio-input-stop').scrollIntoViewIfNeeded();
  await page.screenshot({ path: pasta + '/4.png' });
  await page.evaluate(() => window.falarAmostra());
  await page.locator('#audio-input-stop').tap();
  await expect(page.locator('#result-view')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: pasta + '/5.png' });
  console.log('Cinco telas reais capturadas. Captura e áudio de teste chegaram ao resultado.');
} finally { await browser.close(); }

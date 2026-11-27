import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { newsEdition } from '../../regras-negocio/edicao-noticias.js';

const panel = '/web/index.html';
const fixture = 'tests/fixtures/cabine.wav';

test('um arquivo local de voz gera transcrição editável e contexto com fonte', async ({ page }) => {
  await page.goto(panel);
  await page.locator('#open-paste').click();
  await page.locator('#caption-file').setInputFiles(fixture);
  await expect(page.locator('#caption-status')).toContainText('Transcrição pronta', { timeout: 18000 });
  await expect(page.locator('#claim')).toHaveValue(/cabine de votação/i);
  await page.locator('#review-form button[type=submit]').click();
  await expect(page.locator('#result-matches')).toContainText('sigilo do voto');
});

for (const mode of ['mic', 'tab']) {
  test('transcrição de voz via ' + mode + ' libera a faixa e mostra a fonte', async ({ page }) => {
    await page.addInitScript(({ mode, wav }) => {
      const capture = async () => {
        const context = new AudioContext();
        await context.resume();
        const buffer = await context.decodeAudioData(Uint8Array.from(atob(wav), c => c.charCodeAt(0)).buffer);
        const dest = context.createMediaStreamDestination();
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(dest);
        window.playFixture = () => source.start();
        return window.fixtureStream = dest.stream;
      };
      navigator.mediaDevices[mode === 'mic' ? 'getUserMedia' : 'getDisplayMedia'] = capture;
    }, { mode, wav: (await readFile(fixture)).toString('base64') });
    await page.goto(panel);
    await page.locator('#open-audio').click();
    await page.locator('#' + mode + '-input').click();
    if (mode === 'tab') await page.locator('#start-sharing').click();
    await expect(page.locator('#audio-input-status')).toContainText('Escutando', { timeout: 10000 });
    await page.evaluate(() => window.playFixture());
    await expect(page.locator('#audio-transcript')).toContainText(/cabine de votação com (?:o )?celular/i, { timeout: 15000 });
    await page.locator('#audio-input-stop').click();
    await expect(page.locator('#result-matches a').first()).toBeVisible({timeout:20000});
    expect(await page.evaluate(() => window.fixtureStream.active)).toBe(false);
  });
}

test('link de checagem, correspondência por tema e recusa de áudio têm estados distintos', async ({ page }) => {
  const story = newsEdition.find(item => item.title.startsWith('É #FAKE que') && item.title.includes('transportando urnas'));
  await page.goto(panel);
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill(story.url);
  await page.locator('#review-form button[type=submit]').click();
  await expect(page.locator('#result-matches .finding')).toHaveText('Falso');
  await expect(page.locator('#result-matches a').first()).toHaveAttribute('href', story.url);
  await page.locator('#result-view [data-back]').click();
  await page.locator('#open-audio').click();
  await page.evaluate(() => { navigator.mediaDevices.getDisplayMedia = async () => new MediaStream(); });
  await page.locator('#tab-input').click();
  await page.locator('#start-sharing').click();
  await expect(page.locator('#audio-input-status')).toContainText('Compartilhar áudio da aba');
});

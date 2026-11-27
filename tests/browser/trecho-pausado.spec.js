import { test, expect } from '@playwright/test';

test('resultado da pesquisa fica estável e Continuar análise lê o próximo trecho', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    window.eventosDeVoz = [];
    window.Audio = class extends Audio {
      constructor(url) {
        super(url);
        for (const evento of ['playing','ended']) this.addEventListener(evento, () => {
          window.eventosDeVoz.push(evento + ' ' + this.currentSrc.split('/').pop());
        });
      }
    };
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200; canvas.height = 240;
      const ctx = canvas.getContext('2d');
      window.trocarTrecho = texto => {
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1200, 240);
        ctx.fillStyle = 'black'; ctx.font = '30px Arial';
        ctx.fillText(texto, 35, 100);
      };
      window.trocarTrecho('Museu recebe exposição de cerâmica em Curitiba.');
      return canvas.captureStream(10);
    };
  });
  const passagem = 'O museu de Santos recebeu uma exposição de cerâmica, aberta ao público durante todo o mês.';
  await page.route('**/pesquisa/fonte?*', route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    return route.fulfill({ body: url.hostname === 'g1.globo.com'
      ? '<main><h1>Museu recebe exposição de cerâmica em Santos</h1><p>' + passagem + '</p></main>'
      : '<rss><channel><item><title>Museu recebe exposição de cerâmica em Santos</title><link>https://g1.globo.com/cultura/museu.html</link></item></channel></rss>' });
  });
  await page.route('**/api/comparar', async route => {
    await new Promise(resolve => setTimeout(resolve, 900));
    const dados = route.request().postDataJSON();
    const indice = dados.fontes.findIndex(f => f.trechos.includes(passagem));
    await route.fulfill({ json: { status: 'comparado', tipo: 'context', indice, trecho: passagem, explicacao: 'A exposição acontece em Santos.' } });
  });
  await page.goto('/web/index.html');
  await page.locator('#analyze-page').click();
  await page.locator('#start-sharing').click();
  const ouviu = async evento => expect.poll(() => page.evaluate(() => window.eventosDeVoz)).toContain(evento);
  await ouviu('playing pesquisando.mp3');
  await page.keyboard.press('Tab');
  await expect(page.locator('#live-verdict')).toHaveText('Falso', { timeout: 30000 });
  await ouviu('playing resultadoFalso.mp3');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await ouviu('ended resultadoFalso.mp3');
  await expect(page.locator('#continue-live')).toBeVisible();
  for (const id of ['continue-live','stop-live']) {
    expect(await page.locator('#'+id).evaluate(el => Boolean(el.compareDocumentPosition(document.getElementById('live-matches')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  }
  await page.evaluate(() => window.trocarTrecho('Vídeo mostra resgate de onça no rio Negro, em Manaus, em 2025.'));
  await expect(page.locator('#live-text')).toContainText('Curitiba');
  await page.locator('#continue-live').press('Space');
  await expect(page.locator('#live-verdict')).toHaveText('Verdadeiro', { timeout: 15000 });
  await ouviu('playing resultadoVerdadeiro.mp3');
  await page.keyboard.press('Tab');
  await ouviu('ended resultadoVerdadeiro.mp3');
  await page.locator('#stop-live').click();
  await expect(page.locator('#history-back')).toBeFocused();
  await ouviu('playing fimDaAnalise.mp3');
  await expect(page.locator('#history-matches')).toContainText('A exposição acontece em Santos');
  await expect(page.locator('#history-matches')).toContainText('Verdadeiro');
  await page.locator('#restart-analysis').click();
  await page.locator('#start-sharing').click();
  await page.locator('#live-voice').uncheck();
  const antes = await page.evaluate(() => window.eventosDeVoz.length);
  await expect(page.locator('#continue-live')).toBeVisible({timeout:15000});
  await page.locator('#stop-live').click();
  await expect(page.locator('#history-back')).toBeFocused();
  expect(await page.evaluate(antes => window.eventosDeVoz.slice(antes).filter(e => e.startsWith('playing ')), antes)).toEqual([]);
});

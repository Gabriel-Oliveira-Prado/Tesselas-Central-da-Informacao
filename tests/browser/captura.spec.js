import { test, expect } from '@playwright/test';

test('a própria Central é recusada e a faixa é encerrada', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 500; canvas.height = 300;
      const stream = canvas.captureStream(5);
      stream.getVideoTracks()[0].getCaptureHandle = () => ({ handle: 'central-painel' });
      window.ownStream = stream;
      return stream;
    };
  });
  await page.goto('/web/index.html');
  await page.locator('#analyze-page').click();
  await page.locator('#start-sharing').click();
  await expect(page.locator('#result-summary')).toContainText('A área escolhida inclui o painel');
  expect(await page.evaluate(() => window.ownStream.active)).toBe(false);
});
test.describe('captura pelo celular', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('lê a imagem da galeria quando o navegador não compartilha a tela', async ({ page }) => {
    await page.addInitScript(() => { navigator.mediaDevices.getDisplayMedia = undefined; });
    await page.setContent('<main style="font: 28px Arial; padding: 32px; width: 550px">Posso entrar na cabine de votação com o celular?</main>');
    const imagem = await page.locator('main').screenshot();
    await page.goto('/web/index.html');
    await page.getByRole('button', { name: /Analisar tela/i }).first().tap();
    await expect(page.locator('#capture-help-title')).toBeFocused();
    await expect(page.locator('#start-sharing')).toBeHidden();
    const campo = page.getByLabel('Escolher captura de tela');
    await expect(campo).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await campo.setInputFiles({ name: 'noticia.png', mimeType: 'image/png', buffer: imagem });
    await expect(page.locator('#result-view')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#reviewed-claim')).toHaveValue(/cabine de vota/i);
  });
});

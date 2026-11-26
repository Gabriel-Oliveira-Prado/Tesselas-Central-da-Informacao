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

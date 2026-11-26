import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const assets = new URL('../web/assets/', import.meta.url);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await page.goto(new URL('mark.svg', assets).href);
  for (const size of [16, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({ omitBackground: true, path: fileURLToPath(new URL(`icon-${size}.png`, assets)) });
  }
} finally {
  await browser.close();
}

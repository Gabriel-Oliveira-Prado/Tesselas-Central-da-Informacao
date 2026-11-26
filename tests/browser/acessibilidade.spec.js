import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('informações dos cards, atalhos e Tab alcançam a conclusão', async ({ page }) => {
  await page.addInitScript(() => {
    window.focusSpeech = [];
    Object.defineProperty(window, 'speechSynthesis', { value: {
      cancel() {}, getVoices: () => [],
      speak: utterance => window.focusSpeech.push(utterance.text),
    } });
  });
  await page.goto('/web/index.html');
  const help = page.getByRole('button', { name: 'Sobre Analisar tela', exact: true });
  await help.press('Enter');
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#card-info-1')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('2');
  await expect(page.locator('#paste-title')).toBeFocused();
  await page.locator('#claim').fill('Pode votar depois das 17?');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-matches')).toContainText('Quem já estava na fila');
  const conclusion = page.locator('#result-matches .verdict-label');
  await page.locator('#result-summary').focus();
  for (let i = 0; i < 6 && !await conclusion.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
  await expect(conclusion).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.focusSpeech.join(' '))).toContain('Depende de estar na fila');
  await page.locator('#new-query').click();
  await expect(page.locator('#claim')).toBeFocused();
  await expect(page.locator('#claim')).toHaveValue('');
});

test('cards empilhados e cores preservam o contraste no celular', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/web/index.html');
  const boxes = await page.locator('.card-shell').evaluateAll(items => items.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })));
  expect(new Set(boxes.map(box => box.x)).size).toBe(1);
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('legenda da fala destaca a palavra recebida do sintetizador', async ({ page }) => {
  await page.goto('/web/index.html');
  await page.evaluate(async () => {
    const { highlightSpeech } = await import('./navegacao-acessivel.js');
    const utterance = {};
    highlightSpeech(utterance, 'Votação presencial com documento.', document.getElementById('spoken-preview'));
    utterance.onboundary({ name: 'word', charIndex: 8 });
  });
  await expect(page.locator('[data-spoken-word]')).toHaveText('presencial');
});

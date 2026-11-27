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
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('.brand')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.focusSpeech.at(-1))).toBe('Logo Central da Informação, início');
  await page.keyboard.press('Tab');
  await expect(page.locator('#home-title')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.focusSpeech.at(-1))).toContain('Como podemos ajudar? Use 1 a 5 para selecionar.');
  for (const [index, card] of ['analyze-page','open-paste','open-audio','open-settings','open-elections'].entries()) {
    await page.keyboard.press(String(index + 1));
    await expect(page.locator('#' + card)).toBeFocused();
    await expect(page.locator('#home-view')).toBeVisible();
  }
  const help = page.getByRole('button', { name: 'Sobre Analisar tela', exact: true });
  await help.press('Enter');
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#card-info-1')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('2');
  await expect(page.locator('#open-paste')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.focusSpeech.at(-1))).toBe('Colar informação');
  await page.keyboard.press('Enter');
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

test('preferências anteriores migram e o painel comporta texto a 400% em 320 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('/web/index.html');
  await page.evaluate(() => localStorage.setItem('central-reading', JSON.stringify({ wideSpacing: true, colorProfile: 'blue' })));
  await page.reload();
  await page.locator('#open-settings').click();
  await expect(page.locator('#text-spacing')).toHaveValue('wide');
  await expect(page.locator('#color-profile')).toHaveValue('protanopia');
  await page.locator('#font-size').selectOption('400');
  await page.locator('#color-profile').selectOption('tritanopia');
  const semRolagemHorizontal = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await semRolagemHorizontal();
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('font-size', '64px');
  await expect(page.locator('body')).toHaveAttribute('data-color-profile', 'tritanopia');
  await semRolagemHorizontal();
  for (const id of ['open-audio', 'open-paste', 'analyze-page', 'open-elections']) {
    await page.locator('#' + id).click();
    await semRolagemHorizontal();
    await page.locator('.view:visible [data-back]').click();
  }
});

test('apuração oficial permite comparar turnos e percorrer candidaturas estaduais', async ({ page }) => {
  await page.goto('/web/index.html');
  await page.locator('#open-elections').click();
  await expect(page.locator('#candidaturas li')).toHaveCount(2);
  await expect(page.locator('#elections-view a[href*="resultados.tse.jus.br"]')).toHaveCount(0);
  await expect(page.locator('#candidaturas')).toContainText(/Presidente · Eleito · \d+,\d+%/);
  await page.locator('#local-apuracao').selectOption('df');
  await page.locator('#disputa').selectOption({ label: 'Deputado Distrital · 1º turno' });
  await expect(page.locator('#candidaturas li')).toHaveCount(10);
  await page.locator('#mais-candidaturas').press('Enter');
  await expect(page.locator('#candidaturas li')).toHaveCount(20);
  await expect(page.locator('#candidaturas li').nth(10)).toBeFocused();
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
test('Espaço e Enter ativam os controles e a pesquisa anuncia o início uma vez', async ({ page }) => {
  await page.addInitScript(() => {
    window.avisos = [];
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [], cancel() {}, speak: fala => window.avisos.push(fala.text),
    } });
  });
  await page.route('**/pesquisa/fonte?*', route => route.fulfill({ status: 503 }));
  await page.goto('/web/index.html');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.locator('#analyze-page')).toBeFocused();
  await page.keyboard.press('4');
  await page.keyboard.press('Enter');
  const voz = page.locator('#speak-focus');
  await voz.press('Enter');
  await expect(voz).not.toBeChecked();
  await voz.press('Space');
  await expect(voz).toBeChecked();
  await page.locator('#settings-view [data-back]').press('Enter');
  await page.keyboard.press('2');
  await page.keyboard.press('Space');
  await page.locator('#claim').fill('votar com 16 anos e so se quiser?');
  await page.locator('#review-form [type=submit]').press('Enter');
  await expect(page.locator('#result-title')).toHaveText('Verdadeiro');
  await expect(page.locator('#result-summary')).toContainText('Sim. No Brasil, quem tem 16 ou 17 anos pode escolher');
  await expect(page.locator('#result-title')).toBeFocused();
  expect(await page.evaluate(() => window.avisos.filter(texto => texto.startsWith('Pesquisando')))).toEqual(['Pesquisando a informação. Aguarde.']);
});

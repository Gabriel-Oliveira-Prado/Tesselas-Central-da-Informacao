import { test, expect } from '@playwright/test';
import { unzipSync } from 'fflate';

test('as duas vozes tocam amostras distintas e a escolha persiste', async ({page}) => {
  await page.addInitScript(() => {
    window.amostras = [];
    const AudioNativo = window.Audio;
    window.Audio = class extends AudioNativo {
      constructor(url) {
        super(url);
        this.addEventListener('playing', () => window.amostras.push(this.currentSrc));
      }
    };
  });
  await page.goto('/web/index.html');
  for (const voz of ['dora','alex']) {
    await page.locator('#open-settings').click();
    await page.getByLabel('Voz da leitura').selectOption(voz);
    await page.getByRole('button',{name:'Ouvir amostra da voz'}).click();
    await expect.poll(() => page.evaluate(() => window.amostras.at(-1))).toContain('/' + voz + '/amostra.mp3');
    await page.reload();
  }
  await page.locator('#open-settings').click();
  await expect(page.getByLabel('Voz da leitura')).toHaveValue('alex');
});

test('guia do site entrega o ZIP com o painel, o manifesto e os ícones', async ({page,request}) => {
  await page.goto('/web/index.html');
  await page.getByRole('link',{name:'Como instalar e usar a extensão'}).click();
  await expect(page.getByRole('heading',{name:'Conferir uma notícia'})).toBeVisible();
  const link = page.getByRole('link',{name:/Baixar a extensão/});
  const resposta = await request.get(new URL(await link.getAttribute('href'), page.url()).href);
  expect(resposta.headers()['content-type']).toBe('application/zip');
  const arquivos = unzipSync(new Uint8Array(await resposta.body()),{filter: item => /manifest\.json|index\.html|icon-16\.png/.test(item.name)});
  const manifesto = JSON.parse(new TextDecoder().decode(arquivos['manifest.json']));
  expect(arquivos[manifesto.action.default_icon['16']]).toBeDefined();
  expect(arquivos[manifesto.side_panel.default_path]).toBeDefined();
});

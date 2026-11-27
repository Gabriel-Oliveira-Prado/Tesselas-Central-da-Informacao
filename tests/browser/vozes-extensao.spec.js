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
  const sobre = async voz => {
    await page.getByRole('button',{name:'Sobre',exact:true}).click();
    await expect.poll(() => page.evaluate(() => window.amostras.at(-1))).toContain('/' + voz + '/sobre.mp3');
    await page.keyboard.press('Escape');
    const ajuda = page.getByRole('button',{name:'Sobre Analisar tela',exact:true});
    await ajuda.click();
    await expect.poll(() => page.evaluate(() => window.amostras.at(-1))).toContain('/' + voz + '/sobreCard1.mp3');
    await ajuda.click();
  };
  await sobre('dora');
  for (const voz of ['alex','dora']) {
    await page.locator('#open-settings').click();
    await expect(page.locator('#voz-leitura option')).toHaveCount(2);
    await page.locator('#voz-leitura').selectOption(voz);
    await expect.poll(() => page.evaluate(() => window.amostras.at(-1))).toContain('/' + voz + '/amostra.mp3');
    await page.reload();
    await sobre(voz);
  }
});

test('preferência antiga começa com Dora e falha na síntese preserva a voz escolhida', async ({page}) => {
  await page.goto('/web/index.html');
  await page.evaluate(() => localStorage.setItem('central-reading', JSON.stringify({voz:'navegador'})));
  await page.reload();
  await page.locator('#open-settings').click();
  await expect(page.locator('#voz-leitura')).toHaveValue('dora');
  await page.locator('#speak-focus').uncheck();
  await page.locator('#voz-leitura').selectOption('alex');
  await page.route('**/api/voz', route => route.fulfill({status:503}));
  await page.evaluate(async () => {
    window.falasDoNavegador = 0;
    speechSynthesis.speak = () => window.falasDoNavegador++;
    const {falar} = await import('/web/voz.js');
    await falar({text:'Uma frase inédita para o teste.'});
  });
  await expect(page.locator('#estado-voz')).toContainText('áudio de Alex está indisponível');
  expect(await page.evaluate(() => window.falasDoNavegador)).toBe(0);
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

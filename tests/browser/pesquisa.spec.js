import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('comparação usa passagens recuperadas para uma notícia fora do acervo', async ({ page }) => {
  const titulo = 'Museu recebe exposição de cerâmica em Santos';
  const trecho = 'A exposição de cerâmica abriu na terça-feira no museu de Santos e seguirá em cartaz até dezembro.';
  await page.route('**/pesquisa/fonte?*', route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    const body = url.hostname === 'g1.globo.com' ? '<main><h1>'+titulo+'</h1><p>'+trecho+'</p></main>' :
      '<rss><channel><item><title>'+titulo+'</title><link>https://g1.globo.com/cultura/exposicao.html</link></item></channel></rss>';
    return route.fulfill({body});
  });
  await page.route('**/api/comparar', route => {
    const envio = route.request().postDataJSON();
    expect(envio.fontes[0].trechos).toContain(trecho);
    expect(envio.afirmacao).toContain('Curitiba');
    return route.fulfill({json:{status:'comparado',tipo:'context',indice:0,trecho,explicacao:'A reportagem situa a exposição em Santos.'}});
  });
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('Museu recebe exposição de cerâmica em Curitiba');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-title')).toHaveText('Fora de contexto');
  await expect(page.locator('.verdict-context blockquote')).toHaveText(trecho);
  await expect(page.locator('.verdict-context a')).toHaveAttribute('href','https://g1.globo.com/cultura/exposicao.html');
});

test('pergunta inédita consulta buscadores e lê a página retornada, sem guardar a consulta', async ({ page }) => {
  const queries = [];
  await page.route('**/pesquisa/fonte?*', async route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    queries.push(url.searchParams.get('q'));
    const body = url.hostname === 'g1.globo.com'
      ? '<html><head><meta property="og:title" content="Como funciona a reciclagem de vidro"></head><body><main><p>A reciclagem de vidro utiliza a coleta seletiva para separar embalagens e encaminhá-las à indústria.</p></main></body></html>'
      : '<rss><channel><item><title>Como funciona a reciclagem de vidro</title><link>https://g1.globo.com/meio-ambiente/reciclagem-vidro.ghtml</link><description>Informações sobre a coleta de embalagens.</description></item></channel></rss>';
    await route.fulfill({ body, contentType:'text/plain' });
  });
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('Como funciona a reciclagem de vidro?');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-title')).toHaveText('Não verificado');
  await expect(page.locator('#result-matches')).toContainText('encaminhá-las à indústria');
  expect(queries.some(query=>query?.includes('reciclagem de vidro'))).toBe(true);
  await expect(page.locator('#result-matches .finding')).toHaveCount(0);
  await page.locator('#open-read-text-details').click();
  await expect(page.getByRole('textbox',{name:'Texto reconhecido'})).toHaveValue('Como funciona a reciclagem de vidro?');
  await page.getByRole('textbox',{name:'Texto reconhecido'}).press('Tab');
  expect(await page.evaluate(()=>Object.values(localStorage).join(' '))).not.toContain('reciclagem');
});

test('orientação de voto é sustentada por página consultada e botão permite nova pergunta', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*', async route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    await route.fulfill({body:url.hostname === 'www.tse.jus.br' ? '<html><head><meta property="og:title" content="Direitos políticos"></head><main><p>Art. 14. A soberania popular será exercida pelo sufrágio universal e pelo voto direto e secreto, com valor igual para todos.</p></main></html>':'<rss><channel></channel></rss>'});
  });
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('É proibido votar no Nordeste?');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-title')).toHaveText('Não verificado');
  await expect(page.locator('#result-matches')).toContainText('O direito de voto vale em todo o Brasil');
  await expect(page.locator('#result-matches a').first()).toHaveAttribute('href',/tse.jus.br/);
  const button = page.locator('#new-query');
  expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(64);
  const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await button.click();
  await expect(page.locator('#claim')).toBeFocused();
  await expect(page.locator('#claim')).toHaveValue('');
});

test('falha das fontes é explícita e uma pergunta desconhecida conserva a incerteza', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*', route=>route.fulfill({status:503}));
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('O restaurante da minha rua mudou de dono hoje?');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-scope')).toContainText('fontes online estão indisponíveis');
  await expect(page.locator('#result-matches .finding')).toHaveCount(0);
});

test('recusa de um portal permite ler a Constituição em outra fonte oficial com acentos preservados', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*', async route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    if (url.hostname === 'www.tse.jus.br') return route.fulfill({status:403});
    if (url.hostname === 'www.planalto.gov.br') return route.fulfill({contentType:'text/plain',body:Buffer.from('<html><head><title>Constituição</title></head><body><p>Art. 14. A soberania popular será exercida pelo sufrágio universal e pelo voto direto e secreto, com valor igual para todos.</p></body></html>','latin1')});
    await route.fulfill({body:'<rss><channel></channel></rss>'});
  });
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('Posso votar no Lula?');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-title')).toHaveText('Não verificado');
  await expect(page.locator('#result-matches')).toContainText('candidaturas válidas');
  await expect(page.locator('#result-matches blockquote')).toContainText('sufrágio universal');
  await expect(page.locator('#result-matches a').first()).toHaveAttribute('href',/planalto.gov.br/);
});

test('página indisponível preserva a notícia encontrada e não transforma manchete em veredito', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*', async route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    if (url.hostname !== 'news.google.com') return route.fulfill({status:403});
    await route.fulfill({body:'<rss><channel><item><title>Reciclagem de vidro ganha coleta seletiva</title><link>https://news.google.com/rss/articles/exemplo</link><source url="https://g1.globo.com">g1</source></item></channel></rss>'});
  });
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('Como funciona a reciclagem de vidro?');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-title')).toHaveText('Não verificado');
  await expect(page.locator('#result-matches')).toContainText('Reciclagem de vidro');
  await expect(page.locator('#result-matches .finding')).toHaveCount(0);
});

test('transcrição longa prioriza o acontecimento descrito e descarta notícia com poucas palavras em comum', async ({ page }) => {
  await page.route('**/pesquisa/fonte?*', async route => {
    const url = new URL(new URL(route.request().url()).searchParams.get('url'));
    if (url.hostname === 'g1.globo.com') return route.fulfill({body:'<html><head><title>Presidente Lula comemora aniversário</title></head><main><p>O presidente Lula comemora aniversário nesta semana acompanhado por amigos em Brasília e outros convidados.</p></main></html>'});
    const unrelated = '<item><title>Presidente Lula comemora aniversário</title><link>https://g1.globo.com/politica/aniversario.ghtml</link></item>';
    const relevant = '<item><title>Lula dá posse a general Amaro, novo ministro do GSI</title><link>https://news.google.com/rss/articles/posse</link><source url="https://g1.globo.com">g1</source></item>';
    await route.fulfill({body:'<rss><channel>'+unrelated+(url.hostname==='news.google.com'?relevant:'')+'</channel></rss>'});
  });
  await page.goto('/web/index.html');
  await page.locator('#open-paste').click();
  await page.locator('#claim').fill('o presidente lula deu posse ao ministro do gabinete de segurança institucional general marcos amaro o encontro foi no palácio do planalto com assuntos militares e de segurança');
  await page.locator('#review-form [type=submit]').click();
  await expect(page.locator('#result-matches')).toContainText('Lula dá posse a general Amaro');
  await expect(page.locator('#result-matches')).not.toContainText('aniversário');
});

import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, copyFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { falasFixas } from '../web/falas-fixas.js';

const origem = process.env.TEST_URL || 'http://127.0.0.1:4177';
const extensao = resolve('dist/extensao');
const instagram = 'https://www.instagram.com/p/DeLGhWcjNlL/';
await mkdir('dist', {recursive:true});
const pasta = await mkdtemp(resolve('dist/demo-narrada-'));
const cenas = [];
if (process.env.CENAS_DO_SITE) {
  const anteriores = JSON.parse(await readFile(join(process.env.CENAS_DO_SITE,'cenas.json'),'utf8'));
  if (anteriores.length < 9) throw Error('Faltam cenas do site.');
  cenas.push(...anteriores.slice(0,9));
}
const esperar = ms => new Promise(r => setTimeout(r,ms));
const contexto = await chromium.launchPersistentContext('', {
  channel:'chromium', headless:true, locale:'pt-BR', viewport:{width:1160,height:840},
  args:['--disable-extensions-except=' + extensao,'--load-extension=' + extensao,
    '--enable-usermedia-screen-capturing','--auto-select-tab-capture-source-by-title=Instagram'],
});

async function cena(pagina, texto, acao, audio) {
  const diretorio = join(pasta,String(cenas.length + 1));
  await mkdir(diretorio);
  await pagina.bringToFront();
  const quadros = [];
  let gravando = true;
  const inicio = Date.now();
  const gravar = (async () => {
    do {
      const arquivo = 'quadro-' + quadros.length + '.jpg';
      await pagina.screenshot({path:join(diretorio,arquivo),type:'jpeg',quality:78,timeout:10000});
      quadros.push({arquivo,ms:Date.now()-inicio});
      await esperar(240);
    } while (gravando);
  })();
  try { await acao(); await esperar(600); }
  finally { gravando = false; await gravar; }
  const fala = typeof texto === 'function' ? await texto() : texto;
  if (audio) await copyFile(audio,join(diretorio,'som'));
  else {
    const res = await fetch(origem + '/api/voz', {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({texto:fala,voz:'dora'}),signal:AbortSignal.timeout(60000)});
    if (!res.ok) throw Error('Falha na narração: HTTP ' + res.status);
    await writeFile(join(diretorio,'som'), Buffer.from(await res.arrayBuffer()));
  }
  cenas.push({pasta:diretorio,quadros,texto:fala});
  await writeFile(join(pasta,'cenas.json'),JSON.stringify(cenas));
  console.log('Cena',cenas.length,fala);
}

async function gravarSite() {
  const site = await contexto.newPage();
  await site.goto(origem + '/web/index.html');
  await cena(site, falasFixas.sobre, () => site.locator('#abrir-sobre').click(), 'web/assets/vozes/dora/sobre.mp3');
  await site.getByRole('button',{name:'Fechar',exact:true}).click();
  await cena(site,'No site, o guia da extensão mostra onde baixar o pacote e como abrir a Central ao lado da notícia.',async () => {
    await site.getByRole('link',{name:'Como instalar e usar a extensão'}).click();
    await site.getByRole('heading',{name:'Instalar no computador'}).waitFor();
  });
  await site.getByRole('link',{name:/Voltar/}).click();
  await cena(site,'Em Acessibilidade, aumentamos o texto e o espaço entre as palavras. O menu de cores também oferece opções para daltonismo.',async () => {
    await site.locator('#open-settings').click();
    await site.locator('#font-size').selectOption('125');
    await site.locator('#text-spacing').selectOption('medium');
    await site.locator('#color-profile').selectOption('deuteranopia');
    await site.locator('#color-profile').scrollIntoViewIfNeeded();
  });
  for (const [voz,nome] of [['dora','Dora, voz feminina'],['alex','Alex, voz masculina']]) {
    await cena(site, nome + '. ' + falasFixas.amostra, async () => {
      await site.locator('#voz-leitura').selectOption(voz);
      const carregou = site.waitForResponse(r => r.url().endsWith('/' + voz + '/amostra.mp3') && r.ok());
      await site.locator('#ouvir-amostra').click();
      await carregou;
    }, 'web/assets/vozes/' + voz + '/amostra.mp3');
  }
  await site.locator('#settings-view [data-back]').click();
  await cena(site,'O atalho cinco seleciona Eleições. Enter abre o painel. Aqui podemos checar uma informação ou consultar as candidaturas por estado e cargo.',async () => {
    await site.keyboard.press('5');
    await esperar(750);
    await site.keyboard.press('Enter');
    await site.locator('#candidaturas li').first().waitFor();
    await site.locator('#local-apuracao').scrollIntoViewIfNeeded();
  });
  await cena(site,'Enviamos este arquivo de áudio para transcrição.',async () => {
    await site.locator('#caption-file').setInputFiles('tests/fixtures/cabine.wav');
    await expect(site.locator('#caption-status')).toContainText('Transcrição pronta',{timeout:45000});
    await expect(site.locator('#claim')).toHaveValue(/cabine de vota/i,{timeout:45000});
    await site.locator('#claim').scrollIntoViewIfNeeded();
  });
  await cena(site, 'É proibido entrar na cabine de votação com celular.', async () => {
    await site.locator('#review-form [type=submit]').click();
    await site.locator('#result-view').waitFor({timeout:60000});
  }, 'tests/fixtures/cabine.wav');
  await cena(site,async () => (await site.locator('#result-title').innerText()) + '. ' + (await site.locator('#result-summary').innerText()),async () => {
    await site.locator('#result-title').scrollIntoViewIfNeeded();
  });
}

try {
  if (!cenas.length) await gravarSite();
  const post = await contexto.newPage();
  await post.goto(instagram,{waitUntil:'domcontentloaded',timeout:45000});
  await post.getByText(/recebeu 146 votos/).first().waitFor({state:'attached',timeout:20000});
  const aviso = post.getByRole('dialog').filter({has:post.getByRole('button',{name:/^(Fechar|Close)$/})}).first();
  await aviso.waitFor({timeout:8000}).catch(() => {});
  for (let tentativa = 0; tentativa < 3 && await aviso.isVisible(); tentativa++) {
    await esperar(1200);
    await aviso.getByRole('button',{name:/^(Fechar|Close)$/}).click();
    await esperar(700);
  }
  await expect(aviso).toBeHidden();
  await cena(post,'Esta é a publicação de JC no Instagram. A página aberta no teste apresenta uma imagem com legenda.',async () => {
    await post.getByRole('img',{name:/Photo by Jornal|Foto de Jornal/}).first().scrollIntoViewIfNeeded({timeout:5000});
  });
  const worker = contexto.serviceWorkers()[0] || await contexto.waitForEvent('serviceworker');
  const painel = await contexto.newPage();
  await painel.goto(new URL('/web/index.html',worker.url()).href);
  await expect(painel.locator('#chamada-extensao')).toBeHidden();
  await cena(painel,'Na extensão, escolhemos Analisar tela. O painel explica como escolher uma aba pelo teclado antes da autorização.', () => painel.locator('#analyze-page').click());
  await cena(painel,'Agora a extensão recebe os quadros da aba do Instagram e reconhece o texto da publicação.',async () => {
    await painel.locator('#start-sharing').click();
    await post.bringToFront(); await painel.bringToFront();
    await expect(painel.locator('#live-text')).toContainText(/Fl.vio|Bolsonaro|Lula|votos/i,{timeout:55000});
    await painel.locator('#live-text').scrollIntoViewIfNeeded();
  });
  await painel.locator('#continue-live').waitFor({timeout:80000});
  const resultado = await painel.locator('#live-verdict').innerText();
  await cena(painel,'Neste teste, a checagem da publicação retornou ' + resultado + '. O painel mostra o contexto do trecho que conseguiu ler.', async () => {
    await painel.locator('#live-verdict').scrollIntoViewIfNeeded();
  });
  await cena(painel,'Ao encerrar, o histórico reúne o resultado e o texto reconhecido na aba compartilhada.',async () => {
    await painel.locator('#stop-live').click(); await painel.locator('#history-title').waitFor();
  });
  console.log('Montagem:',pasta);
} finally { await contexto.close(); }

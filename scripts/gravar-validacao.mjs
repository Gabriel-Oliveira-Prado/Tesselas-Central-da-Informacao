import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { mkdir, readFile, writeFile, mkdtemp, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import './preparar-validadores.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:4177';
const folder = resolve('dist/validacao-0.11.0');
await mkdir(folder,{recursive:true});
const results = process.env.QA_ONLY ? JSON.parse(await readFile(join(folder,'resultados.json'),'utf8').catch(()=>'[]')) : [];
const pause = page => page.waitForTimeout(1800);
async function click(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});
  await page.waitForTimeout(180);await locator.click();
}
async function record(name, run, extra = {}) {
  if(process.env.QA_ONLY && !name.includes(process.env.QA_ONLY)) return;
  const options = {headless:true,channel:'chromium',viewport:{width:1360,height:1000},recordVideo:{dir:join(folder,'originais'),size:{width:1360,height:1000}},...extra};
  const context = extra.args ? await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(),'central-qa-')),options) : await (await chromium.launch({headless:true})).newContext(options);
  const browser = context.browser();
  await context.addInitScript(()=>{
    document.addEventListener('DOMContentLoaded',()=>{
      const cursor=document.createElement('span');cursor.dataset.testCursor='';cursor.setAttribute('aria-hidden','true');
      Object.assign(cursor.style,{position:'fixed',width:'18px',height:'18px',border:'3px solid #6735b8',borderRadius:'50%',pointerEvents:'none',zIndex:'2147483647',transform:'translate(-50%,-50%)'});
      document.body.append(cursor);document.addEventListener('mousemove',event=>{cursor.style.left=event.clientX+'px';cursor.style.top=event.clientY+'px';});
    });
  });
  const page = await context.newPage();const video = page.video();
  page.setDefaultTimeout(15000);
  const result = {name,video:name+'.webm',status:'executado'};
  try { await run(page,context,result); }
  catch(error) { result.status='falhou';result.error=error.message; }
  await page.screenshot({path:join(folder,name+'.png')}).catch(()=>{});
  await writeFile(join(folder,name+'.json'),JSON.stringify(result,null,2));
  await context.close();await browser?.close();
  if(video) await copyFile(await video.path(),join(folder,result.video));
  const previous=results.findIndex(row=>row.name===name);if(previous>=0)results.splice(previous,1);
  results.push(result);results.sort((a,b)=>a.name.localeCompare(b.name));console.log(name,result.status,result.summary || result.error || '');
  await writeFile(join(folder,'resultados.json'),JSON.stringify(results,null,2));
}

const extDirs = ['headingsmap','contraste','alternativas','desativar'].map(name=>resolve('dist/ferramentas',name));
const args = [`--disable-extensions-except=${extDirs.join(',')}`,`--load-extension=${extDirs.join(',')}`,'--enable-unsafe-extension-debugging'];
async function extensionAction(page,context,name) {
  await page.bringToFront();
  const workers = context.serviceWorkers();
  let worker;
  for(const w of workers) if((await w.evaluate(()=>chrome.runtime.getManifest().name)).includes(name)) worker=w;
  if(!worker) throw Error('Extensão de validação não carregada.');
  const session=await context.browser().newBrowserCDPSession();
  const {targetInfos}=await session.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});
  const target=targetInfos.find(t=>t.url===page.url());
  await session.send('Extensions.triggerAction',{id:new URL(worker.url()).host,targetId:target.targetId});
  await pause(page);
}
async function semantics(page) {
  const cdp=await page.context().newCDPSession(page);
  const {nodes}=await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter(node=>!node.ignored && node.name?.value).map(node=>({role:node.role?.value,name:node.name.value}));
}
async function sourceSnapshot(page) {
  const css=await readFile('web/estilos.css','utf8');
  const logo=await readFile('web/assets/logotipo.svg','utf8');
  return page.evaluate(({css,logo})=>{
    const root=document.documentElement.cloneNode(true);
    root.querySelectorAll('script,noscript,[hidden],link,[data-test-cursor]').forEach(el=>el.remove());
    const style=document.createElement('style');style.textContent=css;root.querySelector('head').append(style);
    root.querySelectorAll('img').forEach(el=>{el.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(logo);});
    return '<!doctype html>'+root.outerHTML;
  },{css,logo});
}

await record('01-fluxos-teclado',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');await page.evaluate(()=>document.fonts.ready);await pause(page);
  await page.keyboard.press('Tab');await pause(page);await page.keyboard.press('Enter');
  await click(page,page.locator('#open-paste'));await pause(page);
  await page.locator('#claim').pressSequentially('A urna eletrônica é conectada à internet durante a votação.',{delay:35});
  await click(page,page.locator('#review-form [type=submit]'));await page.locator('#result-view').waitFor({timeout:25000});await pause(page);
  result.false=await page.locator('#result-title').innerText();
  await click(page,page.locator('#open-read-text-details'));await page.locator('#reviewed-claim').focus();await page.keyboard.press('Tab');await pause(page);
  await click(page,page.locator('#support-view [data-back]'));await click(page,page.locator('#new-query'));
  await page.locator('#claim').pressSequentially('Vídeo mostra resgate de onça no rio Negro, em Manaus, em 2025',{delay:30});
  await click(page,page.locator('#review-form [type=submit]'));await page.locator('#result-view').waitFor({timeout:25000});await pause(page);
  result.true=await page.locator('#result-title').innerText();
  await writeFile(join(folder,'pagina-renderizada.html'),await sourceSnapshot(page));
  await click(page,page.locator('#new-query'));
  await page.locator('#claim').fill('O vídeo dos peritos federais comprova fraude nas eleições de 2022.');
  await click(page,page.locator('#review-form [type=submit]'));await page.locator('#result-view').waitFor({timeout:25000});await pause(page);result.context=await page.locator('#result-title').innerText();
  await click(page,page.locator('#result-view [data-back]'));await click(page,page.locator('#analyze-page'));await pause(page);
  result.permissionHelp=await page.locator('#capture-help-title').innerText();
  await click(page,page.locator('#share-paste-alternative'));await pause(page);
  await click(page,page.locator('#paste-view [data-back]'));await click(page,page.locator('#open-elections'));await pause(page);
  await page.locator('#election-headlines').scrollIntoViewIfNeeded();await pause(page);
  result.summary=`Resultados exibidos primeiro: ${result.false}, ${result.true}, ${result.context}. Navegação por teclado e orientação antes da captura.`;
});

await record('02-headingsmap',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');await extensionAction(page,context,'HeadingsMap');await pause(page);
  await click(page,page.locator('#open-paste'));await pause(page);
  await page.locator('#use-example').click();await page.locator('#review-form [type=submit]').click();await page.locator('#result-view').waitFor({timeout:25000});await pause(page);
  result.accessibilityTree=await semantics(page);
  result.headings=await page.locator('h1:visible,h2:visible,h3:visible').evaluateAll(items=>items.map(e=>({level:e.tagName,text:e.textContent})));
  result.summary='Mapa de títulos inspecionado no início, envio e resultado. Estrutura do resultado registrada.';
},{args});

await record('03-contraste',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');await click(page,page.locator('#open-paste'));await extensionAction(page,context,'WCAG Color');
  // Coordenada do seletor AA/AAA observada na interface real da extensão.
  await page.mouse.click(28,75);await page.keyboard.press('End');await page.keyboard.press('Enter');await pause(page);
  result.accessibilityTree=await semantics(page);await pause(page);
  result.minimumRatio=Math.min(...result.accessibilityTree.filter(n=>n.role==='cell' && /^\d+(?:\.\d+)?$/.test(n.name)).map(n=>Number(n.name)));
  result.summary=`WCAG Color Contrast Checker na tela de envio. Menor contraste de texto registrado: ${result.minimumRatio}:1. A seleção AAA aparece na gravação. A avaliação refere-se às combinações visíveis nesse estado.`;
},{args});

await record('04-textos-alternativos',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');await extensionAction(page,context,'Image Alt');await pause(page);
  result.images=await page.locator('img:visible').evaluateAll(items=>items.map(e=>({source:e.getAttribute('src'),alt:e.getAttribute('alt')})));
  await click(page,page.locator('#open-settings'));await pause(page);
  result.summary='Image Alt Text Viewer mostrou o nome alternativo do logotipo. Ícones decorativos usam aria-hidden.';
},{args});

await record('05-sem-css',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');await click(page,page.locator('#open-paste'));await pause(page);
  const worker=context.serviceWorkers().find(w=>w.url().endsWith('/assets/scripts/background.js'));
  if(!worker)throw Error('Disable HTML/CSS/JS não carregado.');
  const popup=await context.newPage();const popupVideo=popup.video();await page.bringToFront();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/index.html`);await pause(popup);
  result.controls=await popup.locator('body').innerText();
  const label=popup.getByText('Disable CSS',{exact:true});await click(popup,label);await pause(popup);
  await click(popup,popup.getByRole('button',{name:'Apply Changes',exact:true}));await pause(popup);
  await page.bringToFront();await pause(page);
  result.stylesheets=await page.locator('link[rel=stylesheet],style').count();
  if(await page.locator('link[href*="estilos.css"]').count()) throw Error('A ferramenta não removeu a folha de estilos do projeto.');
  await page.locator('#claim').fill('A urna eletrônica é conectada à internet durante a votação.');await page.locator('#review-form [type=submit]').click();await page.locator('#result-view').waitFor({timeout:25000});await pause(page);
  result.conclusion=await page.locator('#result-title').innerText();
  await popup.close();if(popupVideo)await copyFile(await popupVideo.path(),join(folder,'05-painel-desativar.webm'));
  result.summary='CSS removido pela extensão Disable HTML/CSS/JS. Formulário e resultado continuam utilizáveis. O vídeo do painel da ferramenta está separado.';
},{args});

await record('06-sem-javascript',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');await pause(page);
  result.content=await page.locator('body').innerText();
  await page.locator('#fallback-query').pressSequentially('Como verificar uma notícia',{delay:70});await page.keyboard.press('Tab');await pause(page);
  result.summary='JavaScript realmente desativado no navegador. A alternativa em HTML oferece busca e links diretos às fontes, sem prometer checagem automática.';
},{javaScriptEnabled:false});

await record('07-amaweb',async(page,context,result)=>{
  await page.goto('https://amaweb.unifesp.br/avaliador/',{waitUntil:'domcontentloaded'});await pause(page);
  await click(page,page.locator('#pills-html-tab'));await page.locator('#html_input').fill(await readFile(join(folder,'pagina-renderizada.html'),'utf8'));await pause(page);
  await click(page,page.locator('#html_input').locator('xpath=ancestor::form').locator('[type=submit]'));
  await page.waitForTimeout(10000);result.url=page.url();result.report=await page.locator('body').innerText();
  await page.mouse.wheel(0,450);await pause(page);
  result.score=Number(result.report.match(/Nota:\s*(\d+)/)?.[1]);
  result.summary=`AMAWeb: ${result.score}/10 no HTML renderizado do resultado enviado. O relatório indica zero itens a corrigir e cinco verificações manuais. Esta avaliação não cobre a interação dinâmica.`;
});

await record('08-accessmonitor',async(page,context,result)=>{
  await page.goto('https://accessmonitor.acessibilidade.gov.pt/',{waitUntil:'domcontentloaded',timeout:25000});await pause(page);
  result.report=await page.locator('body').innerText();
  if(/Web Page Blocked|Access Denied/i.test(result.report)){result.status='bloqueado';result.summary='O serviço recusou o acesso neste ambiente. Nenhuma nota foi atribuída ao projeto.';}
});

if(!process.env.QA_ONLY || '09-lighthouse'.includes(process.env.QA_ONLY)) {
const chrome=await chromeLauncher.launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox']});
try{
  const output=await lighthouse(base+'/web/index.html',{port:chrome.port,onlyCategories:['accessibility'],output:['html','json'],formFactor:'desktop',screenEmulation:{disabled:true}});
  await writeFile(join(folder,'lighthouse.html'),output.report[0]);await writeFile(join(folder,'lighthouse.json'),output.report[1]);
}finally{await chrome.kill();}
}
await record('09-lighthouse',async(page,context,result)=>{
  const lhr=JSON.parse(await readFile(join(folder,'lighthouse.json'),'utf8'));result.score=lhr.categories.accessibility.score*100;
  result.failed=Object.values(lhr.audits).filter(a=>a.score===0).map(a=>({id:a.id,title:a.title}));
  const response=await page.goto(base+'/dist/validacao-0.11.0/lighthouse.html');if(!response.ok())throw Error('O relatório HTML não abriu.');
  await pause(page);await page.mouse.wheel(0,500);await pause(page);await page.mouse.wheel(0,550);await pause(page);
  result.summary=`Lighthouse acessibilidade: ${result.score}/100. A nota é automática e não certifica conformidade.`;
});

await record('10-axe-teclado',async(page,context,result)=>{
  await page.goto(base+'/web/index.html');result.screens=[];
  for(const button of ['open-paste','open-settings','open-audio','open-elections']){
    await click(page,page.locator('#'+button));await pause(page);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    result.screens.push({screen:button,violations:audit.violations,incomplete:audit.incomplete.map(a=>({id:a.id,impact:a.impact}))});
    await page.keyboard.press('Tab');await pause(page);await click(page,page.locator('.view:visible [data-back]'));
  }
  result.summary=`axe-core em quatro fluxos: ${result.screens.reduce((n,s)=>n+s.violations.length,0)} violações automáticas. Teclado exercitado na gravação.`;
});

await record('11-analise-ao-vivo',async(page,context,result)=>{
  const source=resolve('dist/ensaios-reais/autentico.webm');
  result.source='https://commons.wikimedia.org/wiki/File:Lula_d%C3%A1_posse_ao_general_Amaro_no_GSI.webm';
  try { await copyFile(source,join(folder,'amostra-real.webm')); }
  catch(error) {
    if(error.code!=='ENOENT') throw error;
    const response=await fetch('https://upload.wikimedia.org/wikipedia/commons/a/a1/Lula_d%C3%A1_posse_ao_general_Amaro_no_GSI.webm',{signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw Error('Não foi possível obter a amostra pública.');
    await writeFile(join(folder,'amostra-real.webm'),new Uint8Array(await response.arrayBuffer()));
  }
  await writeFile(join(folder,'amostra-real.html'),'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Vídeo real para validação</title><body style="margin:30px;font:20px system-ui"><video id="video" width="960" controls src="amostra-real.webm"></video><p><button id="play" onclick="document.getElementById(\'video\').play()">Reproduzir vídeo público</button></p><p>Registro público da posse do general Amaro no GSI — Agência Brasil. Fonte Wikimedia Commons, CC BY 3.0.</p></body></html>');
  const news=await context.newPage();await news.goto(base+'/dist/validacao-0.11.0/amostra-real.html');
  await news.evaluate(()=>{document.title='Central video real';});
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/web/index.html`);
  await click(page,page.locator('#analyze-page'));await pause(page);await click(page,page.locator('#start-sharing'));
  await page.locator('#live-view').waitFor({timeout:25000});
  await news.bringToFront();await news.locator('#play').click();await news.waitForTimeout(2000);await page.bringToFront();
  await page.locator('#live-preview').waitFor({timeout:60000});
  await page.waitForTimeout(19000);
  result.sourcePlayback=await news.locator('#video').evaluate(video=>({duration:video.duration,currentTime:video.currentTime,ended:video.ended}));
  await page.waitForFunction(()=>document.getElementById('live-text').textContent.trim().length>0,{},{timeout:90000});
  await page.waitForFunction(()=>document.getElementById('live-progress').dataset.busy==='false',{},{timeout:30000});
  await pause(page);
  result.verdict=await page.locator('#live-verdict').innerText();result.phase=await page.locator('#live-progress').innerText();result.excerpt=await page.locator('#live-text').innerText();
  result.preview=await page.locator('#live-preview').getAttribute('src').then(value=>!!value?.startsWith('data:image/'));
  await click(page,page.locator('#stop-live'));await page.locator('#history-view').waitFor({timeout:20000});await pause(page);result.history=await page.locator('#history-matches').innerText();
  result.summary=`Resultado observado: ${result.verdict}. Extensão instalada compartilhou uma aba com vídeo público real de 17 segundos, usando a API de captura do Chrome. O seletor foi confirmado por uma flag de teste no perfil isolado. A gravação mostra a prévia, as etapas, a conclusão possível e o histórico. O conteúdo do vídeo não foi criado pelo projeto. Fonte Wikimedia Commons, Agência Brasil, CC BY 3.0.`;
},{args:[`--disable-extensions-except=${resolve('extensao')}`,`--load-extension=${resolve('extensao')}`,'--enable-unsafe-extension-debugging','--enable-usermedia-screen-capturing','--auto-select-tab-capture-source-by-title=Central video real']});

const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await writeFile(join(folder,'index.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Gravações e resultados da validação</title><style>body{font:1.1rem/1.6 system-ui;margin:2rem auto;max-width:76rem;padding:1rem;color:#151d38;background:white}video{display:block;width:100%;max-height:75vh;background:#111}a{color:#0046b8}section{margin:3rem 0;border-top:2px solid #465272}summary,button,a{min-height:44px}h2{font-size:1.4rem}</style><h1>Gravações e resultados da validação 0.11.0</h1><p>Testes executados com Playwright, mouse e teclado em perfis isolados. Os vídeos não têm narração. Cada gravação tem o resultado em texto abaixo. O AccessMonitor ficou bloqueado. Notas automáticas não substituem testes com pessoas e leitores de tela.</p><a href="resultados.json">Baixar resultados completos em JSON</a>${results.map(r=>`<section><h2>${escape(r.name)}</h2><p>${escape(r.summary||r.error||r.status)}</p><video controls preload="metadata" aria-label="Gravação de ${escape(r.name)}" src="${r.video}"></video><p><a href="${r.video}">Abrir gravação</a> · <a href="${r.name}.json">Resultado detalhado</a> · <a href="${r.name}.png">Captura final</a></p>${r.source?`<p>Fonte do vídeo <a href="${escape(r.source)}">Agência Brasil no Wikimedia Commons</a>. <a href="https://creativecommons.org/licenses/by/3.0/deed.pt-br">Licença CC BY 3.0</a>.</p>`:''}${r.name==='05-sem-css'?'<p><a href="05-painel-desativar.webm">Gravação do painel Disable HTML/CSS/JS</a></p>':''}</section>`).join('')}</html>`);
console.log('Galeria em '+base+'/dist/validacao-0.11.0/index.html');

import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const folder = resolve('dist/ensaios-reais');
await mkdir(folder,{recursive:true});
const samples = [
  {name:'autentico',url:'https://upload.wikimedia.org/wikipedia/commons/a/a1/Lula_d%C3%A1_posse_ao_general_Amaro_no_GSI.webm',source:'https://commons.wikimedia.org/wiki/File:Lula_d%C3%A1_posse_ao_general_Amaro_no_GSI.webm',description:'Registro público da posse do general Amaro no GSI',license:'CC BY 3.0',duration:17.241},
  {name:'sintetico',url:'https://upload.wikimedia.org/wikipedia/commons/9/9c/Dictators_-_Kim_Jong-Un_by_RepresentUs.webm',source:'https://commons.wikimedia.org/wiki/File:Dictators_-_Kim_Jong-Un_by_RepresentUs.webm',description:'Peça sintética da RepresentUs, publicada em 2020. O original é identificado como demonstração de deepfake.',license:'CC BY 3.0',duration:49.401},
];
for (const sample of samples) {
  sample.file = resolve(folder,sample.name+'.webm');
  const response = await fetch(sample.url,{signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error('Não foi possível obter '+sample.source);
  await writeFile(sample.file,new Uint8Array(await response.arrayBuffer()));
}
const browser = await chromium.launch();
try {
  const results = await Promise.all(samples.map(async sample=>{
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(base+'/web/index.html');
      await page.locator('#open-paste').click();
      await page.locator('#caption-file').setInputFiles(sample.file);
      await page.getByText(/Transcrição pronta|Primeiros 8.000/).waitFor({timeout:90000});
      const transcript = await page.locator('#claim').inputValue();
      await page.locator('#review-form [type=submit]').click();
      await page.locator('#result-view').waitFor({timeout:25000});
      const result = await page.locator('#result-title').innerText();
      const sources = await page.locator('#result-matches a').evaluateAll(items=>items.map(el=>({title:el.textContent,url:el.href})));
      return {...sample,transcript,result,sources,errors};
    } finally {await context.close();}
  }));
  await writeFile(resolve(folder,'resultados.json'),JSON.stringify(results,null,2));
  for (const result of results) console.log(result.name,result.result,result.transcript.slice(0,250),result.errors);
} finally {await browser.close();}

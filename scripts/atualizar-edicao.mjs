import { writeFile, rename } from 'node:fs/promises';
import { chromium } from 'playwright';
import { electionSources, extractHeadlines } from '../regras-negocio/fontes-eleitorais.js';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const sources = {};
  for (const source of electionSources) {
    const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(source.name + ' respondeu com HTTP ' + response.status);
    const articles = await page.evaluate(extractHeadlines, { source, html: await response.text() });
    if (!articles.length) throw new Error('Nenhuma notícia encontrada em ' + source.name);
    sources[source.id] = articles;
  }
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const content = JSON.stringify({ date, sources }, null, 2);
  const output = new URL('../regras-negocio/edicao-eleitoral.js', import.meta.url);
  const temporary = new URL(output.href + '.' + process.pid + '.tmp');
  await writeFile(temporary, 'export const electionEdition = ' + content + ';\n');
  await rename(temporary, output);
} finally {
  await browser.close();
}

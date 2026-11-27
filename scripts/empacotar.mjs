import { cp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = new URL('../', import.meta.url);
for (const target of ['site', 'extensao']) {
  const output = new URL('dist/' + target + '/', root);
  const parent = resolve(fileURLToPath(new URL('dist/', root)));
  const destination = resolve(fileURLToPath(output));
  if (destination !== resolve(parent, target) || !destination.startsWith(parent + sep)) throw new Error('Destino de build inválido.');
  await rm(destination, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const folder of ['web', 'regras-negocio']) {
    await cp(new URL(folder, root), new URL(folder, output), { recursive: true, force: true });
  }
  if (target === 'extensao') {
    for (const file of ['manifest.json', 'servico.js']) {
      await cp(new URL('extensao/' + file, root), new URL(file, output));
    }
    const endereco = process.env.CENTRAL_PUBLIC_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL) || (process.env.PORT && 'http://127.0.0.1:' + process.env.PORT);
    if (endereco) {
      const url = new URL(endereco);
      const local = url.protocol === 'http:' && url.hostname === '127.0.0.1';
      if ((!local && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Informe a origem HTTPS da Central ou a porta de desenvolvimento local.');
      const path = new URL('manifest.json', output);
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      const origemAnterior = new URL(manifest.homepage_url).origin;
      manifest.homepage_url = url.origin + '/web/index.html';
      manifest.host_permissions = manifest.host_permissions.map(origin => origin === origemAnterior + '/*' ? url.protocol + '//' + url.hostname + '/*' : origin);
      manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(origemAnterior, url.origin);
      await writeFile(path, JSON.stringify(manifest, null, 2));
    }
  }
  else {
    await cp(new URL('demo/', root), new URL('demo/', output), { recursive: true });
    await writeFile(new URL('index.html', output), '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=web/index.html"><title>Central da Informação</title><a href="web/index.html">Abrir Central da Informação</a></html>');
  }
}
const extensionRoot = resolve(fileURLToPath(new URL('extensao/', root)));
for (const folder of ['web', 'regras-negocio']) {
  const destination = resolve(extensionRoot, folder);
  if (!destination.startsWith(extensionRoot + sep)) throw new Error('Destino de extensão inválido.');
  await rm(destination, { recursive: true, force: true });
  await cp(new URL('dist/extensao/' + folder, root), destination, { recursive: true });
}
console.log('Site em dist/site. Extensão pronta para carregar em extensao e dist/extensao.');
const origem = new URL('dist/extensao/', root);
const entradas = Object.create(null);
for (const nome of await readdir(origem, {recursive:true, withFileTypes:true})) {
  if (!nome.isFile()) continue;
  const arquivo = resolve(nome.parentPath, nome.name);
  const relativo = arquivo.slice(fileURLToPath(origem).length).split(sep).join('/');
  entradas[relativo] = await readFile(arquivo);
}
const downloads = new URL('dist/site/downloads/', root);
await mkdir(downloads, {recursive:true});
await writeFile(new URL('central-da-informacao.zip', downloads), zipSync(entradas, {level: 3}));
const demonstracoes = new URL('dist/site/demonstracoes/', root);
await mkdir(demonstracoes, {recursive:true});
for (const nome of ['demonstracao.mp4','demonstracao.vtt','celular-5s.mp4','celular-5s.gif','celular-5s.vtt']) {
  await cp(new URL('docs/gravacoes/' + nome, root), new URL(nome, demonstracoes));
}

import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
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

import { cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
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
    if (process.env.CENTRAL_PUBLIC_ORIGIN) {
      const url = new URL(process.env.CENTRAL_PUBLIC_ORIGIN);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Informe somente a origem HTTPS da Central.');
      const path = new URL('manifest.json', output);
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      manifest.homepage_url = url.origin + '/web/index.html';
      manifest.host_permissions = manifest.host_permissions.map(origin => origin === 'http://127.0.0.1/*' ? url.origin + '/*' : origin);
      manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace('http://127.0.0.1:4177', url.origin);
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

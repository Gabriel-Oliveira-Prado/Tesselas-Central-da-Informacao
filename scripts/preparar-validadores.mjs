import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = resolve('dist/ferramentas');
await mkdir(root,{recursive:true});
const tools = {headingsmap:'flbjommegcjonpdmenkdiocclhjacmbi',contraste:'plnahcmalebffmaghcpcmpaciebdhgdf',desativar:'jcciiagjkpknnjanioihiopnopjakbgo',alternativas:'nhmihbneenlkbjjpbimhegikadfleccd'};
for(const [name,id] of Object.entries(tools)) {
  const folder=resolve(root,name), archive=resolve(root,name+'.zip');
  if(!folder.startsWith(root+sep) || !archive.startsWith(root+sep)) throw Error('Destino inválido.');
  try { await access(resolve(folder,'manifest.json')); }
  catch {
    const url=new URL('https://clients2.google.com/service/update2/crx');
    url.searchParams.set('response','redirect');url.searchParams.set('prodversion','146.0.0.0');url.searchParams.set('acceptformat','crx2,crx3');url.searchParams.set('x','id='+id+'&uc');
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    if(!response.ok) throw Error('Distribuição oficial indisponível para '+name);
    const crx=Buffer.from(await response.arrayBuffer());const index=crx.indexOf(Buffer.from([0x50,0x4b,0x03,0x04]));
    if(index<0)throw Error('Arquivo de extensão inválido.');
    await writeFile(archive,crx.subarray(index));
    const quote=s=>"'"+s.replaceAll("'","''")+"'";
    await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(folder)} -Force`]);
  }
  const manifest=JSON.parse(await readFile(resolve(folder,'manifest.json')));
  console.log('Validador preparado',name,manifest.version);
}

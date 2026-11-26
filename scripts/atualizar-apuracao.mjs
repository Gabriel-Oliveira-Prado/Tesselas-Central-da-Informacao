import { mkdir, writeFile } from 'node:fs/promises';

// Eleições gerais de 2026. Identificadores do arquivo oficial comum/config/ele-c.json.
const pasta = new URL('../regras-negocio/apuracao-2026/', import.meta.url);
const ufs = 'ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to'.split(' ');

async function ler(uf, cargo, eleicao, turnoOpcional = false) {
  const arquivo = uf + '-c' + String(cargo).padStart(4, '0') + '-e' + String(eleicao).padStart(6, '0') + '-u.json';
  const fonte = 'https://resultados.tse.jus.br/oficial/ele2026/' + eleicao + '/dados/' + uf + '/' + arquivo;
  const resposta = await fetch(fonte, { signal: AbortSignal.timeout(30000) });
  if (resposta.status === 404 && turnoOpcional) return null;
  if (!resposta.ok) throw new Error(fonte + ' HTTP ' + resposta.status);
  const dados = await resposta.json();
  const disputa = dados.carg?.find(c => Number(c.cd) === cargo);
  if (!disputa || dados.f !== 'o' || dados.cdabr !== uf || Number(dados.ele) !== eleicao) throw new Error('Arquivo incompatível: ' + fonte);
  const candidatos = disputa.agr.flatMap(grupo => grupo.par.flatMap(partido =>
    partido.cand.map(c => ({ nome: c.nmu || c.nm, partido: partido.sg, situacao: c.st || 'Situação não informada pelo TSE',
      percentual: c.pvap, ordem: Number(c.seq) }))));
  candidatos.sort((a, b) => a.ordem - b.ordem);
  return { cargo: disputa.nmn, turno: dados.t, data: dados.dg, hora: dados.hg, fonte,
    candidatos: candidatos.map(({ ordem, ...campos }) => campos) };
}

await mkdir(pasta, { recursive: true });
for (const uf of ['br', ...ufs]) {
  const disputas = uf === 'br'
    ? [await ler(uf, 1, 6258), await ler(uf, 1, 6257)]
    : [await ler(uf, 3, 6260, true), await ler(uf, 3, 6259), await ler(uf, 5, 6259),
       await ler(uf, 6, 6259), await ler(uf, uf === 'df' ? 8 : 7, 6259)];
  await writeFile(new URL(uf + '.json', pasta), JSON.stringify(disputas.filter(Boolean)) + '\n');
  console.log('Apuração importada:', uf);
}

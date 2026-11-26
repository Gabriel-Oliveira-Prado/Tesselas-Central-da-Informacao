import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateClaim, createSearchLinks, safePreferences } from '../regras-negocio/validacao.js';
import { FACT_CHECKS, findFactChecks, relatedChecks } from '../regras-negocio/checagens.js';
import { publishedChecks } from '../regras-negocio/noticias.js';
import { newsEdition } from '../regras-negocio/edicao-noticias.js';
import { conclusionFor } from '../regras-negocio/veredito.js';

test('consulta reconhece frases completas e mantém fonte e data do resultado', () => {
  const matches = findFactChecks('A URNA ELETRONICA E CONECTADA A INTERNET DURANTE A VOTACAO.');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'urna-internet');
  assert.match(matches[0].url, /^https:\/\/www.justicaeleitoral.jus.br\//);
  assert.equal(matches[0].consultedAt, '2026-11-25');
});

test('tópicos parecidos, negações e afirmações desconhecidas não recebem veredito', () => {
  for (const text of ['A urna eletrônica não é conectada à internet durante a votação.', 'Não é possível votar pela internet nas eleições brasileiras.', 'A urna eletrônica usa internet?', 'A escola do meu bairro mudou de endereço.']) {
    assert.deepEqual(findFactChecks(text), []);
  }
});

test('frases citadas retornam a afirmação da fonte e não um julgamento da página', () => {
  const text = `Exemplo de frase falsa:\n“${FACT_CHECKS[0].claim}”\n${FACT_CHECKS[0].claim}`;
  const matches = findFactChecks(text);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].claim, FACT_CHECKS[0].claim);
  assert.equal(matches[0].overallVerdict, undefined);
  assert.equal(findFactChecks(FACT_CHECKS[2].claim)[0].finding, 'Confirmado pela fonte');
});

test('perguntas, negações e vídeos de outras datas preservam o sentido da fonte', () => {
  const conditional=conclusionFor({exact:findFactChecks('Pode votar depois das 17?')});
  assert.equal(conditional.label,'Não verificado');
  assert.match(conditional.explanation,/depende das condições/);
  assert.match(conditional.explanation,/fila/);
  assert.equal(findFactChecks('Dá para votar pelo celular se estiver chovendo?')[0].kind, 'false');
  assert.equal(findFactChecks('O e-Título com foto serve como identificação para votar.')[0].kind, 'true');
  assert.equal(findFactChecks('O vídeo dos peritos federais comprova fraude nas eleições de 2022.')[0].kind, 'context');
  for (const phrase of ['É falso que dá para votar pelo celular se estiver chovendo.', 'O vídeo dos peritos federais comprova fraude nas eleições de 2026.', 'Será que existe voto online quando chove?']) {
    assert.deepEqual(findFactChecks(phrase), []);
    assert.ok(relatedChecks(phrase).length || phrase.includes('2026'));
  }
});

test('não aceita conteúdo vazio ou acima do limite', () => {
  for (const value of ['', ' \n\t ', null, undefined, 'a'.repeat(8001)]) {
    assert.equal(validateClaim(value).valid, false);
  }
  assert.deepEqual(validateClaim('  Uma afirmação.  '), { valid: true, text: 'Uma afirmação.' });
});

test('manchetes completas de vídeos checados preservam a conclusão publicada', () => {
  const fake = newsEdition.find(row => row.title.startsWith('É #FAKE que vídeo de descarte de cebolas'));
  const fact = newsEdition.find(row => row.title.startsWith('É #FATO: Vídeo mostra resgate de onça'));
  assert.equal(publishedChecks(fake.title)[0].kind, 'false');
  assert.equal(publishedChecks(fact.title)[0].kind, 'true');
  assert.deepEqual(publishedChecks('Não é verdade que ' + fake.title), []);
});

test('buscas preservam a consulta como dado, inclusive caracteres especiais', () => {
  const query = 'uma notícia & <script> + "outro contexto" #?';
  const links = createSearchLinks(query);
  assert.equal(links.length, 3);
  for (const link of links) {
    const url = new URL(link.href);
    assert.equal(url.origin, 'https://www.google.com');
    assert.ok(url.searchParams.get('q').endsWith(query));
  }
  assert.deepEqual(createSearchLinks(' '), []);
  assert.deepEqual(createSearchLinks('a'.repeat(301)), []);
});

test('somente preferências de leitura válidas são persistidas', () => {
  assert.deepEqual(safePreferences({ fontSize: '200', highContrast: true, claim: 'dado pessoal' }), { fontSize: '200', highContrast: true, wideSpacing: false });
  assert.deepEqual(safePreferences({ fontSize: '999', highContrast: 'true' }), { fontSize: '100', highContrast: true, wideSpacing: false });
});

test('conexões permanentes limitadas às origens de pesquisa declaradas', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extensao/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.host_permissions.includes('https://www.bing.com/*'));
  assert.ok(manifest.host_permissions.includes('https://news.google.com/*'));
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage', 'sidePanel'].sort());
  assert.ok(manifest.content_security_policy.extension_pages.includes("connect-src 'self'"));
  for (const icon of Object.values(manifest.icons)) {
    const content = await readFile(new URL(`../extensao/${icon}`, import.meta.url));
    assert.equal(content.subarray(1, 4).toString(), 'PNG');
  }
});

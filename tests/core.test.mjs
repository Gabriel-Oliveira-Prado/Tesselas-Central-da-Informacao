import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateClaim, createSearchLinks, safePreferences } from '../regras-negocio/validacao.js';
import { FACT_CHECKS, findFactChecks, relatedChecks } from '../regras-negocio/checagens.js';
import { publishedChecks } from '../regras-negocio/noticias.js';
import { newsEdition } from '../regras-negocio/edicao-noticias.js';
import { conclusionFor } from '../regras-negocio/veredito.js';
import { evidenceFor } from '../regras-negocio/pesquisa.js';
import { searchPlan } from '../regras-negocio/fontes-pesquisa.js';

test('contexto e respostas anteriores usam vereditos binários e preservam a explicação', () => {
  for (const [tipo, esperado] of [['context','Falso'], ['answer','Verdadeiro'], ['conditional','Verdadeiro']]) {
    const registro = { kind:tipo, explanation:'A data confirmada na fonte é 2025.' };
    const resultado = conclusionFor({ exact:[registro] });
    assert.equal(resultado.label, esperado);
    assert.equal(resultado.explanation, registro.explanation);
  }
  assert.equal(conclusionFor({ exact:[{kind:'context'}, {kind:'false'}] }).label, 'Falso');
  assert.equal(conclusionFor({ exact:[{kind:'answer'}, {kind:'true'}] }).label, 'Verdadeiro');
  for (const exact of [[], [{kind:'true'}, {kind:'false'}]]) {
    assert.equal(conclusionFor({exact}).kind, 'unverified');
  }
});

test('horário de chegada, fila e números de candidatura têm sentidos distintos', () => {
  for (const pergunta of ['pode votar de 20horas da noite?', 'Posso votar às oito da noite?', 'Dá pra votar às 20:30?']) {
    const resposta = conclusionFor(evidenceFor(pergunta));
    assert.equal(resposta.label, 'Falso');
    assert.match(resposta.explanation, /fila já estará fechada/);
    assert.match(resposta.explanation, /17h recebe senha/);
    assert.match(searchPlan(pergunta).sources[0].name, /Horário/);
  }
  assert.match(conclusionFor(evidenceFor('Posso votar às 8h?')).explanation, /Sim,/);
  for (const pergunta of ['Posso votar 13?', 'Posso votar às 20h em Portugal?', 'Tenho 20 anos, posso votar?']) {
    assert.ok(!evidenceFor(pergunta).exact.some(item => item.id.startsWith('horario-votacao-')));
  }
});
import { trechoDaTela } from '../regras-negocio/trecho-da-tela.js';

test('manchete reconhecida mantém o local e descarta controles de autenticação', () => {
  const manchete = 'Flávio Bolsonaro perde para Lula na seção eleitoral em que vota no Rio de Janeiro';
  assert.equal(trechoDaTela(manchete + ' [ entrar) Cadastre-se Seguir comentários e outras notícias'), manchete);
  assert.equal(trechoDaTela(manchete.replace('Rio de Janeiro', 'São Paulo')), manchete.replace('Rio de Janeiro', 'São Paulo'));
});

test('perguntas por idade preservam número, obrigação e condições da consulta', () => {
  for (const [texto, tipo] of [
    ['votar com 16 anos e so se quiser?', 'true'],
    ['Quem tem dezessete anos é obrigado a votar?', 'false'],
    ['Qual a idade mínima para votar?', 'true'],
  ]) {
    const conclusao = conclusionFor(evidenceFor(texto));
    assert.equal(conclusao.kind, tipo);
    assert.match(conclusao.explanation, /16/);
  }
  for (const texto of ['Com 16 anos posso votar em Portugal?', 'Tenho 16 anos, posso votar sem título?', 'Com 18 anos votar é opcional?']) {
    assert.deepEqual(evidenceFor(texto).exact, []);
  }
  const plano = searchPlan('Qual o prazo para tirar o título aos 16 anos?');
  assert.match(plano.sources[0].url, /manual-do-eleitor-jovens/);
  assert.ok(plano.queries.some(q => /alistamento.*16/.test(q)));
});

test('consulta reconhece frases completas e mantém fonte e data do resultado', () => {
  const matches = findFactChecks('A URNA ELETRONICA E CONECTADA A INTERNET DURANTE A VOTACAO.');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'urna-internet');
  assert.match(matches[0].url, /^https:\/\/www.justicaeleitoral.jus.br\//);
  assert.equal(matches[0].consultedAt, '2026-11-25');
  assert.equal(findFactChecks('é proibida de entrar na cabine de votação com o celular')[0].kind, 'true');
  assert.deepEqual(findFactChecks('não é proibida de entrar na cabine de votação com o celular'), []);
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
  assert.equal(conditional.label,'Verdadeiro');
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

test('ano do registro em checagem publicada vale para texto, OCR e transcrição', () => {
  const fato = 'Vídeo mostra resgate de onça no rio Negro, em Manaus, em 2025';
  for (const texto of [
    fato.replace('2025', '2020'),
    'Em 2020, o vídeo mostra resgate de onça no rio Negro, em Manaus.',
    fato.replace('Negro, em', 'Negro,\nem').replace('2025', 'dois mil e vinte'),
  ]) {
    const [registro] = publishedChecks(texto);
    assert.equal(registro.kind, 'context');
    assert.match(registro.explanation, /2020.*2025/);
    assert.equal(registro.claim, fato.replace('2025', '2020'));
  }
  assert.equal(publishedChecks(fato)[0].kind, 'true');
  for (const texto of [
    'Não é verdade que ' + fato.replace('2025', '2020'),
    fato.replace('Manaus', 'Recife').replace('2025', '2020'),
    fato.replace('2025', '2020 ou 2021'),
    fato + '. ' + fato.replace('2025', '2020'),
  ]) assert.deepEqual(publishedChecks(texto), []);
});

test('compara também manchetes novas e exige confirmação expressa do ano do evento', () => {
  const alegacao = 'Foto mostra a reabertura do museu em 2018';
  const reportagem = { title: 'É #FATO: ' + alegacao, url: 'https://g1.globo.com/fato-ou-fake/teste-museu', date: '2024-01-01' };
  const alterada = alegacao.replace('2018', '2015');
  const [prova] = publishedChecks(alterada, reportagem, false);
  assert.equal(prova.kind, 'context');
  assert.match(prova.explanation, /2015.*2018/);
  for (const title of [reportagem.title.replace('#FATO', '#FAKE'), reportagem.title.replace(' em 2018', ''), alegacao]) {
    assert.deepEqual(publishedChecks(alterada, { ...reportagem, title }, false), []);
  }
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
  assert.deepEqual(safePreferences({ fontSize: '200', highContrast: true, claim: 'dado pessoal' }), { fontSize: '200', highContrast: true, textSpacing: 'normal' });
  assert.deepEqual(safePreferences({ fontSize: '999', highContrast: 'true' }), { fontSize: '100', highContrast: true, textSpacing: 'normal' });
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

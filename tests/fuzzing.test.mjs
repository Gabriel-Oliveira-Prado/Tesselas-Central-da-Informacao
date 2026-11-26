import test from 'node:test';
import assert from 'node:assert/strict';
import { findFactChecks, relatedChecks, FACT_CHECKS } from '../regras-negocio/checagens.js';
import { articleUrl, contextFor, publishedChecks } from '../regras-negocio/noticias.js';
import { validateClaim, createSearchLinks, safePreferences } from '../regras-negocio/validacao.js';

test('fuzzing determinístico de entradas, URLs e preferências', () => {
  let seed = 20261126;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const pieces = ['\u0000', 'é', '\ud800', '🗳️', '<script>', '\n', 'http://', '%2e%2e', '?!', '"', 'não ', '17h', 'celular', 'urnas', ' '];
  for (let i = 0; i < 4000; i++) {
    const text = Array.from({ length: next() % 60 }, () => pieces[next() % pieces.length]).join('');
    const results = findFactChecks(text);
    assert.ok(results.every(row => FACT_CHECKS.some(item => item.id === row.id)));
    assert.ok(relatedChecks(text).length <= 2);
    assert.ok(contextFor(text).length <= 2);
    assert.ok(publishedChecks(text).length <= 50);
    assert.equal(typeof validateClaim(text).valid, 'boolean');
    for (const link of createSearchLinks(text)) {
      assert.equal(new URL(link.href).origin, 'https://www.google.com');
      assert.ok(new URL(link.href).searchParams.get('q').endsWith(text.trim().toWellFormed()));
    }
    assert.ok(['100', '125', '150', '200'].includes(safePreferences({ fontSize: text }).fontSize));
    const url = articleUrl(text);
    if (url) assert.equal(url.protocol, 'https:');
  }
  for (const value of [null, undefined, {}, [], 0, true]) {
    assert.deepEqual(findFactChecks(value), []);
    assert.deepEqual(contextFor(value), []);
    assert.equal(typeof safePreferences(value).highContrast, 'boolean');
  }
  for (const attack of ['javascript:alert(1)', 'https://g1.globo.com.evil.example/', 'https://g1.globo.com@evil.example/', 'http://127.0.0.1/', 'https://g1.globo.com:8443/', 'file:///C:/Users/']) assert.equal(articleUrl(attack), undefined);
});

test('paráfrases com negação não recebem o veredito da afirmação oposta', () => {
  for (const item of FACT_CHECKS) {
    for (const prefix of ['É falso que ', 'Não é verdade que ', 'Não acredito que ']) {
      assert.deepEqual(findFactChecks(prefix + item.claim.toLowerCase()), []);
    }
  }
  assert.equal(findFactChecks('Pode votar depois das 17?')[0].id, 'fila-17h');
});

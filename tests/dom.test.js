import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from './helpers/dom.js';
setupDOM();
const { h, safeUrl, formatDate } = await import('../js/dom.js');

test('h() n\'interprète jamais le HTML (XSS)', () => {
  const el = h('p', null, '<img src=x onerror=alert(1)>');
  assert.equal(el.querySelector('img'), null);
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>');
});

test('safeUrl n\'accepte que http(s)', () => {
  assert.equal(safeUrl('https://exemple.org/a'), 'https://exemple.org/a');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,x'), null);
  assert.equal(safeUrl('pas une url'), null);
});

test('formatDate gère les valeurs vides ou invalides', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('nimporte'), '');
  assert.ok(formatDate('2026-10-17').length > 0);
});

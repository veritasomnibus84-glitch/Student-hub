import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../scripts/fetch-videos.mjs';

const xml = `<feed><entry><yt:videoId>abcdefghijk</yt:videoId><title>Maths &amp; Physique</title><published>2026-10-10T10:00:00+00:00</published></entry>
<entry><yt:videoId>ZZZZZZZZZZZ</yt:videoId><title>Plus récente</title><published>2026-10-12T10:00:00+00:00</published></entry>
<entry><yt:videoId>court</yt:videoId><title>Id invalide</title></entry></feed>`;

test('parseFeed lit, décode, trie par date et ignore les ids invalides', () => {
  const v = parseFeed(xml, 'Chaîne');
  assert.equal(v.length, 2);
  assert.equal(v[0].id, 'ZZZZZZZZZZZ');
  assert.equal(v[1].title, 'Maths & Physique');
  assert.equal(v[1].channel, 'Chaîne');
});

test('parseFeed respecte la limite et un flux vide', () => {
  assert.equal(parseFeed(xml, 'C', 1).length, 1);
  assert.deepEqual(parseFeed('<feed></feed>', 'C'), []);
});

// TEMPORARY: one CI run against the real services, removed in the next commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ol from '../src/openlibrary.ts';
import * as gb from '../src/google.ts';

const get = async (url: string) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'book-notes-ci-check' } });
  console.log('LIVE', r.status, url);
  return r.json();
};

test('live Open Library search', async () => {
  const books = ol.parseSearch(await get(ol.searchUrl('dune frank herbert', 3)));
  console.log('LIVE OL search', JSON.stringify(books[0]));
  assert.ok(books.length > 0 && books[0].title && books[0].author);
});
test('live Open Library ISBN', async () => {
  const books = ol.parseIsbnData(await get(ol.isbnUrl('9780441172719')), '9780441172719');
  console.log('LIVE OL isbn', JSON.stringify(books[0]));
  assert.ok(books.length === 1 && books[0].title);
  const key = books[0].workKey;
  console.log('LIVE OL workKey', key);
});
test('live Open Library work description', async () => {
  const s = ol.parseSearch(await get(ol.searchUrl('dune frank herbert', 1)));
  const d = ol.parseWorkDescription(await get(ol.workUrl(s[0].workKey!)));
  console.log('LIVE OL desc', d.slice(0, 200));
  assert.ok(d.length > 0);
});
test('live Google search and ISBN', async () => {
  const s = gb.parseSearch(await get(gb.searchUrl('dune frank herbert', {}, 3)));
  console.log('LIVE GB search', JSON.stringify(s[0]));
  const i = gb.parseSearch(await get(gb.isbnUrl('9780441172719')));
  console.log('LIVE GB isbn', JSON.stringify(i[0]));
  assert.ok(s.length > 0 || i.length > 0);
});

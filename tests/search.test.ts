import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDetails, searchBooks, SearchError } from '../src/search.ts';
import type { HttpGet, SearchOptions } from '../src/search.ts';
import { fixture, sampleBook } from './helpers.ts';

const ol: SearchOptions = { provider: 'openlibrary', googleApiKey: '', googleLanguage: '' };
const g: SearchOptions = { provider: 'google', googleApiKey: 'KEY', googleLanguage: 'en' };

function stub(routes: Record<string, [number, unknown]>): { get: HttpGet; urls: string[] } {
  const urls: string[] = [];
  const get: HttpGet = async (url) => {
    urls.push(url);
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    if (!hit) throw new Error(`unexpected request ${url}`);
    return { status: hit[1][0], json: hit[1][1] };
  };
  return { get, urls };
}

test('a title goes to the Open Library search', async () => {
  const { get, urls } = stub({ 'https://openlibrary.org/search.json': [200, fixture('openlibrary-search.json')] });
  const books = await searchBooks('the hobbit', ol, get);
  assert.equal(books.length, 2);
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes('q=the%20hobbit'));
});

test('a hyphenated ISBN goes to the ISBN endpoint, normalised', async () => {
  const { get, urls } = stub({ 'https://openlibrary.org/api/books': [200, fixture('openlibrary-isbn.json')] });
  const books = await searchBooks('978-0-547-92822-7', ol, get);
  assert.equal(books[0].title, 'The Hobbit');
  assert.deepEqual(urls, ['https://openlibrary.org/api/books?bibkeys=ISBN:9780547928227&format=json&jscmd=data']);
});

test('an ISBN unknown to the edition endpoint falls back to the search', async () => {
  const { get, urls } = stub({
    'https://openlibrary.org/api/books': [200, {}],
    'https://openlibrary.org/search.json': [200, fixture('openlibrary-search.json')],
  });
  const books = await searchBooks('054792822X', ol, get);
  assert.equal(books.length, 2);
  assert.equal(urls.length, 2);
  assert.ok(urls[1].includes('q=054792822X'));
});

test('a number that is not a valid ISBN is searched as text', async () => {
  const { get, urls } = stub({ 'https://openlibrary.org/search.json': [200, { docs: [] }] });
  assert.deepEqual(await searchBooks('1984', ol, get), []);
  assert.ok(urls[0].includes('search.json'));
});

test('Google: title and ISBN queries carry the key and language', async () => {
  const { get, urls } = stub({ 'https://www.googleapis.com/books/v1/volumes': [200, fixture('google-search.json')] });
  assert.equal((await searchBooks('flow', g, get)).length, 2);
  await searchBooks('9780061876721', g, get);
  assert.ok(urls[0].includes('q=flow') && urls[0].includes('key=KEY') && urls[0].includes('langRestrict=en'));
  assert.ok(urls[1].includes('q=isbn%3A9780061876721'));
});

test('Google without a key still queries and omits the parameter', async () => {
  const { get, urls } = stub({ 'https://www.googleapis.com/books/v1/volumes': [200, fixture('google-empty.json')] });
  assert.deepEqual(await searchBooks('flow', { ...g, googleApiKey: '', googleLanguage: '' }, get), []);
  assert.ok(!urls[0].includes('key=') && !urls[0].includes('langRestrict'));
});

test('empty query makes no request', async () => {
  const { get, urls } = stub({});
  assert.deepEqual(await searchBooks('   ', ol, get), []);
  assert.equal(urls.length, 0);
});

test('HTTP errors become readable SearchErrors', async () => {
  const quota = stub({ 'https://www.googleapis.com': [429, fixture('google-quota.json')] });
  await assert.rejects(searchBooks('x', g, quota.get), (e: Error) => e instanceof SearchError && /quota/i.test(e.message));
  const bad = stub({ 'https://www.googleapis.com': [400, fixture('google-quota.json')] });
  await assert.rejects(searchBooks('x', g, bad.get), /Google Books answered 400: Quota exceeded/);
  const down = stub({ 'https://openlibrary.org': [503, null] });
  await assert.rejects(searchBooks('x', ol, down.get), /Open Library answered 503/);
});

test('addDetails fetches the work description once and only when needed', async () => {
  const { get, urls } = stub({ 'https://openlibrary.org/works/': [200, fixture('openlibrary-work.json')] });
  const book = sampleBook({ description: '', workKey: '/works/OL262758W' });
  const full = await addDetails(book, ol, get);
  assert.match(full.description, /^In a hole in the ground/);
  assert.equal(urls.length, 1);
  assert.equal((await addDetails(full, ol, get)).description, full.description);
  assert.equal(urls.length, 1, 'already has one');
  await addDetails(book, g, get);
  await addDetails({ ...book, workKey: undefined }, ol, get);
  assert.equal(urls.length, 1, 'not for Google, not without a key');
});

test('addDetails keeps the book when the request fails', async () => {
  const book = sampleBook({ description: '', workKey: '/works/OL1W' });
  assert.equal((await addDetails(book, ol, async () => { throw new Error('offline'); })).description, '');
  assert.equal((await addDetails(book, ol, async () => ({ status: 404, json: null }))).description, '');
});

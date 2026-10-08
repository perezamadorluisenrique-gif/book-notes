import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanList, htmlToText } from '../src/book.ts';
import * as google from '../src/google.ts';
import * as ol from '../src/openlibrary.ts';
import { fixture } from './helpers.ts';

test('Open Library search: fields of a full record', () => {
  const [hobbit] = ol.parseSearch(fixture('openlibrary-search.json'));
  assert.equal(hobbit.title, 'The Hobbit');
  assert.deepEqual(hobbit.authors, ['J.R.R. Tolkien']);
  assert.equal(hobbit.author, 'J.R.R. Tolkien');
  assert.equal(hobbit.publisher, 'Houghton Mifflin');
  assert.equal(hobbit.publishDate, '1937');
  assert.equal(hobbit.totalPage, 366);
  assert.equal(hobbit.isbn10, '0618260307');
  assert.equal(hobbit.isbn13, '9780618260300');
  assert.equal(hobbit.link, 'https://openlibrary.org/works/OL262758W');
  assert.equal(hobbit.workKey, '/works/OL262758W');
  assert.equal(hobbit.coverUrl, 'https://covers.openlibrary.org/b/id/14627509-M.jpg');
  assert.equal(hobbit.coverSmallUrl, 'https://covers.openlibrary.org/b/id/14627509-S.jpg');
  assert.equal(hobbit.coverLargeUrl, 'https://covers.openlibrary.org/b/id/14627509-L.jpg');
  assert.equal(hobbit.categories.length, 5, 'subjects are capped');
  assert.equal(hobbit.category, 'Fantasy, Dragons, Hobbits, Middle Earth (Imaginary place), Fiction');
});

test('Open Library search: sparse record, repeated authors, record without title dropped', () => {
  const books = ol.parseSearch(fixture('openlibrary-search.json'));
  assert.equal(books.length, 2);
  const guide = books[1];
  assert.equal(guide.title, 'Notes on The Hobbit');
  assert.equal(guide.subtitle, "A reader's guide");
  assert.deepEqual(guide.authors, ['Ada Reader', 'Ben Critic']);
  assert.equal(guide.author, 'Ada Reader, Ben Critic');
  assert.equal(guide.coverUrl, '');
  assert.equal(guide.totalPage, '');
  assert.equal(guide.publishDate, '');
  assert.equal(guide.isbn13, '');
});

test('Open Library search: junk input gives an empty list', () => {
  assert.deepEqual(ol.parseSearch(null), []);
  assert.deepEqual(ol.parseSearch({}), []);
  assert.deepEqual(ol.parseSearch({ docs: 'x' }), []);
  assert.deepEqual(ol.parseSearch({ docs: [null, 3, {}] }), []);
});

test('Open Library ISBN endpoint', () => {
  const [book] = ol.parseIsbnData(fixture('openlibrary-isbn.json'), '9780547928227');
  assert.equal(book.title, 'The Hobbit');
  assert.equal(book.subtitle, 'or There and Back Again');
  assert.equal(book.author, 'J.R.R. Tolkien');
  assert.equal(book.publisher, 'Houghton Mifflin Harcourt');
  assert.equal(book.publishDate, 'September 18, 2012');
  assert.equal(book.totalPage, 300);
  assert.equal(book.isbn10, '054792822X');
  assert.equal(book.isbn13, '9780547928227');
  assert.deepEqual(book.categories, ['Fantasy fiction', 'Dragons']);
  assert.equal(book.coverUrl, 'https://covers.openlibrary.org/b/id/8406786-M.jpg');
  assert.equal(book.coverLargeUrl, 'https://covers.openlibrary.org/b/id/8406786-L.jpg');
  assert.equal(book.link, 'https://openlibrary.org/books/OL25392594M/The_Hobbit');
  assert.deepEqual(ol.parseIsbnData({}, '9780547928227'), [], 'unknown ISBN');
  assert.deepEqual(ol.parseIsbnData(null, '1'), []);
});

test('Open Library work description: object form, sources cut off', () => {
  assert.equal(
    ol.parseWorkDescription(fixture('openlibrary-work.json')),
    'In a hole in the ground there lived a hobbit.\n\nBilbo Baggins is swept into an adventure.',
  );
  assert.equal(ol.parseWorkDescription({ description: 'Plain.' }), 'Plain.');
  assert.equal(ol.parseWorkDescription({}), '');
  assert.equal(ol.parseWorkDescription(null), '');
});

test('Open Library URLs are encoded', () => {
  const url = ol.searchUrl('war & peace', 5);
  assert.ok(url.startsWith('https://openlibrary.org/search.json?q=war%20%26%20peace&limit=5&fields='));
  assert.equal(ol.isbnUrl('9780547928227'), 'https://openlibrary.org/api/books?bibkeys=ISBN:9780547928227&format=json&jscmd=data');
  assert.equal(ol.workUrl('/works/OL1W'), 'https://openlibrary.org/works/OL1W.json');
});

test('Google search: full record', () => {
  const [flow] = google.parseSearch(fixture('google-search.json'));
  assert.equal(flow.title, 'Flow');
  assert.equal(flow.subtitle, 'The Psychology of Optimal Experience');
  assert.equal(flow.author, 'Mihaly Csikszentmihalyi');
  assert.equal(flow.publisher, 'Harper Collins');
  assert.equal(flow.publishDate, '2009-10-13');
  assert.equal(flow.totalPage, 336);
  assert.equal(flow.isbn10, '0061876720');
  assert.equal(flow.isbn13, '9780061876721');
  assert.equal(flow.category, 'Psychology / Creative Ability, Psychology / Applied Psychology');
  assert.ok(flow.coverUrl.startsWith('https://books.google.com/'), 'http is upgraded');
  assert.ok(flow.coverUrl.includes('zoom=1'));
  assert.ok(flow.coverLargeUrl.includes('zoom=0'));
  assert.ok(flow.coverSmallUrl.includes('zoom=5'));
  assert.equal(flow.link, 'https://books.google.com/books/about/Flow.html?hl=&id=pD6arNyKyi8C');
  assert.equal(flow.description, 'The bestselling classic.\n\nLegendary psychologist Mihaly\'s "optimal experience".\nSecond line & more.');
});

test('Google search: bare record falls back to infoLink and has no ISBN', () => {
  const books = google.parseSearch(fixture('google-search.json'));
  assert.equal(books.length, 2);
  assert.equal(books[1].link, 'https://books.google.com/books?id=bare');
  assert.equal(books[1].isbn10, '');
  assert.equal(books[1].coverUrl, '');
  assert.equal(books[1].coverLargeUrl, '');
  assert.equal(books[1].totalPage, '');
});

test('Google: empty result, error body, junk', () => {
  assert.deepEqual(google.parseSearch(fixture('google-empty.json')), []);
  assert.deepEqual(google.parseSearch(null), []);
  assert.deepEqual(google.parseSearch({ items: [{}, { volumeInfo: {} }] }), []);
  assert.match(google.errorMessage(fixture('google-quota.json')) ?? '', /Quota exceeded/);
  assert.equal(google.errorMessage({}), null);
});

test('Google URLs: key and language only when set', () => {
  assert.equal(google.searchUrl(' dune ', {}, 10), 'https://www.googleapis.com/books/v1/volumes?q=dune&maxResults=10&printType=books');
  const url = google.searchUrl('dune', { apiKey: ' K&1 ', language: 'es' });
  assert.ok(url.includes('&langRestrict=es'));
  assert.ok(url.endsWith('&key=K%261'));
  assert.ok(google.isbnUrl('9780061876721').includes('q=isbn%3A9780061876721'));
});

test('htmlToText and cleanList', () => {
  assert.equal(htmlToText('<b>a</b> &lt;b&gt; &#x41;&#66; &unknown; <br/>x'), 'a <b> AB &unknown;\nx');
  assert.equal(htmlToText(''), '');
  assert.deepEqual(cleanList([' a ', 'a', '', 3, 'b']), ['a', 'b']);
  assert.deepEqual(cleanList('x'), []);
});

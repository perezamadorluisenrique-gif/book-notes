import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isValidIsbn10, isValidIsbn13, normaliseIsbn, parseIsbn, pickIsbns, toIsbn13 } from '../src/isbn.ts';

test('normalise drops hyphens, spaces and the ISBN prefix', () => {
  assert.equal(normaliseIsbn('978-0-547-92822-7'), '9780547928227');
  assert.equal(normaliseIsbn(' ISBN 0-547-92822-X '), '054792822X');
  assert.equal(normaliseIsbn('ISBN-13: 978 0 547 92822 7'), '9780547928227');
  assert.equal(normaliseIsbn('080442957x'), '080442957X');
});

test('ISBN-10 checksum, including the X digit', () => {
  assert.ok(isValidIsbn10('054792822X'));
  assert.ok(isValidIsbn10('080442957X'));
  assert.ok(!isValidIsbn10('0547928225'));
  assert.ok(!isValidIsbn10('054792822'));
  assert.ok(!isValidIsbn10('X547928224'));
});

test('ISBN-13 checksum and prefix', () => {
  assert.ok(isValidIsbn13('9780547928227'));
  assert.ok(isValidIsbn13('9780061876721'));
  assert.ok(!isValidIsbn13('9780547928228'));
  assert.ok(!isValidIsbn13('9770547928227'));
  assert.ok(!isValidIsbn13('978054792822'));
});

test('parseIsbn accepts either length with punctuation and rejects titles', () => {
  assert.equal(parseIsbn('978-0-547-92822-7'), '9780547928227');
  assert.equal(parseIsbn('0-547-92822-X'), '054792822X');
  assert.equal(parseIsbn('the hobbit'), null);
  assert.equal(parseIsbn('1984'), null);
  assert.equal(parseIsbn('9780547928228'), null);
  assert.equal(parseIsbn(''), null);
});

test('toIsbn13 converts an ISBN-10', () => {
  assert.equal(toIsbn13('054792822X'), '9780547928227');
  assert.equal(toIsbn13('0061876720'), '9780061876721');
  assert.equal(toIsbn13('0547928225'), null);
});

test('pickIsbns takes the first valid of each kind', () => {
  assert.deepEqual(pickIsbns(['junk', '0547928225', '054792822X', '9780547928227', '9780061876721']), {
    isbn10: '054792822X',
    isbn13: '9780547928227',
  });
  assert.deepEqual(pickIsbns([]), { isbn10: '', isbn13: '' });
});

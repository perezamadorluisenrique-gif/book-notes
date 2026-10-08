import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyBook } from '../src/book.ts';
import { bookProperties, defaultNote, isEmptyValue, planMerge, toFrontmatter } from '../src/frontmatter.ts';
import { sampleBook } from './helpers.ts';

test('bookProperties lists the properties in order and skips empty ones', () => {
  const props = bookProperties(sampleBook());
  assert.deepEqual(Object.keys(props), [
    'title', 'subtitle', 'author', 'publisher', 'publishDate', 'totalPage', 'isbn10', 'isbn13', 'categories', 'cover', 'link',
  ]);
  assert.deepEqual(props.author, ['Mihaly Csikszentmihalyi']);
  assert.equal(props.totalPage, 336);
  assert.deepEqual(Object.keys(bookProperties({ ...emptyBook(), title: 'T' })), ['title']);
});

test('the local cover wins over the web cover', () => {
  assert.equal(bookProperties(sampleBook({ localCoverImage: 'C/f.jpg' })).cover, 'C/f.jpg');
  assert.equal(bookProperties(sampleBook()).cover, 'https://example.org/c.jpg');
});

test('isEmptyValue', () => {
  for (const v of [null, undefined, '', '  ', [], [''], [null, ' ']]) assert.ok(isEmptyValue(v), JSON.stringify(v));
  for (const v of [0, false, 'x', ['x'], 5]) assert.ok(!isEmptyValue(v), JSON.stringify(v));
});

test('merge fills missing and empty values and keeps the rest', () => {
  const existing = { title: 'My own title', author: '', publisher: null, tags: ['book'], totalPage: 0 };
  const { set, skipped } = planMerge(existing, bookProperties(sampleBook()), false);
  assert.deepEqual(Object.keys(set).sort(), [
    'author', 'categories', 'cover', 'isbn10', 'isbn13', 'link', 'publishDate', 'publisher', 'subtitle',
  ]);
  assert.deepEqual(skipped.sort(), ['title', 'totalPage']);
  assert.equal(set.title, undefined);
});

test('merge never touches a falsy-but-real value such as 0 or false', () => {
  const { set } = planMerge({ totalPage: 0 }, { totalPage: 336 }, false);
  assert.deepEqual(set, {});
});

test('merge treats a key in another case as present and reuses its spelling', () => {
  const kept = planMerge({ Title: 'Mine', Author: '' }, { title: 'Flow', author: ['A'] }, false);
  assert.deepEqual(kept.set, { Author: ['A'] });
  assert.deepEqual(kept.skipped, ['title']);
});

test('merge with overwrite replaces differing values only', () => {
  const { set, skipped } = planMerge(
    { title: 'Old', publisher: 'Same', author: ['A'] },
    { title: 'New', publisher: 'Same', author: ['B'], isbn13: '9' },
    true,
  );
  assert.deepEqual(set, { title: 'New', author: ['B'], isbn13: '9' });
  assert.deepEqual(skipped, []);
});

test('merge of nothing changes nothing', () => {
  assert.deepEqual(planMerge({ a: 1 }, {}, true).set, {});
});

test('toFrontmatter quotes strings, lists block-style, numbers bare', () => {
  const yaml = toFrontmatter({ title: 'A: "quoted" #1', author: ['X', 'Y: Z'], totalPage: 12, link: 'https://a.b/c?d=1' });
  assert.equal(
    yaml,
    ['---', 'title: "A: \\"quoted\\" #1"', 'author:', '  - "X"', '  - "Y: Z"', 'totalPage: 12', 'link: "https://a.b/c?d=1"', '---'].join('\n'),
  );
});

test('toFrontmatter escapes newlines so a value cannot break the block', () => {
  const yaml = toFrontmatter({ title: 'a\n---\nb' });
  assert.equal(yaml.split('\n').length, 3);
});

test('defaultNote: properties, heading, cover, description', () => {
  const note = defaultNote(sampleBook());
  assert.ok(note.startsWith('---\ntitle: "Flow"\n'));
  assert.ok(note.includes('\n---\n\n# Flow\n\n![cover](https://example.org/c.jpg)\n\nA book.\n'));
  assert.ok(defaultNote(sampleBook({ localCoverImage: 'Covers/Flow.jpg' })).includes('![[Covers/Flow.jpg]]'));
  const bare = defaultNote({ ...emptyBook(), title: 'T' });
  assert.equal(bare, '---\ntitle: "T"\n---\n\n# T\n');
});

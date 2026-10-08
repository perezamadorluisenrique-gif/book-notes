import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_FILE_NAME, joinPath, makeFileName, sanitiseFileName } from '../src/filename.ts';
import { fakeDate, sampleBook } from './helpers.ts';

test('illegal characters are removed', () => {
  assert.equal(sanitiseFileName('What? A: "Book" <1>/2\\3 | #4 [5] ^6 *7'), 'What A Book 123 4 5 6 7');
  assert.equal(sanitiseFileName('J.R.R. Tolkien'), 'JRR Tolkien');
});

test('whitespace and control characters collapse', () => {
  assert.equal(sanitiseFileName('  a\t\nb   c\u0000d '), 'a b c d');
});

test('long names are cut and reserved names get a suffix', () => {
  assert.ok(sanitiseFileName('x'.repeat(500)).length <= 180);
  assert.equal(sanitiseFileName('CON'), 'CON_');
  assert.equal(sanitiseFileName('nul'), 'nul_');
  assert.equal(sanitiseFileName('console'), 'console');
});

test('the default format is "title - author"', () => {
  assert.equal(DEFAULT_FILE_NAME, '{{title}} - {{author}}');
  assert.equal(makeFileName(sampleBook(), '', fakeDate), 'Flow - Mihaly Csikszentmihalyi');
  assert.equal(makeFileName(sampleBook(), '   ', fakeDate), 'Flow - Mihaly Csikszentmihalyi');
});

test('an empty author does not leave a dangling dash', () => {
  assert.equal(makeFileName(sampleBook({ author: '', authors: [] }), '', fakeDate), 'Flow');
  assert.equal(makeFileName(sampleBook({ title: '' }), '{{title}} - {{author}}', fakeDate), 'Mihaly Csikszentmihalyi');
});

test('custom formats with other variables and dates', () => {
  assert.equal(makeFileName(sampleBook(), '{{title}} ({{publishDate}})', fakeDate), 'Flow (2009-10-13)');
  assert.equal(makeFileName(sampleBook(), '{{DATE:YYYY}} {{title}}', fakeDate), '<YYYY|0days> Flow'.replace(/[<>|]/g, ''));
});

test('a title with a colon and slash is made safe', () => {
  assert.equal(makeFileName(sampleBook({ title: 'Why/How: A Guide?' }), '{{title}}', fakeDate), 'WhyHow A Guide');
});

test('never empty', () => {
  assert.equal(makeFileName(sampleBook({ title: '???', author: '', authors: [] }), '', fakeDate), 'Untitled book');
});

test('joinPath handles the root, slashes and backslashes', () => {
  assert.equal(joinPath('', 'A'), 'A.md');
  assert.equal(joinPath('/', 'A'), 'A.md');
  assert.equal(joinPath('Books', 'A'), 'Books/A.md');
  assert.equal(joinPath('/Books/Sci-fi/', 'A'), 'Books/Sci-fi/A.md');
  assert.equal(joinPath('Books\\Old', 'A', 'jpg'), 'Books/Old/A.jpg');
});

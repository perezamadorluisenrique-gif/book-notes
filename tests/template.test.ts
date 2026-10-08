import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderTemplate, replaceDates, VARIABLES } from '../src/template.ts';
import { fakeDate, sampleBook } from './helpers.ts';

test('every variable of Book Search is supported', () => {
  const leader = [
    'title', 'subtitle', 'author', 'authors', 'category', 'categories', 'description', 'publisher', 'totalPage',
    'coverUrl', 'coverSmallUrl', 'publishDate', 'isbn10', 'isbn13', 'link', 'localCoverImage',
  ];
  for (const name of leader) assert.ok((VARIABLES as readonly string[]).includes(name), name);
});

test('variables are replaced, case-insensitively', () => {
  const book = sampleBook({ localCoverImage: 'Covers/Flow.jpg' });
  const out = renderTemplate('{{title}}|{{Subtitle}}|{{AUTHOR}}|{{totalpage}}|{{isbn13}}|{{localCoverImage}}', book, fakeDate);
  assert.equal(out, 'Flow|The Psychology of Optimal Experience|Mihaly Csikszentmihalyi|336|9780061876721|Covers/Flow.jpg');
});

test('lists render like Book Search: author joined by ", ", authors by a bare comma', () => {
  const book = sampleBook({ authors: ['A', 'B'], author: 'A, B', categories: ['X', 'Y'], category: 'X, Y' });
  assert.equal(renderTemplate('{{author}}/{{authors}}/{{category}}/{{categories}}', book, fakeDate), 'A, B/A,B/X, Y/X,Y');
});

test('unknown placeholders are removed and plain text, braces and YAML survive', () => {
  const out = renderTemplate('---\ntitle: "{{title}}"\nx: {{nope}}\n---\n{ not a var } {{ spaced }} #tag', sampleBook(), fakeDate);
  assert.equal(out, '---\ntitle: "Flow"\nx: \n---\n{ not a var } {{ spaced }} #tag');
});

test('an empty template gives an empty string; missing values give empty strings', () => {
  assert.equal(renderTemplate('', sampleBook(), fakeDate), '');
  assert.equal(renderTemplate('[{{publisher}}]', sampleBook({ publisher: '' }), fakeDate), '[]');
});

test('values are not re-expanded', () => {
  assert.equal(renderTemplate('{{title}}', sampleBook({ title: '{{author}}' }), fakeDate), '{{author}}');
});

test('DATE variants of the file name format', () => {
  assert.equal(replaceDates('{{DATE}}', fakeDate), '<YYYY-MM-DD|0days>');
  assert.equal(replaceDates('{{DATE+3}}', fakeDate), '<YYYY-MM-DD|3days>');
  assert.equal(replaceDates('{{DATE-2}}', fakeDate), '{{DATE-2}}', 'negative offsets are not part of the syntax');
  assert.equal(replaceDates('{{DATE:YYYY}}', fakeDate), '<YYYY|0days>');
  assert.equal(replaceDates('{{DATE:MMM D+7}}', fakeDate), '<MMM D|7days>');
});

test('date and time variants of template files', () => {
  assert.equal(replaceDates('{{date}}', fakeDate), '<YYYY-MM-DD|0d>');
  assert.equal(replaceDates('{{time}}', fakeDate), '<HH:mm|0d>');
  assert.equal(replaceDates('{{date +1w}}', fakeDate), '<YYYY-MM-DD|1w>');
  assert.equal(replaceDates('{{date-2d:DD/MM}}', fakeDate), '<DD/MM|-2d>');
  assert.equal(replaceDates('{{Date:dddd}}', fakeDate), '<dddd|0d>');
});

test('dates and variables mix in one template', () => {
  assert.equal(renderTemplate('{{title}} {{DATE:YYYY}}', sampleBook(), fakeDate), 'Flow <YYYY|0days>');
});

test('DATE accepts a signed offset', () => {
  assert.equal(replaceDates('{{DATE+-2}}', fakeDate), '<YYYY-MM-DD|-2days>');
});

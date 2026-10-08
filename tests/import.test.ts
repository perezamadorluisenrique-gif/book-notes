import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BOOK_SEARCH_DATA, parseBookSearchData } from '../src/import.ts';
import { fixtureText } from './helpers.ts';

test('maps the settings Book Notes also has', () => {
  assert.deepEqual(parseBookSearchData(fixtureText('book-search-data.json')), {
    folder: 'Books',
    fileNameFormat: '{{title}} ({{author}})',
    templateFile: 'Templates/Book',
    openAfterCreate: false,
    saveCover: true,
    coverFolder: 'Attachments/Covers',
  });
});

test('the API key is not copied', () => {
  assert.ok(!JSON.stringify(parseBookSearchData(fixtureText('book-search-data.json'))).includes('SECRET'));
});

test('partial data maps only what is there', () => {
  assert.deepEqual(parseBookSearchData('{"folder":" Lib ","enableCoverImageSave":false}'), { folder: 'Lib', saveCover: false });
});

test('wrong types, junk and empty data give null or are skipped', () => {
  assert.equal(parseBookSearchData('not json'), null);
  assert.equal(parseBookSearchData('[]'), null);
  assert.equal(parseBookSearchData('null'), null);
  assert.equal(parseBookSearchData('{}'), null);
  assert.deepEqual(parseBookSearchData('{"folder":3,"fileNameFormat":"x"}'), { fileNameFormat: 'x' });
});

test('the data path', () => {
  assert.equal(BOOK_SEARCH_DATA, 'plugins/obsidian-book-search-plugin/data.json');
});

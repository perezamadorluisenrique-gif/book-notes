import { readFileSync } from 'node:fs';

import type { Book } from '../src/book.ts';
import { emptyBook } from '../src/book.ts';
import type { DateFormatter } from '../src/template.ts';

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

export function fixtureText(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

/** A date formatter that shows what it was asked for, so the tests need no moment.js. */
export const fakeDate: DateFormatter = (format, offset, unit) => `<${format}|${offset}${unit}>`;

export function sampleBook(over: Partial<Book> = {}): Book {
  return {
    ...emptyBook(),
    title: 'Flow',
    subtitle: 'The Psychology of Optimal Experience',
    authors: ['Mihaly Csikszentmihalyi'],
    author: 'Mihaly Csikszentmihalyi',
    categories: ['Psychology', 'Creativity'],
    category: 'Psychology, Creativity',
    publisher: 'Harper Collins',
    publishDate: '2009-10-13',
    totalPage: 336,
    coverUrl: 'https://example.org/c.jpg',
    coverSmallUrl: 'https://example.org/s.jpg',
    isbn10: '0061876720',
    isbn13: '9780061876721',
    link: 'https://example.org/flow',
    description: 'A book.',
    ...over,
  };
}

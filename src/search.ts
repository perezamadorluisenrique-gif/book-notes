import type { Book } from './book.ts';
import * as google from './google.ts';
import { parseIsbn } from './isbn.ts';
import * as openlibrary from './openlibrary.ts';

export type Provider = 'openlibrary' | 'google';

export interface HttpResponse {
  status: number;
  json: unknown;
}

/** One GET request. main.ts implements it with `requestUrl`; tests pass a stub. */
export type HttpGet = (url: string) => Promise<HttpResponse>;

export interface SearchOptions {
  provider: Provider;
  googleApiKey: string;
  googleLanguage: string;
}

export class SearchError extends Error {}

function check(res: HttpResponse, provider: Provider): void {
  if (res.status >= 200 && res.status < 300) return;
  const detail = provider === 'google' ? google.errorMessage(res.json) : null;
  if (provider === 'google' && res.status === 429) {
    throw new SearchError('Google Books refused the request (quota). Add an API key in the settings or switch to Open Library.');
  }
  throw new SearchError(`${provider === 'google' ? 'Google Books' : 'Open Library'} answered ${res.status}${detail ? `: ${detail}` : ''}.`);
}

/** Searches by title, author or ISBN. A valid ISBN goes straight to the provider's ISBN endpoint. */
export async function searchBooks(query: string, opts: SearchOptions, get: HttpGet): Promise<Book[]> {
  const text = query.trim();
  if (!text) return [];
  const isbn = parseIsbn(text);
  if (opts.provider === 'google') {
    const g = { apiKey: opts.googleApiKey, language: opts.googleLanguage };
    const res = await get(isbn ? google.isbnUrl(isbn, g) : google.searchUrl(text, g));
    check(res, 'google');
    return google.parseSearch(res.json);
  }
  if (isbn) {
    const res = await get(openlibrary.isbnUrl(isbn));
    check(res, 'openlibrary');
    const books = openlibrary.parseIsbnData(res.json, isbn);
    if (books.length) return books;
    // The ISBN endpoint only knows editions; the search also finds works that list the number.
  }
  const res = await get(openlibrary.searchUrl(isbn ?? text));
  check(res, 'openlibrary');
  return openlibrary.parseSearch(res.json);
}

/** Open Library's search has no description; the work record does. A failure leaves the book as it is. */
export async function addDetails(book: Book, opts: SearchOptions, get: HttpGet): Promise<Book> {
  if (opts.provider !== 'openlibrary' || book.description || !book.workKey) return book;
  try {
    const res = await get(openlibrary.workUrl(book.workKey));
    if (res.status >= 200 && res.status < 300) {
      return { ...book, description: openlibrary.parseWorkDescription(res.json) };
    }
  } catch {
    // The note is still useful without a description.
  }
  return book;
}

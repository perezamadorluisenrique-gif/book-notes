import { cleanList, emptyBook, htmlToText, joinList } from './book.ts';
import type { Book } from './book.ts';
import { pickIsbns } from './isbn.ts';

const BASE = 'https://openlibrary.org';
const COVERS = 'https://covers.openlibrary.org';
const FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'first_publish_year',
  'publisher',
  'isbn',
  'cover_i',
  'number_of_pages_median',
  'subject',
].join(',');

export function searchUrl(query: string, limit = 20): string {
  return `${BASE}/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&fields=${FIELDS}`;
}

export function isbnUrl(isbn: string): string {
  return `${BASE}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
}

export function workUrl(workKey: string): string {
  return `${BASE}${workKey}.json`;
}

export function coverUrls(coverId: number | string): { small: string; medium: string; large: string } {
  const base = `${COVERS}/b/id/${coverId}`;
  return { small: `${base}-S.jpg`, medium: `${base}-M.jpg`, large: `${base}-L.jpg` };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return cleanList(value);
}

function finish(book: Book): Book {
  book.author = joinList(book.authors);
  book.category = joinList(book.categories);
  return book;
}

/** Subjects of Open Library are long and noisy; the first few are the useful ones. */
const MAX_CATEGORIES = 5;

/** `search.json` response to books. Anything without a title is dropped. */
export function parseSearch(json: unknown): Book[] {
  const docs = (json as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];
  const books: Book[] = [];
  for (const raw of docs) {
    const doc = (raw ?? {}) as Record<string, unknown>;
    const title = str(doc.title);
    if (!title) continue;
    const book = emptyBook();
    book.title = title;
    book.subtitle = str(doc.subtitle);
    book.authors = strings(doc.author_name);
    book.categories = strings(doc.subject).slice(0, MAX_CATEGORIES);
    book.publisher = strings(doc.publisher)[0] ?? '';
    const year = doc.first_publish_year;
    book.publishDate = typeof year === 'number' ? String(year) : '';
    const pages = doc.number_of_pages_median;
    book.totalPage = typeof pages === 'number' && pages > 0 ? pages : '';
    Object.assign(book, pickIsbns(strings(doc.isbn)));
    const key = str(doc.key);
    if (key) {
      book.link = `${BASE}${key}`;
      if (key.startsWith('/works/')) book.workKey = key;
    }
    const cover = doc.cover_i;
    if ((typeof cover === 'number' && cover > 0) || (typeof cover === 'string' && cover)) {
      const urls = coverUrls(cover);
      book.coverUrl = urls.medium;
      book.coverSmallUrl = urls.small;
      book.coverLargeUrl = urls.large;
    }
    books.push(finish(book));
  }
  return books;
}

/** `api/books?jscmd=data` response for one ISBN to a list of zero or one book. */
export function parseIsbnData(json: unknown, isbn: string): Book[] {
  const entry = (json as Record<string, unknown> | null)?.[`ISBN:${isbn}`] as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== 'object') return [];
  const title = str(entry.title);
  if (!title) return [];
  const names = (list: unknown): string[] =>
    Array.isArray(list) ? cleanList(list.map((item) => (item as { name?: unknown })?.name)) : [];
  const book = emptyBook();
  book.title = title;
  book.subtitle = str(entry.subtitle);
  book.authors = names(entry.authors);
  book.categories = names(entry.subjects).slice(0, MAX_CATEGORIES);
  book.publisher = names(entry.publishers)[0] ?? '';
  book.publishDate = str(entry.publish_date);
  const pages = entry.number_of_pages;
  book.totalPage = typeof pages === 'number' && pages > 0 ? pages : '';
  const ids = (entry.identifiers ?? {}) as Record<string, unknown>;
  Object.assign(book, pickIsbns([...strings(ids.isbn_10), ...strings(ids.isbn_13), isbn]));
  book.link = str(entry.url) ? (str(entry.url).startsWith('http') ? str(entry.url) : `${BASE}${str(entry.url)}`) : '';
  const cover = (entry.cover ?? {}) as Record<string, unknown>;
  book.coverSmallUrl = str(cover.small);
  book.coverUrl = str(cover.medium) || book.coverSmallUrl;
  book.coverLargeUrl = str(cover.large) || book.coverUrl;
  return [finish(book)];
}

/** The description of a work (`/works/OL..W.json`): a string, or `{ type, value }`. */
export function parseWorkDescription(json: unknown): string {
  const d = (json as { description?: unknown } | null)?.description;
  const text = typeof d === 'string' ? d : str((d as { value?: unknown } | null)?.value);
  // Open Library descriptions are Markdown; a trailing "----------" starts a list of sources.
  return htmlToText(text.split(/\n-{5,}/)[0]);
}

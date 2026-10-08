import { cleanList, emptyBook, htmlToText, joinList } from './book.ts';
import type { Book } from './book.ts';
import { pickIsbns } from './isbn.ts';

const BASE = 'https://www.googleapis.com/books/v1/volumes';

export interface GoogleOptions {
  apiKey?: string;
  /** An ISO 639-1 code such as "en" to restrict results to; empty for any language. */
  language?: string;
}

function build(q: string, opts: GoogleOptions, limit: number): string {
  const params = [`q=${encodeURIComponent(q)}`, `maxResults=${limit}`, 'printType=books'];
  const language = opts.language?.trim();
  if (language) params.push(`langRestrict=${encodeURIComponent(language)}`);
  const key = opts.apiKey?.trim();
  if (key) params.push(`key=${encodeURIComponent(key)}`);
  return `${BASE}?${params.join('&')}`;
}

export function searchUrl(query: string, opts: GoogleOptions = {}, limit = 20): string {
  return build(query.trim(), opts, limit);
}

export function isbnUrl(isbn: string, opts: GoogleOptions = {}): string {
  return build(`isbn:${isbn}`, opts, 5);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Google serves cover links over http for some volumes. */
function https(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

/** One `volumeInfo` object to a book. Without a title there is nothing to show. */
export function parseVolume(volume: unknown): Book | null {
  const info = ((volume as { volumeInfo?: unknown })?.volumeInfo ?? null) as Record<string, unknown> | null;
  if (!info) return null;
  const title = str(info.title);
  if (!title) return null;
  const book = emptyBook();
  book.title = title;
  book.subtitle = str(info.subtitle);
  book.authors = cleanList(info.authors);
  book.author = joinList(book.authors);
  book.categories = cleanList(info.categories);
  book.category = joinList(book.categories);
  book.publisher = str(info.publisher);
  book.publishDate = str(info.publishedDate);
  book.totalPage = typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : '';
  book.description = htmlToText(str(info.description));
  const ids = Array.isArray(info.industryIdentifiers) ? (info.industryIdentifiers as { identifier?: unknown }[]) : [];
  Object.assign(book, pickIsbns(ids.map((i) => str(i?.identifier))));
  const links = (info.imageLinks ?? {}) as Record<string, unknown>;
  book.coverUrl = https(str(links.thumbnail));
  book.coverSmallUrl = https(str(links.smallThumbnail));
  // `zoom=1` is the thumbnail; `zoom=0` is the largest size Google serves for the volume.
  book.coverLargeUrl = book.coverUrl ? book.coverUrl.replace(/([?&])zoom=\d/, '$1zoom=0') : '';
  book.link = str(info.canonicalVolumeLink) || str(info.infoLink);
  return book;
}

export function parseSearch(json: unknown): Book[] {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.map(parseVolume).filter((b): b is Book => b !== null);
}

/** The message of a Google error response (quota, bad key), or null. */
export function errorMessage(json: unknown): string | null {
  const message = (json as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === 'string' && message ? message : null;
}

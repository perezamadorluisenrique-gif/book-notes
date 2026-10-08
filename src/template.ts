import type { Book } from './book.ts';

/** Formats "now" plus an offset in the given unit with a moment.js format. Supplied by main.ts (`window.moment`). */
export type DateFormatter = (format: string, offset: number, unit: string) => string;

/** Book Search's variables, plus `localCoverImage`. Names are matched case-insensitively. */
export const VARIABLES = [
  'title',
  'subtitle',
  'author',
  'authors',
  'category',
  'categories',
  'description',
  'publisher',
  'totalPage',
  'coverUrl',
  'coverSmallUrl',
  'coverLargeUrl',
  'publishDate',
  'isbn10',
  'isbn13',
  'link',
  'localCoverImage',
] as const;

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

function valueOf(book: Book, name: string): string | undefined {
  const key = VARIABLES.find((v) => v.toLowerCase() === name.toLowerCase());
  if (!key) return undefined;
  const value = book[key];
  // Book Search prints a list through String(), which joins with a bare comma. Kept so old templates render the same.
  return Array.isArray(value) ? value.join(',') : String(value ?? '');
}

/**
 * Replaces the dates of a template. Handles `{{DATE}}`, `{{DATE+1}}`, `{{DATE:format}}` and
 * `{{DATE:format+1}}` (File name format), and the Templater-free `{{date}}`, `{{time}}`, `{{date+1d}}`,
 * `{{date:format}}` forms that Book Search applies to template files.
 */
export function replaceDates(text: string, fmt: DateFormatter): string {
  return text
    .replace(/{{DATE(?::([^}\n\r+]*?))?(\+-?\d+)?}}/g, (_, format: string | undefined, offset: string | undefined) =>
      fmt(format || DEFAULT_DATE_FORMAT, offset ? parseInt(offset.replace('+', ''), 10) : 0, 'days'),
    )
    .replace(
      /{{\s*(date|time)\s*(?:([+-]\d+)([yqmwdhs]))?\s*(?::(.+?))?}}/gi,
      (_, kind: string, delta: string | undefined, unit: string | undefined, format: string | undefined) => {
        const fallback = kind.toLowerCase() === 'time' ? 'HH:mm' : DEFAULT_DATE_FORMAT;
        return fmt(format?.trim() || fallback, delta ? parseInt(delta, 10) : 0, unit ?? 'd');
      },
    );
}

/**
 * Fills a template with a book. Known variables are replaced, other `{{word}}` placeholders are
 * removed, as Book Search does, and everything else stays as written.
 */
export function renderTemplate(template: string, book: Book, fmt: DateFormatter): string {
  if (!template) return '';
  const dated = replaceDates(template, fmt);
  return dated.replace(/{{(\w+)}}/g, (_, name: string) => valueOf(book, name) ?? '');
}

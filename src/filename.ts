import type { Book } from './book.ts';
import { renderTemplate } from './template.ts';
import type { DateFormatter } from './template.ts';

export const DEFAULT_FILE_NAME = '{{title}} - {{author}}';

const MAX_LENGTH = 180;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * Removes what a file name cannot hold on some system Obsidian runs on, and what breaks links
 * (`[ ] # ^ |`). The set Book Search removes is included, so both plugins name a book the same way.
 */
export function sanitiseFileName(text: string): string {
  let name = text
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\,#%&{}/*<>$":@.?|[\]^]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length > MAX_LENGTH) name = name.slice(0, MAX_LENGTH).trim();
  if (RESERVED.test(name)) name = `${name}_`;
  return name;
}

/** Separators left dangling when a variable was empty: "Title -" or "- Author". */
function trimSeparators(text: string): string {
  return text.replace(/^[\s\-–—_]+|[\s\-–—_]+$/g, '');
}

/** The file name, without extension, for a book. Never empty. */
export function makeFileName(book: Book, format: string, fmt: DateFormatter): string {
  const rendered = renderTemplate(format.trim() || DEFAULT_FILE_NAME, book, fmt);
  const name = sanitiseFileName(trimSeparators(rendered));
  return name || sanitiseFileName(book.title) || 'Untitled book';
}

/** `folder/name.md` with no doubled or leading slashes; the vault root when the folder is empty. */
export function joinPath(folder: string, name: string, extension = 'md'): string {
  const dir = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const file = `${name}.${extension}`;
  return dir && dir !== '.' ? `${dir}/${file}` : file;
}

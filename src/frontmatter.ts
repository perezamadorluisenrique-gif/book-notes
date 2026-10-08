import type { Book } from './book.ts';

export type PropertyValue = string | number | string[];

/** The properties a book note gets, in order. Empty values are left out. */
export function bookProperties(book: Book): Record<string, PropertyValue> {
  const props: Record<string, PropertyValue> = {};
  const set = (key: string, value: PropertyValue) => {
    if (Array.isArray(value) ? value.length > 0 : value !== '') props[key] = value;
  };
  set('title', book.title);
  set('subtitle', book.subtitle);
  set('author', book.authors);
  set('publisher', book.publisher);
  set('publishDate', book.publishDate);
  set('totalPage', book.totalPage);
  set('isbn10', book.isbn10);
  set('isbn13', book.isbn13);
  set('categories', book.categories);
  set('cover', book.localCoverImage || book.coverUrl);
  set('link', book.link);
  return props;
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyValue);
  return false;
}

/**
 * Decides what to write into the properties of an existing note. Existing values stay unless
 * `overwrite` is on; a key already present with another spelling of its case ("Title") counts as
 * present, so no second property is added. Returns only the changes.
 */
export function planMerge(
  existing: Record<string, unknown>,
  incoming: Record<string, PropertyValue>,
  overwrite: boolean,
): { set: Record<string, PropertyValue>; skipped: string[] } {
  const byLower = new Map<string, string>();
  for (const key of Object.keys(existing)) byLower.set(key.toLowerCase(), key);
  const set: Record<string, PropertyValue> = {};
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(incoming)) {
    const present = byLower.get(key.toLowerCase());
    if (present === undefined || isEmptyValue(existing[present])) {
      set[present ?? key] = value;
    } else if (overwrite) {
      if (JSON.stringify(existing[present]) !== JSON.stringify(value)) set[present] = value;
    } else {
      skipped.push(key);
    }
  }
  return { set, skipped };
}

function scalar(value: string | number): string {
  return typeof value === 'number' ? String(value) : JSON.stringify(value);
}

/** Properties as a YAML block with the `---` fences. Strings are JSON-quoted, which is valid YAML. */
export function toFrontmatter(props: Record<string, PropertyValue>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${scalar(item)}`);
    } else {
      lines.push(`${key}: ${scalar(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** The built-in note: properties, a title, the cover and the description. */
export function defaultNote(book: Book): string {
  const parts = [toFrontmatter(bookProperties(book)), '', `# ${book.title}`];
  const cover = book.localCoverImage ? `![[${book.localCoverImage}]]` : book.coverUrl ? `![cover](${book.coverUrl})` : '';
  if (cover) parts.push('', cover);
  if (book.description) parts.push('', book.description);
  return parts.join('\n') + '\n';
}

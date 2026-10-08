// Pure logic: no `obsidian` import, so tests/ can run it under plain Node.

/** The fields a book note can use. The names are the ones Book Search uses, so existing templates keep working. */
export interface Book {
  title: string;
  subtitle: string;
  author: string;
  authors: string[];
  category: string;
  categories: string[];
  publisher: string;
  publishDate: string;
  totalPage: number | string;
  coverUrl: string;
  coverSmallUrl: string;
  coverLargeUrl: string;
  localCoverImage: string;
  isbn10: string;
  isbn13: string;
  link: string;
  description: string;
  /** Where the record came from, for the details request of Open Library. Not a template variable. */
  workKey?: string;
}

export function emptyBook(): Book {
  return {
    title: '',
    subtitle: '',
    author: '',
    authors: [],
    category: '',
    categories: [],
    publisher: '',
    publishDate: '',
    totalPage: '',
    coverUrl: '',
    coverSmallUrl: '',
    coverLargeUrl: '',
    localCoverImage: '',
    isbn10: '',
    isbn13: '',
    link: '',
    description: '',
  };
}

/** Trims and drops empty and repeated entries, keeping the order. */
export function cleanList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Google Books descriptions come as HTML; notes want plain text with blank lines between paragraphs. */
export function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Joins a list the way Book Search does: "A, B". */
export function joinList(list: string[]): string {
  return list.join(', ');
}

/** Removes hyphens, spaces and an "ISBN" prefix; upper-cases the X check digit. */
export function normaliseIsbn(input: string): string {
  return input
    .trim()
    .replace(/^isbn(?:-1[03])?\s*:?\s*/i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = isbn[i];
    sum += (ch === 'X' ? 10 : Number(ch)) * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

/** The normalised ISBN when the input is a valid ISBN-10 or ISBN-13, else null. */
export function parseIsbn(input: string): string | null {
  const isbn = normaliseIsbn(input);
  return isValidIsbn10(isbn) || isValidIsbn13(isbn) ? isbn : null;
}

/** The ISBN-13 for a valid ISBN-10 (978 prefix), else null. */
export function toIsbn13(isbn10: string): string | null {
  if (!isValidIsbn10(isbn10)) return null;
  const body = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}

/** Picks the ISBN-10 and ISBN-13 out of a list of identifiers of either kind, ignoring invalid ones. */
export function pickIsbns(identifiers: string[]): { isbn10: string; isbn13: string } {
  let isbn10 = '';
  let isbn13 = '';
  for (const raw of identifiers) {
    const isbn = normaliseIsbn(String(raw));
    if (!isbn10 && isValidIsbn10(isbn)) isbn10 = isbn;
    else if (!isbn13 && isValidIsbn13(isbn)) isbn13 = isbn;
    if (isbn10 && isbn13) break;
  }
  return { isbn10, isbn13 };
}

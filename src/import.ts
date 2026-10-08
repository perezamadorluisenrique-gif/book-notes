/** The settings of Book Search that Book Notes also has. Only present keys are returned. */
export interface ImportedSettings {
  folder?: string;
  fileNameFormat?: string;
  templateFile?: string;
  openAfterCreate?: boolean;
  saveCover?: boolean;
  coverFolder?: string;
}

/** Where Book Search keeps its settings, relative to the config folder. */
export const BOOK_SEARCH_DATA = 'plugins/obsidian-book-search-plugin/data.json';

/** Maps the `data.json` text of Book Search. Returns null when it is not JSON or holds nothing usable. */
export function parseBookSearchData(text: string): ImportedSettings | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const out: ImportedSettings = {};
  if (typeof d.folder === 'string') out.folder = d.folder.trim();
  if (typeof d.fileNameFormat === 'string') out.fileNameFormat = d.fileNameFormat.trim();
  if (typeof d.templateFile === 'string') out.templateFile = d.templateFile.trim();
  if (typeof d.openPageOnCompletion === 'boolean') out.openAfterCreate = d.openPageOnCompletion;
  if (typeof d.enableCoverImageSave === 'boolean') out.saveCover = d.enableCoverImageSave;
  if (typeof d.coverImagePath === 'string') out.coverFolder = d.coverImagePath.trim();
  return Object.keys(out).length ? out : null;
}

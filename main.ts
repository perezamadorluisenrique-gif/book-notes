import { Notice, Plugin, PluginSettingTab, Setting, SuggestModal, TFile, moment, normalizePath, requestUrl } from 'obsidian';
import type { App, SettingDefinitionItem } from 'obsidian';

import type { Book } from './src/book.ts';
import { joinPath, makeFileName } from './src/filename.ts';
import { bookProperties, defaultNote, planMerge } from './src/frontmatter.ts';
import { BOOK_SEARCH_DATA, parseBookSearchData } from './src/import.ts';
import { parseIsbn } from './src/isbn.ts';
import { addDetails, searchBooks, SearchError } from './src/search.ts';
import type { HttpGet, Provider, SearchOptions } from './src/search.ts';
import { renderTemplate } from './src/template.ts';
import type { DateFormatter } from './src/template.ts';

/** The part of moment this plugin uses, typed here: the directory's review has no types for `moment`. */
interface Moment {
  add(amount: number, unit: string): Moment;
  format(format: string): string;
}
const now = moment as unknown as () => Moment;

interface BookNotesSettings {
  provider: Provider;
  googleApiKey: string;
  googleLanguage: string;
  folder: string;
  fileNameFormat: string;
  templateFile: string;
  openAfterCreate: boolean;
  saveCover: boolean;
  coverFolder: string;
  overwriteExisting: boolean;
}

const DEFAULT_SETTINGS: BookNotesSettings = {
  provider: 'openlibrary',
  googleApiKey: '',
  googleLanguage: '',
  folder: '',
  fileNameFormat: '{{title}} - {{author}}',
  templateFile: '',
  openAfterCreate: true,
  saveCover: false,
  coverFolder: 'Covers',
  overwriteExisting: false,
};

const PROVIDERS: Record<Provider, string> = {
  openlibrary: 'Open Library (no key needed)',
  google: 'Google Books',
};

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Names and descriptions shared by the declarative settings tab and the older `display()`. */
const TEXT = {
  provider: { name: 'Search provider', desc: 'Open Library needs no key and has no quota. Google Books works without a key but may refuse requests when its shared quota runs out.' },
  googleApiKey: { name: 'Google Books API key', desc: 'Optional. Sent only to Google Books. Leave empty to search without a key.' },
  googleLanguage: { name: 'Google Books language', desc: 'Optional. A two-letter code such as "en" or "es" to restrict Google Books results to one language.' },
  folder: { name: 'New note folder', desc: 'Book notes are created here. Empty for the vault root.' },
  fileNameFormat: {
    name: 'File name format',
    desc: 'Variables such as {{title}}, {{author}}, {{publishDate}} and {{DATE:YYYY}}. Characters a file name cannot hold are removed.',
  },
  templateFile: {
    name: 'Template file',
    desc: 'A note with {{variables}} used as the content of new book notes. Empty uses the built-in note with properties, a heading, the cover and the description.',
  },
  openAfterCreate: { name: 'Open the new note', desc: 'Open a book note right after creating it. An existing note is always opened.' },
  saveCover: { name: 'Save cover images in the vault', desc: 'Download the cover and make {{localCoverImage}} (and the cover property) point to the file.' },
  coverFolder: { name: 'Cover image folder', desc: 'Where saved covers go.' },
  overwriteExisting: {
    name: 'Overwrite existing properties',
    desc: '"Insert book metadata into this note" fills only empty properties. Turn on to replace values that are already there.',
  },
  importSettings: {
    name: 'Import settings from Book Search',
    desc: 'Copies the folder, file name format, template file, cover and open-after-creating settings from Book Search, if it is installed in this vault. Its API key is not copied.',
  },
} as const;

export default class BookNotesPlugin extends Plugin {
  settings: BookNotesSettings = { ...DEFAULT_SETTINGS };

  /**
   * Every request to Open Library and Google Books goes through here. A property, so the end-to-end tests
   * can replace it and run without a network.
   */
  http: HttpGet = async (url) => {
    const res = await requestUrl({ url, throw: false });
    let json: unknown = null;
    try {
      json = res.json;
    } catch {
      // Not JSON (an HTML error page): the status says enough.
    }
    return { status: res.status, json };
  };

  /** Image downloads, a property for the same reason as `http`. */
  fetchImage = async (url: string): Promise<{ status: number; contentType: string; data: ArrayBuffer }> => {
    const res = await requestUrl({ url, throw: false });
    const type = res.headers['content-type'] ?? res.headers['Content-Type'] ?? '';
    return { status: res.status, contentType: type.split(';')[0].trim().toLowerCase(), data: res.arrayBuffer };
  };

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new BookNotesSettingTab(this.app, this));

    this.addCommand({
      id: 'create-book-note',
      name: 'Create book note',
      icon: 'book-plus',
      callback: () => this.pickBook('', (book) => this.createNote(book)),
    });
    this.addCommand({
      id: 'insert-book-metadata',
      name: 'Insert book metadata into this note',
      icon: 'book-down',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || file.extension !== 'md') return false;
        if (!checking) this.pickBook(file.basename, (book) => this.fillNote(file, book));
        return true;
      },
    });
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<BookNotesSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
    if (!(this.settings.provider in PROVIDERS)) this.settings.provider = DEFAULT_SETTINGS.provider;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  searchOptions(): SearchOptions {
    const s = this.settings;
    return { provider: s.provider, googleApiKey: s.googleApiKey, googleLanguage: s.googleLanguage };
  }

  private pickBook(initialQuery: string, onPick: (book: Book) => Promise<unknown>) {
    new BookSearchModal(this, initialQuery, (book) => {
      onPick(book).catch((error: unknown) => {
        console.error('Book Notes:', error);
        new Notice(`Book Notes: ${error instanceof Error ? error.message : String(error)}`);
      });
    }).open();
  }

  private formatDate: DateFormatter = (format, offset, unit) =>
    now().add(offset, unit === 'q' ? 'Q' : unit).format(format);

  /** Creates the note for a book, or opens it when one with that name exists. */
  async createNote(picked: Book): Promise<TFile> {
    const s = this.settings;
    const book = await addDetails(picked, this.searchOptions(), this.http);
    const name = makeFileName(book, s.fileNameFormat, this.formatDate);
    const path = normalizePath(joinPath(s.folder, name));

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      new Notice(`"${existing.basename}" already exists. Opened it instead.`);
      await this.app.workspace.getLeaf(false).openFile(existing);
      return existing;
    }

    if (s.saveCover) book.localCoverImage = await this.saveCoverImage(book, name);
    const content = await this.render(book);
    await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
    const file = await this.app.vault.create(path, content);
    if (s.openAfterCreate) await this.app.workspace.getLeaf(false).openFile(file);
    return file;
  }

  /** Fills the missing properties of a note from a book. */
  async fillNote(file: TFile, picked: Book): Promise<{ added: string[]; skipped: string[] }> {
    const s = this.settings;
    const book = await addDetails(picked, this.searchOptions(), this.http);
    if (s.saveCover) {
      book.localCoverImage = await this.saveCoverImage(book, makeFileName(book, s.fileNameFormat, this.formatDate));
    }
    const incoming = bookProperties(book);
    let added: string[] = [];
    let skipped: string[] = [];
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const plan = planMerge(fm, incoming, s.overwriteExisting);
      Object.assign(fm, plan.set);
      added = Object.keys(plan.set);
      skipped = plan.skipped;
    });
    const text = added.length === 0 ? 'Nothing to add: the properties are already filled.' : `Added ${added.length} propert${added.length === 1 ? 'y' : 'ies'} to "${file.basename}".`;
    new Notice(skipped.length && added.length ? `${text} Kept ${skipped.length} existing.` : text);
    return { added, skipped };
  }

  private async render(book: Book): Promise<string> {
    const path = this.settings.templateFile.trim();
    if (path) {
      const template = this.app.metadataCache.getFirstLinkpathDest(normalizePath(path), '');
      if (template) return renderTemplate(await this.app.vault.cachedRead(template), book, this.formatDate);
      new Notice(`Template "${path}" was not found. Used the built-in note.`);
    }
    return defaultNote(book);
  }

  private async ensureFolder(folder: string) {
    if (!folder || this.app.vault.getAbstractFileByPath(folder)) return;
    await this.app.vault.createFolder(folder);
  }

  /** Downloads the cover into the vault; returns its path, or '' when there is none or it failed. */
  private async saveCoverImage(book: Book, name: string): Promise<string> {
    const url = book.coverLargeUrl || book.coverUrl || book.coverSmallUrl;
    if (!url) return '';
    try {
      const res = await this.fetchImage(url);
      if (res.status !== 200 || res.data.byteLength === 0) throw new Error(`status ${res.status}`);
      const path = normalizePath(joinPath(this.settings.coverFolder, name, IMAGE_TYPES[res.contentType] ?? 'jpg'));
      if (this.app.vault.getAbstractFileByPath(path)) return path;
      await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
      await this.app.vault.createBinary(path, res.data);
      return path;
    } catch (error) {
      console.warn('Book Notes: could not save the cover', error);
      new Notice('Could not save the cover image. The note was created without it.');
      return '';
    }
  }

  /** Copies the shared settings of Book Search. Returns the names of what changed, or null if it is not there. */
  async importBookSearch(): Promise<string[] | null> {
    const path = normalizePath(`${this.app.vault.configDir}/${BOOK_SEARCH_DATA}`);
    if (!(await this.app.vault.adapter.exists(path))) return null;
    const imported = parseBookSearchData(await this.app.vault.adapter.read(path));
    if (!imported) return null;
    Object.assign(this.settings, imported);
    await this.saveSettings();
    return Object.keys(imported);
  }
}

/** Type to search; Enter picks. Waits for a pause in typing before asking the provider. */
class BookSearchModal extends SuggestModal<Book> {
  private latest = 0;
  private shown: Book[] = [];

  constructor(
    private plugin: BookNotesPlugin,
    initialQuery: string,
    private onPick: (book: Book) => void,
  ) {
    super(plugin.app);
    this.setPlaceholder('Search for a book');
    this.emptyStateText = 'Type at least 3 characters, or an ISBN.';
    this.limit = 20;
    this.initialQuery = initialQuery;
  }

  private initialQuery: string;

  /** The note's name as the first search, selected so typing replaces it. */
  async onOpen() {
    await super.onOpen();
    if (!this.initialQuery) return;
    this.inputEl.value = this.initialQuery;
    this.inputEl.select();
    this.inputEl.dispatchEvent(new Event('input'));
  }

  async getSuggestions(query: string): Promise<Book[]> {
    const ticket = ++this.latest;
    const text = query.trim();
    if (text.length < 3 && !parseIsbn(text)) {
      this.emptyStateText = 'Type at least 3 characters, or an ISBN.';
      return (this.shown = []);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    if (ticket !== this.latest) return this.shown;
    try {
      this.emptyStateText = 'No books found.';
      this.shown = await searchBooks(text, this.plugin.searchOptions(), this.plugin.http);
    } catch (error) {
      console.warn('Book Notes: search failed', error);
      this.emptyStateText = error instanceof SearchError ? error.message : 'The search failed. Check your connection.';
      this.shown = [];
    }
    return this.shown;
  }

  renderSuggestion(book: Book, el: HTMLElement) {
    el.addClass('book-notes-suggestion');
    const cover = book.coverSmallUrl || book.coverUrl;
    const img = el.createEl('img', { cls: 'book-notes-thumb', attr: { alt: '', loading: 'lazy' } });
    if (cover) {
      img.src = cover;
      img.addEventListener('error', () => img.addClass('is-empty'));
    } else {
      img.addClass('is-empty');
    }
    const text = el.createDiv({ cls: 'book-notes-text' });
    text.createDiv({ cls: 'book-notes-title', text: book.title });
    const year = /\b\d{4}\b/.exec(book.publishDate)?.[0];
    const meta = [book.author, year].filter(Boolean).join(' · ');
    if (meta) text.createDiv({ cls: 'book-notes-meta', text: meta });
  }

  onChooseSuggestion(book: Book) {
    this.onPick(book);
  }
}

type Key = keyof BookNotesSettings;

class BookNotesSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: BookNotesPlugin,
  ) {
    super(app, plugin);
  }

  /**
   * The settings of Obsidian 1.13 and later: it renders this itself and indexes it for the settings
   * search. Older versions ignore it and call `display()`.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;
    return [
      {
        type: 'group',
        heading: 'Search',
        items: [
          { ...TEXT.provider, control: { type: 'dropdown', key: 'provider', options: PROVIDERS, defaultValue: DEFAULT_SETTINGS.provider } },
          { ...TEXT.googleApiKey, visible: () => s.provider === 'google', control: { type: 'text', key: 'googleApiKey', placeholder: 'AIza...' } },
          { ...TEXT.googleLanguage, visible: () => s.provider === 'google', control: { type: 'text', key: 'googleLanguage', placeholder: 'en' } },
        ],
      },
      {
        type: 'group',
        heading: 'New notes',
        items: [
          { ...TEXT.folder, control: { type: 'folder', key: 'folder', placeholder: 'Books' } },
          { ...TEXT.fileNameFormat, control: { type: 'text', key: 'fileNameFormat', placeholder: DEFAULT_SETTINGS.fileNameFormat, defaultValue: DEFAULT_SETTINGS.fileNameFormat } },
          { ...TEXT.templateFile, control: { type: 'file', key: 'templateFile', placeholder: 'Templates/Book' } },
          { ...TEXT.openAfterCreate, control: { type: 'toggle', key: 'openAfterCreate', defaultValue: true } },
          { ...TEXT.overwriteExisting, control: { type: 'toggle', key: 'overwriteExisting', defaultValue: false } },
        ],
      },
      {
        type: 'group',
        heading: 'Covers',
        items: [
          { ...TEXT.saveCover, control: { type: 'toggle', key: 'saveCover', defaultValue: false } },
          { ...TEXT.coverFolder, visible: () => s.saveCover, control: { type: 'folder', key: 'coverFolder', placeholder: 'Covers', defaultValue: 'Covers' } },
        ],
      },
      { ...TEXT.importSettings, action: () => void this.importSettings() },
    ];
  }

  getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    Object.assign(this.plugin.settings, { [key]: value });
    await this.plugin.saveSettings();
    // Obsidian 1.13's re-check of `visible`, looked up because older versions lack it.
    if (key === 'provider' || key === 'saveCover') (this as unknown as { refreshDomState?: () => void }).refreshDomState?.();
  }

  private async importSettings() {
    const changed = await this.plugin.importBookSearch();
    if (changed) {
      new Notice(`Imported ${changed.length} setting${changed.length === 1 ? '' : 's'} from Book Search.`);
      this.refresh();
    } else {
      new Notice('Found no settings to import. Is the original installed in this vault?');
    }
  }

  private refresh() {
    const update = (this as unknown as { update?: () => void }).update;
    if (update) update.call(this);
    else if (this.legacy) this.draw();
  }

  private legacy = false;

  /** The pre-1.13 rendering, from the same text. Obsidian skips it once `getSettingDefinitions()` returns anything. */
  display(): void {
    this.legacy = true;
    this.draw();
  }

  private draw(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    new Setting(containerEl).setName('Search').setHeading();
    new Setting(containerEl)
      .setName(TEXT.provider.name)
      .setDesc(TEXT.provider.desc)
      .addDropdown((d) =>
        d
          .addOptions(PROVIDERS)
          .setValue(s.provider)
          .onChange(async (v) => {
            await this.setControlValue('provider', v);
            this.draw();
          }),
      );
    if (s.provider === 'google') {
      this.text('googleApiKey', TEXT.googleApiKey);
      this.text('googleLanguage', TEXT.googleLanguage);
    }
    new Setting(containerEl).setName('New notes').setHeading();
    this.text('folder', TEXT.folder);
    this.text('fileNameFormat', TEXT.fileNameFormat);
    this.text('templateFile', TEXT.templateFile);
    this.toggle('openAfterCreate', TEXT.openAfterCreate);
    this.toggle('overwriteExisting', TEXT.overwriteExisting);
    new Setting(containerEl).setName('Covers').setHeading();
    new Setting(containerEl)
      .setName(TEXT.saveCover.name)
      .setDesc(TEXT.saveCover.desc)
      .addToggle((t) =>
        t.setValue(s.saveCover).onChange(async (v) => {
          await this.setControlValue('saveCover', v);
          this.draw();
        }),
      );
    if (s.saveCover) this.text('coverFolder', TEXT.coverFolder);
    new Setting(containerEl)
      .setName(TEXT.importSettings.name)
      .setDesc(TEXT.importSettings.desc)
      .addButton((b) => b.setButtonText('Import').onClick(() => void this.importSettings()));
  }

  private text(key: Key, text: { name: string; desc: string }) {
    new Setting(this.containerEl)
      .setName(text.name)
      .setDesc(text.desc)
      .addText((t) => t.setValue(String(this.plugin.settings[key])).onChange((v) => this.setControlValue(key, v)));
  }

  private toggle(key: Key, text: { name: string; desc: string }) {
    new Setting(this.containerEl)
      .setName(text.name)
      .setDesc(text.desc)
      .addToggle((t) => t.setValue(Boolean(this.plugin.settings[key])).onChange((v) => this.setControlValue(key, v)));
  }
}

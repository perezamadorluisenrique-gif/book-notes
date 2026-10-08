# Changelog

The release workflow uses the section named after the version being released
as the release description, so every version needs one. `npm version <x.y.z>`
renames the `Unreleased` heading below to that version.

## 0.1.0

- First release: a successor to Book Search.
- Create book notes from Open Library (default, no key) or Google Books (optional key): search by title, author or ISBN, with cover thumbnails in the results.
- Book Search's template variables and file name format, a template file or a built-in note with properties, a heading, the cover and the description.
- Insert book metadata into the current note without overwriting existing properties.
- Optional local cover images, and an import of Book Search's settings.

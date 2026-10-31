# Embedded resume fonts

These unmodified Noto fonts are distributed under the SIL Open Font License. The license and copyright notices are included in OFL-Noto.txt and OFL-CJK.txt. manifest.json records official source URLs, byte lengths and SHA-256 checksums.

- Noto Sans / Noto Serif: Latin, Greek and Cyrillic text, regular and bold.
- Noto Sans Devanagari: Hindi/Marathi and other Devanagari text, regular and bold.
- Noto Sans CJK SC: CJK fallback, including international names. This file uses Simplified Chinese regional glyph forms.

PDFKit embeds only the glyphs used by a document. A missing character produces an actionable export error instead of silently emitting an empty box. Editable DOCX files preserve Unicode text; the receiving editor selects installed fonts and controls its final pagination.

Sources: https://github.com/notofonts/noto-fonts, https://notofonts.github.io/devanagari/ (version 2.007) and https://github.com/notofonts/noto-cjk. Devanagari 2.007 is used because the older archived build triggers a null-anchor shaping failure in the current font engine.

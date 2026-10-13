# Spells

The spell view lists every spell in the SRD 5.1 and any spells you paste in yourself.

## What ships in the repo

- All 319 spells from the SRD 5.1, in [src/spells/data/srd-spells.json](../src/spells/data/srd-spells.json), with the SRD's own text. The SRD 5.1 is used under CC-BY-4.0; see [NOTICE](../NOTICE).
- The SRD's class spell lists, in [src/spells/data/srd-spell-lists.json](../src/spells/data/srd-spell-lists.json). They cover **bard, cleric, druid, paladin, ranger, sorcerer, warlock and wizard**. No other class or subclass has a spell list in the SRD, so for any other class (an artificer, for example) you paste your own list; see below.
- Nothing else. No spell from another book ships, not even as an own-words summary ([docs/CONTENT-POLICY.md](CONTENT-POLICY.md)).

## Where the data came from

- Source: the official SRD 5.1 (CC) PDF, `https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf`, retrieved 2026-10-13, SHA-256 `2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0`.
- Spell text, level, school, ritual tag and the four header fields: the "Spell Descriptions" section, pages 114 to 193.
- Classes and the name allow-list: the "Spell Lists" section, pages 105 to 113.
- Extraction: [scripts/extract-srd-spells.mjs](../scripts/extract-srd-spells.mjs) reads the PDF's text layer with pdf.js and splits it on the headings and the labelled header lines. It refuses to write anything unless the two sections agree on every name and level.
- Tables inside a spell (Animate Objects, Confusion, Control Weather, Creation, Reincarnate, Scrying and Teleport) are extracted into the spell's `tables` field and taken out of its text, so they show once, as tables after the text. The script finds the columns from the headings and starts a row on each line that has a cell in every column; a wrapped cell continues the row above.
- Typos in the source are kept as printed. For example, the At Higher Levels line of Animal Friendship is garbled in the PDF itself.

### Re-running the extraction

The script runs by hand only: no CI job, hook or package script calls it. Its one library, pdf.js, is installed outside the repo, so it is not a dependency in package.json. Last run 2026-10-13 with Node v24.7.0 and pdfjs-dist 4.10.38.

```sh
# 1. pdf.js, pinned, in a folder outside the repo
npm install --prefix /tmp/srd-tools pdfjs-dist@4.10.38

# 2. the source PDF, checked against the hash above
curl -sSL -o /tmp/SRD_CC_v5.1.pdf https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf
sha256sum /tmp/SRD_CC_v5.1.pdf

# 3. extract over the committed files, format them as the repo does, then compare
node scripts/extract-srd-spells.mjs /tmp/SRD_CC_v5.1.pdf /tmp/srd-tools/node_modules/pdfjs-dist src/spells/data
pnpm exec prettier --write src/spells/data
sha256sum src/spells/data/*.json
git diff --stat src/spells/data
```

The script prints each spell with the page its description starts on. After step 3, the hashes should be these and `git diff` should show no change:

- `srd-spells.json`: `ab50017cc20a0a72f5a24ccfd3ae1d17fb4a0ed61a3726e04f1eb4edb41fdd6d`
- `srd-spell-lists.json`: `2c268ff46dc76cfd098db3c9210a9051adfecf492d28dcdda24de7c594df18fe`

### Checks

[src/spells/content.test.ts](../src/spells/content.test.ts) checks the two sections against each other: every spell in the data must be on a class list, every listed spell must be in the data, and each spell's classes must match the lists. It also rejects any spell name with a possessive name in front (such as "Someone's Spell") unless the SRD lists that exact name, and any fixture spell that isn't marked as invented.

## Pasting your own spells

Spells and class lists you paste in are kept in this browser only, under the storage key `lanternbook:spells`. They are never written to the repo. Never copy one into a test or fixture: fixtures use invented spells only, and a test fails on any fixture spell that isn't marked as invented.

A pasted spell is one JSON object like this (an invented spell). `level` is 0 for a cantrip up to 9; `school` is one of abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy or transmutation; `classes` may be empty. A spell may also have `tables`: a list of tables, each with an optional `caption`, a `header` (a list of column headings) and `rows` (lists of cells, as many as the header). Every cell must be text; no other table fields are allowed.

```json
{
  "version": 1,
  "kind": "spell",
  "name": "Lantern Hum",
  "level": 0,
  "school": "illusion",
  "ritual": false,
  "castingTime": "1 action",
  "range": "30 feet",
  "components": "V",
  "duration": "1 minute",
  "text": "Invented for lanternbook tests. A soft hum follows one lantern you can see.",
  "classes": ["bard", "wizard"]
}
```

Prepared spells are the private class list named `Prepared`. Every spell card, SRD or private, has a **Prepare** / **Unprepare** button that adds or removes that spell's name, and a prepared card says **Prepared** in text. Preparing is a list edit and takes no undo snapshot: press the button again to undo it. For many names at once, edit the list in the sidebar (one name per line); click a name there to open that spell, and pick **Prepared (private list)** in the class filter to see them all. A private class list is a class name plus spell names, one per line. Choosing that class in the class filter then shows those spells as well as any spell whose `classes` names it. Names are matched ignoring case and curly or straight apostrophes. Any name that matches no SRD spell and none of your private spells is listed under the class list as not found, never dropped silently.

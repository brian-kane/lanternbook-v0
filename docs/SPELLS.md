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
- Extraction: the PDF's text layer was read with pdf.js and split on the headings and the labelled header lines. The extraction script was not committed, because it needs a PDF library the app does not use.
- Tables inside a spell (Confusion, Control Weather, Reincarnate, Teleport and a few others) are kept as plain lines, one table row per line.
- Typos in the source are kept as printed. For example, the At Higher Levels line of Animal Friendship is garbled in the PDF itself.

[src/spells/content.test.ts](../src/spells/content.test.ts) checks the two sections against each other: every spell in the data must be on a class list, every listed spell must be in the data, and each spell's classes must match the lists. It also rejects any spell name with a possessive name in front (such as "Someone's Spell") unless the SRD lists that exact name, and any fixture spell that isn't marked as invented.

## Pasting your own spells

Spells and class lists you paste in are kept in this browser only, under the storage key `lanternbook:spells`. They are never written to the repo. Never copy one into a test or fixture: fixtures use invented spells only, and a test fails on any fixture spell that isn't marked as invented.

A pasted spell is one JSON object like this (an invented spell). `level` is 0 for a cantrip up to 9; `school` is one of abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy or transmutation; `classes` may be empty.

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

A private class list is a class name plus spell names, one per line. Choosing that class in the class filter then shows those spells as well as any spell whose `classes` names it. Names are matched ignoring case and curly or straight apostrophes. Any name that matches no SRD spell and none of your private spells is listed under the class list as not found, never dropped silently.

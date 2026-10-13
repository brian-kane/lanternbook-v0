// Extracts the SRD 5.1 spells and class spell lists from the official SRD 5.1 (CC) PDF into
// src/spells/data. Run by hand only, as docs/SPELLS.md describes; it is not part of the app,
// CI or the hooks, and pdf.js is installed outside the repo, so package.json does not change.
//
// Usage: node scripts/extract-srd-spells.mjs <SRD_CC_v5.1.pdf> <pdfjs-dist dir> <output dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [pdfPath, pdfjsDir, outDir] = process.argv.slice(2);
if (!pdfPath || !pdfjsDir || !outDir) {
  console.error(
    'usage: node scripts/extract-srd-spells.mjs <SRD_CC_v5.1.pdf> <pdfjs-dist dir> <output dir>',
  );
  process.exit(1);
}

const { getDocument } = await import(
  pathToFileURL(join(pdfjsDir, 'legacy', 'build', 'pdf.mjs')).href
);

const round1 = (n) => Math.round(n * 10) / 10;

/** Every text item with its page, font, size and position. */
async function readItems(path) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  const items = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    for (const it of content.items) {
      if (!('str' in it)) continue;
      items.push({
        p,
        s: it.str,
        f: it.fontName,
        h: round1(it.transform[3]),
        x: round1(it.transform[4]),
        w: round1(it.width),
        y: Math.round(it.transform[5]),
      });
    }
  }
  return items;
}

/** Turns the PDF's soft-hyphen and non-breaking-hyphen runs into plain hyphens. */
function clean(text) {
  let s = text;
  for (const run of ['-­‐‑', '­‐‑', '‐‑']) {
    s = s.replaceAll(run, '-');
  }
  return s.replaceAll('­', '').replaceAll('‑', '-').replaceAll('‐', '-');
}

/** Groups items into lines: same page, same baseline, in stream order. Drops the page footer. */
function toLines(items) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (it.s === '') continue;
    if (cur && cur.p === it.p && cur.y === it.y && it.x >= cur.end - 1) {
      const gap = it.x - cur.end;
      if (gap > 1.0 && !cur.text.endsWith(' ') && !it.s.startsWith(' ')) cur.text += ' ';
      cur.text += it.s;
      cur.end = it.x + it.w;
    } else {
      cur = { p: it.p, y: it.y, x: it.x, h: it.h, f: it.f, text: it.s, end: it.x + it.w };
      lines.push(cur);
    }
  }
  return lines
    .map((l) => ({ ...l, text: clean(l.text), col: l.x < 300 ? 0 : 1 }))
    .filter((l) => l.y > 40);
}

const BASE = [57.6, 328.6];
const straight = (name) => name.replaceAll('’', "'");
const FIELDS = [
  ['Casting Time:', 'castingTime'],
  ['Range:', 'range'],
  ['Components:', 'components'],
  ['Component:', 'components'], // a typo in the source, on Contagion
  ['Duration:', 'duration'],
];

/** Class spell lists, pages 105 to 113: class name to { spell name: level }. */
function readClassLists(lines) {
  const classes = {};
  let cls = null;
  let level = null;
  for (const l of lines) {
    if (l.p < 105 || l.p > 113) continue;
    const t = l.text.trim();
    if (l.h >= 13.5 && t.endsWith(' Spells')) {
      cls = t.slice(0, -7).toLowerCase();
      classes[cls] = {};
    } else if (l.h === 12) {
      level = t.startsWith('Cantrips') ? 0 : Number(t.match(/^(\d)\w\w Level/)[1]);
    } else if (l.h !== 18 && cls && l.h === 9.8 && t) {
      classes[cls][straight(t)] = level;
    }
  }
  return classes;
}

/** Spell descriptions, from the "Spell Descriptions" heading to the next chapter heading. */
function readSpells(lines) {
  const spells = [];
  let started = false;
  let cur = null;
  for (const l of lines) {
    if (l.p < 114) continue;
    if (l.h === 18) {
      if (l.text.trim() === 'Spell Descriptions') {
        started = true;
        continue;
      } else if (started) break;
    }
    if (!started) continue;
    if (l.h === 12 && l.f === 'g_d0_f5') {
      cur = { name: straight(l.text.trim()), page: l.p, lines: [] };
      spells.push(cur);
    } else cur.lines.push(l);
  }
  return spells.map(parseSpell);
}

function parseSpell({ name, page, lines }) {
  const sub = lines[0].text.trim();
  const m = sub.match(/^(?:(\d)\w\w-level (\w+)|(\w+) cantrip)( \(ritual\))?$/);
  if (!m) throw new Error(`${name}: unexpected level line "${sub}"`);
  const rec = {
    name,
    level: m[1] ? Number(m[1]) : 0,
    school: (m[2] ?? m[3]).toLowerCase(),
    ritual: Boolean(m[4]),
  };

  let i = 1;
  let field = null;
  while (i < lines.length) {
    const t = lines[i].text.trim();
    const hit = FIELDS.find(([label]) => t.startsWith(label));
    if (hit) {
      field = hit[1];
      rec[field] = t.slice(hit[0].length).trim();
    } else if (field && !('duration' in rec)) {
      rec[field] += (rec[field].endsWith('-') ? '' : ' ') + t; // a wrapped header value
    } else break;
    i++;
  }
  if (field !== 'duration') throw new Error(`${name}: header fields not found`);

  // Paragraphs start indented; bullets and table rows start their own lines.
  const paras = [];
  const kinds = [];
  for (const l of lines.slice(i)) {
    const t = l.text.trim();
    if (!t) continue;
    const indent = l.x > BASE[l.col] + 5;
    if (l.f === 'g_d0_f4' || l.f === 'g_d0_f8') {
      if (kinds.at(-1) === 'table' && l.h < 10) paras[paras.length - 1] += '\n' + t;
      else {
        paras.push(t);
        kinds.push(l.h < 10 ? 'table' : 'title');
      }
      continue;
    }
    const bulletCont =
      paras.length > 0 && kinds.at(-1) === 'bullet' && indent && !t.startsWith('•');
    if (
      !bulletCont &&
      (paras.length === 0 || indent || t.startsWith('•') || kinds.at(-1) !== 'text')
    ) {
      paras.push(t);
      kinds.push(t.startsWith('•') ? 'bullet' : 'text');
    } else {
      const prev = paras[paras.length - 1];
      const join = prev.endsWith('-') && !prev.endsWith(' -') ? '' : ' ';
      paras[paras.length - 1] = prev + join + t;
    }
  }
  return { ...rec, text: paras.join('\n\n'), page };
}

const lines = toLines(await readItems(pdfPath));
const lists = readClassLists(lines);
const spells = readSpells(lines);
const CLASSES = Object.keys(lists).sort();

// The two sections must agree on every name and level before anything is written.
const listed = new Set(CLASSES.flatMap((c) => Object.keys(lists[c])));
const described = new Set(spells.map((s) => s.name));
const problems = [
  ...[...listed].filter((n) => !described.has(n)).map((n) => `listed but not described: ${n}`),
  ...[...described].filter((n) => !listed.has(n)).map((n) => `described but not listed: ${n}`),
];
for (const s of spells) {
  for (const c of CLASSES) {
    if (s.name in lists[c] && lists[c][s.name] !== s.level) {
      problems.push(`level differs between ${c} list and description: ${s.name}`);
    }
  }
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const data = [...spells]
  .sort((a, b) => byName(a.name, b.name))
  .map((s) => ({
    version: 1,
    kind: 'spell',
    name: s.name,
    level: s.level,
    school: s.school,
    ritual: s.ritual,
    castingTime: s.castingTime,
    range: s.range,
    components: s.components,
    duration: s.duration,
    text: s.text,
    classes: CLASSES.filter((c) => s.name in lists[c]),
  }));
const classLists = Object.fromEntries(CLASSES.map((c) => [c, Object.keys(lists[c]).sort(byName)]));

writeFileSync(join(outDir, 'srd-spells.json'), JSON.stringify(data, null, 2));
writeFileSync(
  join(outDir, 'srd-spell-lists.json'),
  JSON.stringify({ source: 'SRD 5.1, Spell Lists, pages 105-113', classes: classLists }, null, 2),
);
console.log(`${data.length} spells, ${CLASSES.length} class lists: ${CLASSES.join(', ')}`);
for (const s of spells) console.log(`page ${s.page}\t${s.name}`);

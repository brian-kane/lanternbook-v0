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
  // U+00AD soft hyphen, U+2010 hyphen, U+2011 non-breaking hyphen, written as escapes so they show.
  let s = text;
  for (const run of [
    '-\u00ad\u2010\u2011',
    '-\u00ad\u2010',
    '\u00ad\u2010\u2011',
    '\u2010\u2011',
  ]) {
    s = s.replaceAll(run, '-');
  }
  return s.replaceAll('\u00ad', '').replaceAll('\u2011', '-').replaceAll('\u2010', '-');
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
      cur.items.push(it);
    } else {
      const start = { text: it.s, end: it.x + it.w, items: [it] };
      cur = { p: it.p, y: it.y, x: it.x, h: it.h, f: it.f, ...start };
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

// Tables use their own fonts: a bold caption (12 pt), bold column headings and plain cells (8.9 pt).
const TABLE_FONTS = ['g_d0_f4', 'g_d0_f8'];
const HEADING_FONT = 'g_d0_f8';
// A cell may start a little left of its heading, where the heading is centred over it.
const COLUMN_SLACK = 4;

/** Joins items left to right, adding a space only where the PDF leaves a gap. */
function joinItems(items) {
  let text = '';
  let end = null;
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    if (end !== null && it.x - end > 1.0 && !text.endsWith(' ') && !it.s.startsWith(' ')) {
      text += ' ';
    }
    text += it.s;
    end = it.x + it.w;
  }
  return clean(text).trim();
}

const joinWrapped = (cell, more) =>
  cell === '' ? more : cell + (cell.endsWith('-') ? '' : ' ') + more;

/**
 * Builds tables from a spell's table lines. Columns come from the headings: headings stacked
 * over one another (Teleport) are one column. A visual line with a cell in every column starts a
 * row; a line with fewer cells continues the row above, as wrapped cells do. Positions are
 * measured from the page column's left edge, so a table that continues in the next page column
 * (Confusion) keeps its columns.
 */
function readTables(name, tableLines) {
  const groups = [];
  let caption = null;
  for (const l of tableLines) {
    const isCaption = l.f === HEADING_FONT && l.h >= 10;
    const isHeading = l.f === HEADING_FONT && l.h < 10;
    if (isCaption) {
      caption = l.text.trim();
      continue;
    }
    const current = groups.at(-1);
    if (!current || caption !== null || (isHeading && current.body.length > 0)) {
      groups.push({ caption, heading: [], body: [] });
      caption = null;
    }
    const items = l.items
      .filter((it) => it.s.trim() !== '')
      .map((it) => ({ ...it, col: l.col, rx: it.x - BASE[l.col] }));
    groups.at(-1)[isHeading ? 'heading' : 'body'].push(...items);
  }
  if (caption !== null) throw new Error(`${name}: table caption "${caption}" has no table`);

  return groups.map(({ caption: title, heading, body }, n) => {
    const where = `${name}, table ${n + 1}`;
    if (heading.length === 0 || body.length === 0)
      throw new Error(`${where}: no headings or no cells`);

    // Overlapping headings form one column, read top line first.
    const columns = [];
    for (const it of [...heading].sort((a, b) => a.rx - b.rx)) {
      const last = columns.at(-1);
      if (last && it.rx <= last.right) {
        last.items.push(it);
        last.right = Math.max(last.right, it.rx + it.w);
      } else columns.push({ left: it.rx, right: it.rx + it.w, items: [it] });
    }
    const header = columns.map((c) => {
      const ys = [...new Set(c.items.map((it) => it.y))].sort((a, b) => b - a);
      return ys.map((y) => joinItems(c.items.filter((it) => it.y === y))).join(' ');
    });
    const columnOf = (it) => {
      let index = 0;
      columns.forEach((c, i) => {
        if (it.rx >= c.left - COLUMN_SLACK) index = i;
      });
      return index;
    };

    // Visual lines in reading order: page, page column, top to bottom.
    const byLine = new Map();
    for (const it of body) {
      const key = `${it.p}|${it.col}|${it.y}`;
      if (!byLine.has(key)) byLine.set(key, { p: it.p, col: it.col, y: it.y, items: [] });
      byLine.get(key).items.push(it);
    }
    const visual = [...byLine.values()].sort((a, b) => a.p - b.p || a.col - b.col || b.y - a.y);
    const rows = [];
    for (const line of visual) {
      const cells = columns.map((_, i) => joinItems(line.items.filter((it) => columnOf(it) === i)));
      if (cells.every((cell) => cell !== '')) rows.push(cells);
      else if (rows.length === 0) throw new Error(`${where}: first row is not complete`);
      else {
        const row = rows.at(-1);
        cells.forEach((cell, i) => {
          if (cell !== '') row[i] = joinWrapped(row[i], cell);
        });
      }
    }
    return { ...(title === null ? {} : { caption: title }), header, rows };
  });
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

  // Paragraphs start indented; bullets start their own lines. Table lines become structured
  // tables instead of text, and end the paragraph before them.
  const paras = [];
  const kinds = [];
  const tableLines = [];
  for (const l of lines.slice(i)) {
    const t = l.text.trim();
    if (!t) continue;
    const indent = l.x > BASE[l.col] + 5;
    if (TABLE_FONTS.includes(l.f)) {
      tableLines.push(l);
      if (kinds.at(-1) !== 'table') {
        paras.push('');
        kinds.push('table');
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
  const text = paras.filter((para) => para !== '').join('\n\n');
  const tables = readTables(name, tableLines);
  return { ...rec, text, ...(tables.length > 0 ? { tables } : {}), page };
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
    ...(s.tables ? { tables: s.tables } : {}),
  }));
const classLists = Object.fromEntries(CLASSES.map((c) => [c, Object.keys(lists[c]).sort(byName)]));

writeFileSync(join(outDir, 'srd-spells.json'), JSON.stringify(data, null, 2));
writeFileSync(
  join(outDir, 'srd-spell-lists.json'),
  JSON.stringify({ source: 'SRD 5.1, Spell Lists, pages 105-113', classes: classLists }, null, 2),
);
console.log(`${data.length} spells, ${CLASSES.length} class lists: ${CLASSES.join(', ')}`);
for (const s of spells) console.log(`page ${s.page}\t${s.name}`);

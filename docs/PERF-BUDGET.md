# Performance budget

`pnpm perf` (CI job `perf-budget`) sums the gzipped size of the JavaScript that `dist/index.html` loads at startup, from its script tags and modulepreload links, and fails above the ceiling in [perf-budget.json](../perf-budget.json). It also fails if the build output is missing or loads no scripts.

**Ceiling: 150 KiB gzip.** It is a deliberate ceiling, not the current size plus a margin. The empty app measures about 24 KiB. The ceiling is meant to be roughly what a phone on a slow connection can load and start in a couple of seconds, leaving room for the rules engine, character data and a few screens. It is a placeholder to be tuned in the first session that adds real features: lower it if the app lands far below, and raise it only with a recorded reason.

The service worker and its precache files are not counted: they load after startup.

## Data that loads on demand

`notAtStartup` in [perf-budget.json](../perf-budget.json) lists data files that must never be in a startup script. For each one, `pnpm perf` takes a 40-character run of plain text from the file and fails if a startup script contains it. It also fails if no built script contains it at all, because then it cannot see where the data loads, and if the list is missing or empty.

The SRD spell data (`src/spells/data/srd-spells.json`, about 89 KiB gzip) is listed. It loads when the Spells tab opens. The size ceiling alone would not catch it moving into startup: proven on 2026-10-13, a static import made startup 118.5 KiB, still under 150 KiB, and only this check failed.

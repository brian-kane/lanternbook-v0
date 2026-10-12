# Performance budget

`pnpm perf` (CI job `perf-budget`) sums the gzipped size of the JavaScript that `dist/index.html` loads at startup, from its script tags and modulepreload links, and fails above the ceiling in [perf-budget.json](../perf-budget.json). It also fails if the build output is missing or loads no scripts.

**Ceiling: 150 KiB gzip.** It is a deliberate ceiling, not the current size plus a margin. The empty app measures about 24 KiB. The ceiling is meant to be roughly what a phone on a slow connection can load and start in a couple of seconds, leaving room for the rules engine, character data and a few screens. It is a placeholder to be tuned in the first session that adds real features: lower it if the app lands far below, and raise it only with a recorded reason.

The service worker and its precache files are not counted: they load after startup.

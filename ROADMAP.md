# Roadmap

## End goal

A local-first D&D companion at a link, used by me and a friend at the table. Only SRD 5.1 and my own-words content ships in the repo; private content is pasted in and kept in browser storage only (see [docs/CONTENT-POLICY.md](docs/CONTENT-POLICY.md)).

lanternbook is the long-term successor to dnd-command-hub, built one slice at a time. Each slice replaces something I do in Command Hub, and it is finished when I use it at a session. dnd-command-hub stays the table app, frozen except for fixes, until I stop opening it at sessions.

**Stop rule:** after slice 2, if I did not use it at a session, re-decide before building more.

## Done

- **Slice 1a - Widget board.** Paste a counter or checklist spec to add a widget, short and long rests, one-tap undo, saved in browser storage. Live at <https://brian-kane.github.io/lanternbook/>.

## Now

- **Slice 2 - Spell lookup.** Read-only and desktop-first.
  - Only SRD 5.1 spells are in the repo.
  - Search by name; filter by level and school.
  - One card per spell: casting time, range, components, duration and text.
  - Private spells I paste in are kept in browser storage only, never in the repo.
  - Finish line: I use it at one session next to the old app.

## Next

Order decided after slice 2.

- Live HP.
- Conditions as display-only modifiers.
- A companion stat block.

## Later

- Describe-in-words input. It needs an LLM call, with an API key and a running cost: that is a revisit trigger, not a default.
- Export and import.

## Out of scope

- Gmail or DM email sync.
- Leveling.
- Feat browser.
- Journal.
- Character stats grid.
- Full beast browser.

# Roadmap

## End goal

A local-first D&D companion at a link, used by me and a friend at the table. Only SRD 5.1 and my own-words content ships in the repo; private content is pasted in and kept in browser storage only (see [docs/CONTENT-POLICY.md](docs/CONTENT-POLICY.md)).

lanternbook is the long-term successor to dnd-command-hub, built one slice at a time. Each slice replaces something I do in Command Hub, and it is finished when it passes a desk rehearsal. dnd-command-hub stays the table app, frozen except for fixes, until I stop opening it at sessions.

**Finish line: desk rehearsal.** I replay one real round of combat from a past session in lanternbook alone, with dnd-command-hub closed, and note every moment I would switch back. Those notes pick the next slice. I will not use lanternbook at a session until it is more useful than dnd-command-hub.

**Stop rule:** after slice 2, if I have not done its desk rehearsal, re-decide before building more. The rule applies to the rehearsal, not to using lanternbook at a session.

## Switchover checklist

What I use in a session. I edit this list; nothing is added to it without my say. Switchover means every item I keep on the list works in lanternbook.

- Live HP: built (rehearsed once).
- Temp HP.
- Spell slots by level: built (rehearsed once).
- Resource counters (Wild Shape uses and the like): built (rehearsed once).
- Short and long rest: built (rehearsed once).
- Spell text lookup: built (rehearsed once).
- Prepared spell list: built (rehearsed once).
- Wild Shape current form and its HP.
- Companion stat block.
- Homebrew items.
- Conditions as display-only modifiers.

## Done

- **Slice 1a - Widget board.** Paste a counter or checklist spec to add a widget, short and long rests, one-tap undo, saved in browser storage. Live at <https://brian-kane.github.io/lanternbook/>.

## Now

- **Slice 4 - temp HP, Prepare button, New counter form.**
- **Slice 3 - Table sidebar:** built, deployed and rehearsed once; rehearsal notes pending.
- **Slice 2 - Spell lookup:** built and deployed, waiting on its desk rehearsal.

## Next

Order decided after slice 4.

- Wild Shape current form and its HP.
- A companion stat block.
- Homebrew items.
- Conditions as display-only modifiers.

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

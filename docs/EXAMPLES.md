# Example widget specs

For a counter, the **New counter** form on the **Board** tab is easiest: name, max, what refills it, an optional starting value and a **Hit points** box. It builds the same spec shown below and checks it the same way. For anything else, paste one of these under **Advanced: paste a spec** and press **Add widget**. Widgets appear in the sidebar on the left, which stays on screen on both tabs. All three are also the starting fixtures for the tests (`src/widgets/fixtures/`), and a test fails if this page and the fixtures drift apart.

## Counter

A counter has a `value` from 0 to `max`, with + and − buttons. `reset` says which rest refills it: `"short"` (a short or a long rest), `"long"` (a long rest only) or `"none"`.

```json
{
  "version": 1,
  "kind": "counter",
  "name": "Lantern oil flasks",
  "value": 3,
  "max": 3,
  "reset": "long"
}
```

## Checklist

A checklist is a list of items to tick off. Rests leave it alone.

```json
{
  "version": 1,
  "kind": "checklist",
  "name": "Before we leave town",
  "items": [
    { "text": "Buy rope", "done": false },
    { "text": "Refill waterskins", "done": false },
    { "text": "Pay the innkeeper", "done": true }
  ]
}
```

## Hit points

A counter with `"hp": true` is your hit points. It sits in the sidebar with a box for an amount and **Damage** and **Heal** buttons: damage stops at 0 and healing stops at `max`. With `"reset": "long"`, a long rest refills it.

Hit points counters also show **Temp HP** with its own amount box and a **Gain temp HP** button. The rules (one home: `src/rules/hp.ts`, with golden cases):

- Damage comes off temp HP first; whatever is left reduces current HP, which stops at 0.
- Healing raises current HP up to `max` and never restores temp HP.
- Temp HP does not stack: gaining keeps the higher of the old and the new amount, and a message says which was kept.
- A long rest clears temp HP; a short rest does not. Temp HP never changes `max`.
- Amounts are whole numbers from 0 to 999.

A saved hit points counter may carry `"temp"` (a whole number from 0 to 999); without it, temp HP is 0. `"temp"` is only allowed together with `"hp": true`.

```json
{
  "version": 1,
  "kind": "counter",
  "name": "Hit points",
  "value": 27,
  "max": 27,
  "reset": "long",
  "hp": true
}
```

Spell slots and other resources are plain counters, one per slot level, such as `"name": "Level 1 slots"` with `"reset": "long"` (or `"short"` for slots that come back on a short rest).

## Undo

**Undo** goes back to the state just before the last **Add**, **Short rest**/**Long rest**, **Damage**, **Heal** or **Gain temp HP**, including any +/− and ticks made since. Taps on +/− and ticks are not undone one at a time, and a rest, damage, heal or temp HP gain that changes nothing is not recorded (damage that only uses up temp HP is recorded). The button names what it will undo, such as **Undo add: Lantern oil flasks**, **Undo long rest** or **Undo damage 7: Hit points**. The app keeps the last 20 of these.

## Limits

- `version` must be `1`.
- `name` and item `text`: not empty; up to 60 and 120 characters.
- `max`: a whole number from 1 to 999. `value`: a whole number from 0 to `max`.
- A checklist has 1 to 50 items, and `done` is `true` or `false`.
- Any other field is rejected, so a typo is caught instead of ignored.

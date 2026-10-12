# Example widget specs

Paste one of these into the box at the top of the app and press **Add**. Both are also the starting fixtures for the tests (`src/widgets/fixtures/`), and a test fails if this page and the fixtures drift apart.

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

## Limits

- `version` must be `1`.
- `name` and item `text`: not empty; up to 60 and 120 characters.
- `max`: a whole number from 1 to 999. `value`: a whole number from 0 to `max`.
- A checklist has 1 to 50 items, and `done` is `true` or `false`.
- Any other field is rejected, so a typo is caught instead of ignored.

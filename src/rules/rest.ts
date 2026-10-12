// The rest rule, and its only home. A short rest refills counters that reset on a short rest; a
// long rest refills those and the ones that reset on a long rest. "none" counters and checklists
// are never touched. Golden cases: fixtures/rest-cases.json.
import type { ResetKind, Widget } from '../widgets/spec';

export type RestKind = 'short' | 'long';

const REFILLS: Record<RestKind, readonly ResetKind[]> = {
  short: ['short'],
  long: ['short', 'long'],
};

/** Returns a new list; the input is not changed. Unchanged widgets keep their identity. */
export function applyRest(widgets: readonly Widget[], rest: RestKind): Widget[] {
  return widgets.map((widget) =>
    widget.kind === 'counter' && REFILLS[rest].includes(widget.reset) && widget.value !== widget.max
      ? { ...widget, value: widget.max }
      : widget,
  );
}

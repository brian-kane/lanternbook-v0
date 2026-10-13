// The rest rule, and its only home. A short rest refills counters that reset on a short rest; a
// long rest refills those and the ones that reset on a long rest. "none" counters and checklists
// are never touched. What a rest does to temp HP is the hit point rule's (hp.ts). Golden cases:
// fixtures/rest-cases.json.
import { withHp, type ResetKind, type Widget } from '../widgets/spec';
import { restTemp } from './hp';

export type RestKind = 'short' | 'long';

const REFILLS: Record<RestKind, readonly ResetKind[]> = {
  short: ['short'],
  long: ['short', 'long'],
};

/** Returns a new list; the input is not changed. Unchanged widgets keep their identity. */
export function applyRest(widgets: readonly Widget[], rest: RestKind): Widget[] {
  return widgets.map((widget) => {
    if (widget.kind !== 'counter') return widget;
    const refill = REFILLS[rest].includes(widget.reset) && widget.value !== widget.max;
    const temp = widget.temp ?? 0;
    const tempAfter = restTemp({ value: widget.value, max: widget.max, temp }, rest).temp;
    if (!refill && tempAfter === temp) return widget;
    return withHp(widget, refill ? widget.max : widget.value, tempAfter);
  });
}

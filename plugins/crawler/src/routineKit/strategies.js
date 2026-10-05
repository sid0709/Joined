/**
 * Strategies: how a routine moves through a site. Each pass of a run produces one record.
 * A strategy names its step phases; the runner (runner.js) knows how to run each kind.
 */

/** The step lists each strategy kind takes, in the order a pass runs them. */
export const STRATEGY_PHASES = Object.freeze({
  listDetail: ["open", "ready", "dismiss", "settle"],
});

/**
 * A list of items where each one opens a detail view:
 * `open` the next item → `ready` (wait for the detail) → read the fields →
 * `dismiss` the item → `settle`.
 *
 * `dismiss` runs even when the record is rejected, so the next pass never reopens the
 * same item. It must remove the item from the list (or close it so the next one is first).
 */
export const listDetail = ({ open = [], ready = [], dismiss = [], settle = [] }) => ({
  kind: "listDetail",
  open,
  ready,
  dismiss,
  settle,
});

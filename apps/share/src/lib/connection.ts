/**
 * Network-aware prefetch margin decision.
 *
 * Slow networks / data-saver users get a smaller sentinel rootMargin so we
 * pre-fetch fewer pages ahead of the scroll position.
 */

export interface NetworkLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

const DEFAULT_ROOT_MARGIN = "200% 0%";
const SLOW_ROOT_MARGIN = "100% 0%";

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

/**
 * Decide the sentinel rootMargin from a NetworkInformation-like object.
 * Pure — safe to unit test and to call with undefined (SSR / old browsers).
 */
export function decideRootMargin(conn?: NetworkLike | null): string {
  if (!conn) return DEFAULT_ROOT_MARGIN;
  if (conn.saveData === true) return SLOW_ROOT_MARGIN;
  if (conn.effectiveType && SLOW_TYPES.has(conn.effectiveType)) return SLOW_ROOT_MARGIN;
  return DEFAULT_ROOT_MARGIN;
}

/** Read the browser NetworkInformation API if available. */
export function readNetwork(): NetworkLike | null {
  const nav = navigator as Navigator & { connection?: NetworkLike };
  return nav.connection ?? null;
}

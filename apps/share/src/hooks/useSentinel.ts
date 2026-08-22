/**
 * useSentinel — IntersectionObserver hook for infinite scroll.
 *
 * Observes a sentinel element and calls `onIntersect` when it enters
 * the viewport (with configurable rootMargin for pre-fetching).
 *
 * Uses ~2 viewport rootMargin to trigger loading before the user reaches
 * the bottom, per architecture budget.
 */
import { useEffect, useRef, type RefObject } from "react";

export interface UseSentinelOptions {
  /** Callback when sentinel enters viewport. */
  onIntersect: () => void;
  /** Whether the observer should be active. Default true. */
  enabled?: boolean;
  /** Root margin for pre-fetching. Default "200% 0%" (~2 viewports). */
  rootMargin?: string;
  /** Intersection ratio threshold. Default 0. */
  threshold?: number;
}

export function useSentinel(
  sentinelRef: RefObject<HTMLElement>,
  options: UseSentinelOptions,
): void {
  const { onIntersect, enabled = true, rootMargin = "200% 0%", threshold = 0 } = options;
  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [enabled, rootMargin, threshold, sentinelRef]);
}

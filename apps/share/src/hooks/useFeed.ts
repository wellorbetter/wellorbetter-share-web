/**
 * useFeed — manages opaque-cursor paginated feed with:
 *   - AbortController cancellation on tab switch / unmount
 *   - Single-flight lock (no concurrent fetches for the same feed)
 *   - Request dedup (same cursor → skip)
 *   - Finite window (cap mounted items, drop oldest with spacer height)
 *   - loading / empty / error / exhausted state machine
 *
 * Does NOT render — returns data + callbacks for the view layer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedType, ProjectCard } from "@wellorbetter/shared";
import { PROJECT_FEED_DEFAULT_LIMIT } from "@wellorbetter/shared";
import { fetchFeed } from "../feedApi.js";

export type FeedStatus = "idle" | "loading" | "success" | "empty" | "error" | "exhausted";

export interface FeedState {
  items: ProjectCard[];
  status: FeedStatus;
  error: string | null;
  /** Estimated pixel height of items dropped from the top (for spacer). */
  topSpacerPx: number;
  /** Total items loaded before windowing dropped the oldest. */
  totalLoaded: number;
}

export interface UseFeedOptions {
  feed: FeedType;
  tag?: string;
  authorId?: string;
  /** Max items kept in DOM. Oldest are dropped when exceeded. Default 80. */
  windowSize?: number;
  /** Assumed average card height in px for spacer estimation. Default 280. */
  estimatedCardHeight?: number;
}

export interface UseFeedResult extends FeedState {
  /** Trigger next page load. No-op if already loading or exhausted. */
  loadMore: () => void;
  /** Reset and reload (e.g. after tab switch). */
  reload: () => void;
  /** Whether a fetch is currently in flight. */
  isLoading: boolean;
}

/** Estimated average card height used for top-spacer calculation. */
const DEFAULT_CARD_HEIGHT = 280;
/** Default finite window — keeps DOM bounded. */
const DEFAULT_WINDOW = 80;

export function useFeed(opts: UseFeedOptions): UseFeedResult {
  const {
    feed,
    tag,
    authorId,
    windowSize = DEFAULT_WINDOW,
    estimatedCardHeight = DEFAULT_CARD_HEIGHT,
  } = opts;

  const [state, setState] = useState<FeedState>({
    items: [],
    status: "idle",
    error: null,
    topSpacerPx: 0,
    totalLoaded: 0,
  });

  // Refs for single-flight + dedup + abort
  const cursorRef = useRef<string | null>(null);
  const inflightRef = useRef(false);
  const lastCursorFetchedRef = useRef<string | null | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const totalLoadedRef = useRef(0);
  const allItemsRef = useRef<ProjectCard[]>([]);

  // Feed identity — changes trigger reset
  const feedKey = `${feed}:${tag ?? ""}:${authorId ?? ""}`;
  const prevFeedKeyRef = useRef(feedKey);
  /** Feed identity that has been initially loaded (survives status staleness). */
  const loadedFeedKeyRef = useRef<string | null>(null);

  const cancelInflight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    inflightRef.current = false;
  }, []);

  const doFetch = useCallback(
    async (cursor: string | null) => {
      // Dedup: same cursor already fetched → skip
      if (lastCursorFetchedRef.current === cursor && cursor !== null) {
        return;
      }
      // Single-flight: already fetching → skip
      if (inflightRef.current) return;

      inflightRef.current = true;
      lastCursorFetchedRef.current = cursor;
      const controller = new AbortController();
      abortRef.current = controller;

      if (mountedRef.current) {
        setState((s) => ({ ...s, status: s.items.length === 0 ? "loading" : s.status, error: null }));
      }

      try {
        const res = await fetchFeed({
          feed,
          tag,
          authorId,
          cursor,
          limit: PROJECT_FEED_DEFAULT_LIMIT,
          signal: controller.signal,
        });

        if (!mountedRef.current) return;

        const newItems = res.items;
        totalLoadedRef.current += newItems.length;
        allItemsRef.current = [...allItemsRef.current, ...newItems];
        cursorRef.current = res.nextCursor;

        // Finite windowing: drop oldest if over capacity
        let droppedCount = 0;
        if (allItemsRef.current.length > windowSize) {
          droppedCount = allItemsRef.current.length - windowSize;
          allItemsRef.current = allItemsRef.current.slice(droppedCount);
        }

        const isExhausted = res.nextCursor === null;
        const isEmpty = totalLoadedRef.current === 0 && newItems.length === 0;

        setState({
          items: allItemsRef.current,
          status: isEmpty ? "empty" : isExhausted ? "exhausted" : "success",
          error: null,
          topSpacerPx: droppedCount > 0 ? state.topSpacerPx + droppedCount * estimatedCardHeight : state.topSpacerPx,
          totalLoaded: totalLoadedRef.current,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        // AbortError is expected on tab switch / unmount — don't surface as error
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "加载失败";
        setState((s) => ({
          ...s,
          status: s.items.length > 0 ? "success" : "error",
          error: message,
        }));
      } finally {
        inflightRef.current = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [feed, tag, authorId, windowSize, estimatedCardHeight, state.topSpacerPx],
  );

  // Reset on feed identity change
  useEffect(() => {
    if (prevFeedKeyRef.current !== feedKey) {
      prevFeedKeyRef.current = feedKey;
      cancelInflight();
      cursorRef.current = null;
      lastCursorFetchedRef.current = undefined;
      totalLoadedRef.current = 0;
      allItemsRef.current = [];
      setState({
        items: [],
        status: "idle",
        error: null,
        topSpacerPx: 0,
        totalLoaded: 0,
      });
    }
  }, [feedKey, cancelInflight]);

  // Initial load — keyed by feed identity, not transient status (which is
  // stale during the same commit as the reset effect above).
  useEffect(() => {
    if (loadedFeedKeyRef.current !== feedKey && !inflightRef.current) {
      loadedFeedKeyRef.current = feedKey;
      void doFetch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKey]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelInflight();
    };
  }, [cancelInflight]);

  const loadMore = useCallback(() => {
    if (inflightRef.current) return;
    if (cursorRef.current === null && state.status !== "idle") return; // exhausted
    void doFetch(cursorRef.current);
  }, [doFetch, state.status]);

  const reload = useCallback(() => {
    cancelInflight();
    cursorRef.current = null;
    lastCursorFetchedRef.current = undefined;
    totalLoadedRef.current = 0;
    allItemsRef.current = [];
    setState({
      items: [],
      status: "idle",
      error: null,
      topSpacerPx: 0,
      totalLoaded: 0,
    });
    // Trigger initial load on next tick
    setTimeout(() => {
      if (mountedRef.current) {
        void doFetch(null);
      }
    }, 0);
  }, [cancelInflight, doFetch]);

  return {
    ...state,
    loadMore,
    reload,
    isLoading: state.status === "loading" || inflightRef.current,
  };
}

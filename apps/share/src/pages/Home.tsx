/**
 * Home page — public project discovery feed.
 *
 * Composes Masonry + FeedStatus with:
 * - Single "latest" feed (no tab switching in this phase)
 * - Infinite scroll via IntersectionObserver sentinel
 * - Finite windowing to bound DOM growth
 * - Network-aware prefetch margin (saveData / slow connections pre-fetch less)
 * - Auth-aware empty state with publish CTA
 */
import { useMemo, useRef } from "react";
import { FeedCard } from "../components/FeedCard.js";
import { FeedStatus } from "../components/FeedStatus.js";
import { Masonry } from "../components/Masonry.js";
import { useFeed } from "../hooks/useFeed.js";
import { useSentinel } from "../hooks/useSentinel.js";
import { decideRootMargin, readNetwork } from "../lib/connection.js";

export interface HomePageProps {
  /** Whether the viewer has a session (empty-state CTA). */
  isAuthed?: boolean;
  /** Navigate to the publish page. */
  onPublish?: () => void;
  /** Navigate to the login page. */
  onLogin?: () => void;
  /** Navigate to a project detail page (/p/:slug). */
  onOpenProject?: (slug: string) => void;
}

export function HomePage({ isAuthed = false, onPublish, onLogin, onOpenProject }: HomePageProps) {
  const feed = useFeed({
    feed: "latest",
    windowSize: 80,
    estimatedCardHeight: 280,
  });

  const sentinelRef = useRef<HTMLDivElement>(null!);

  // Network-aware prefetch: reduce rootMargin on saveData / slow connections.
  const rootMargin = useMemo(() => decideRootMargin(readNetwork()), []);

  // Wire up sentinel to loadMore
  useSentinel(sentinelRef, {
    onIntersect: feed.loadMore,
    enabled: feed.status !== "exhausted" && feed.status !== "error",
    rootMargin,
  });

  const showSentinel = feed.status !== "exhausted" && feed.items.length > 0;
  const showStatus = feed.status !== "success" && feed.status !== "exhausted";

  return (
    <div className="home-page">
      {feed.items.length === 0 && showStatus ? (
        <FeedStatus
          status={feed.status}
          error={feed.error}
          onRetry={feed.reload}
          isAuthed={isAuthed}
          onPublish={onPublish}
          onLogin={onLogin}
        />
      ) : (
        <>
          <Masonry
            topSpacerPx={feed.topSpacerPx}
            sentinelRef={sentinelRef}
            showSentinel={showSentinel}
            loadingIndicator={
              feed.isLoading && feed.items.length > 0 ? (
                <div className="feed-loading-more" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <span>加载中…</span>
                </div>
              ) : null
            }
          >
            {feed.items.map((card) => (
              <FeedCard key={card.id} card={card} onOpen={onOpenProject} />
            ))}
          </Masonry>

          {/* Show exhausted state after items */}
          {feed.status === "exhausted" && <FeedStatus status="exhausted" error={null} />}

          {/* Show error state after items if error occurred during load-more */}
          {feed.status === "error" && feed.items.length > 0 && (
            <FeedStatus status="error" error={feed.error} onRetry={feed.loadMore} />
          )}
        </>
      )}
    </div>
  );
}

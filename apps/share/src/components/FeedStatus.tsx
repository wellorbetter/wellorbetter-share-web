/**
 * FeedStatus — loading / empty / error / exhausted state displays.
 *
 * T305: skeleton grid aligned with Masonry columns, empty state with a
 * publish CTA (auth-aware), retry on error, video-safe placeholders.
 * All animations respect prefers-reduced-motion (see styles.css).
 */
import type { FeedStatus as FeedStatusName } from "../hooks/useFeed.js";

export interface FeedStatusProps {
  status: FeedStatusName;
  error: string | null;
  onRetry?: () => void;
  /** Whether the viewer has a session (controls empty-state CTA). */
  isAuthed?: boolean;
  /** Navigate to the publish page / login page. */
  onPublish?: () => void;
  /** Navigate to the login page. */
  onLogin?: () => void;
}

export function FeedStatus({
  status,
  error,
  onRetry,
  isAuthed = false,
  onPublish,
  onLogin,
}: FeedStatusProps) {
  if (status === "loading") {
    return <FeedLoading />;
  }
  if (status === "empty") {
    return <FeedEmpty isAuthed={isAuthed} onPublish={onPublish} onLogin={onLogin} />;
  }
  if (status === "error") {
    return <FeedError message={error ?? "加载失败"} onRetry={onRetry} />;
  }
  if (status === "exhausted") {
    return <FeedExhausted />;
  }
  return null;
}

function FeedLoading() {
  // Skeleton cards — count matches a full row on desktop (3 cols × 2 rows).
  return (
    <div className="feed-status feed-loading" aria-live="polite" aria-label="加载中">
      <div className="feed-skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="feed-skeleton-card" aria-hidden="true">
            <div className="feed-skeleton-cover" />
            <div className="feed-skeleton-line" />
            <div className="feed-skeleton-line feed-skeleton-line--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedEmpty({
  isAuthed,
  onPublish,
  onLogin,
}: {
  isAuthed: boolean;
  onPublish?: () => void;
  onLogin?: () => void;
}) {
  return (
    <div className="feed-status feed-empty" role="status">
      <p className="feed-status-title">还没有作品</p>
      <p className="feed-status-hint">
        {isAuthed
          ? "把你的第一个 vibe coding 作品发布上来吧"
          : "登录后发布你的第一个 vibe coding 作品"}
      </p>
      {(onPublish ?? onLogin) && (
        <button
          type="button"
          className="primary-btn"
          onClick={isAuthed ? onPublish : onLogin}
        >
          {isAuthed ? "发布第一个作品" : "登录并发布作品"}
        </button>
      )}
    </div>
  );
}

function FeedError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="feed-status feed-error" role="alert">
      <p className="feed-status-title">加载失败</p>
      <p className="feed-status-hint">{message}</p>
      {onRetry && (
        <button type="button" className="ghost-btn" onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}

function FeedExhausted() {
  return (
    <div className="feed-status feed-exhausted" role="status" aria-live="polite">
      <p className="feed-status-hint">已经到底了</p>
    </div>
  );
}

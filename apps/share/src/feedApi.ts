/**
 * Feed API facade — Web-side client for the public project feed.
 *
 * Talks to `GET /api/projects?feed=…&tag=&authorId=&cursor=&limit=`.
 * Returns opaque-cursor paginated results. Does NOT access D1/R2 directly.
 *
 * Supports AbortController signal for cancellation on tab switch / unmount.
 */
import type { FeedCursorResponse, FeedType, ProjectCard } from "@wellorbetter/shared";
import { PROJECT_FEED_DEFAULT_LIMIT } from "@wellorbetter/shared";

/** API base — mirrors the convention in ./api.ts */
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.PROD ? "https://api.wellorbetterai.com" : "");

export interface FeedRequest {
  feed: FeedType;
  tag?: string;
  authorId?: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Fetch a single page of the public project feed.
 *
 * The cursor is opaque — the client never interprets it.
 * `nextCursor === null` means the feed is exhausted.
 */
export async function fetchFeed(
  req: FeedRequest,
): Promise<FeedCursorResponse<ProjectCard>> {
  const params = new URLSearchParams();
  params.set("feed", req.feed);
  if (req.tag) params.set("tag", req.tag);
  if (req.authorId) params.set("authorId", req.authorId);
  if (req.cursor) params.set("cursor", req.cursor);
  params.set("limit", String(req.limit ?? PROJECT_FEED_DEFAULT_LIMIT));

  const res = await fetch(`${API_BASE}/api/projects?${params}`, {
    signal: req.signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let code = "unknown";
    let message = "feed request failed";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* body not JSON — ignore */
    }
    const err = new Error(message) as FeedApiError;
    err.code = code;
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as FeedCursorResponse<ProjectCard>;
}

export interface FeedApiError extends Error {
  code: string;
  status: number;
}

/**
 * Project Showcase — configuration contracts for URL policy, SSRF / private-IP
 * defence, media whitelist, feed opaque cursor, rate limits and expiry strategy.
 *
 * THIS FILE MUST BE BYTE-IDENTICAL in both repos:
 *   wellorbetter-api/packages/shared/src/project-policy.ts
 *   wellorbetter-share-web/packages/shared/src/project-policy.ts
 *
 * A CI contract check verifies identity by SHA-256 hash.
 *
 * Scope (T003):
 *   - Pure configuration types + default values.
 *   - Pure validation helpers (no I/O, no Cloudflare runtime).
 *   - EXE permanently rejected for direct upload; APK external-link only.
 *
 * NOT in scope: Worker handler implementation, D1/R2/KV access, DNS resolution.
 * The API worker consumes these contracts in T103 / T201–T206.
 */

import type { ReleaseKind } from "./project.js";
import {
  PROJECT_FEED_DEFAULT_LIMIT,
  PROJECT_FEED_MAX_LIMIT,
  PROJECT_MAX_IMAGE_BYTES,
  PROJECT_MAX_VIDEO_BYTES,
  PROJECT_MAX_VIDEO_DURATION_SECONDS,
  PROJECT_BLOCKED_EXTENSIONS,
  REPORT_RATE_LIMIT_PER_MIN,
  PUBLISH_RATE_LIMIT_PER_HOUR,
  MEDIA_REQUEST_RATE_LIMIT_PER_HOUR,
} from "./project.js";

// ─── URL policy ──────────────────────────────────────────────────

/**
 * Configuration for experience / release URL validation.
 *
 * The API worker resolves DNS and follows redirects; this contract only
 * declares the policy parameters. Web reads the same values to render
 * hints (e.g. "only HTTPS links accepted") without re-implementing SSRF
 * checks — the API is the single source of truth for enforcement.
 */
export interface UrlPolicyConfig {
  /** Accepted URL schemes (lowercase, no colon). */
  readonly allowedSchemes: readonly string[];
  /**
   * Explicit host allowlist for experience URLs.
   * Empty array means "any HTTPS host that passes DNS / redirect checks".
   */
  readonly allowedExperienceHosts: readonly string[];
  /** Hosts that are always rejected (e.g. known-bad, internal). */
  readonly blockedHosts: readonly string[];
  /** Maximum URL length in bytes (UTF-8). */
  readonly maxUrlLength: number;
  /** Maximum number of HTTP redirects to follow before rejecting. */
  readonly maxRedirects: number;
  /** Whether non-HTTPS schemes are always rejected. */
  readonly requireHttps: boolean;
  /** Whether RFC 1918 / RFC 4193 / link-local addresses are rejected. */
  readonly rejectPrivateIp: boolean;
  /** Whether loopback (127.0.0.0/8, ::1) is rejected. */
  readonly rejectLocalhost: boolean;
}

/** Default URL policy — strict HTTPS, no private IP, no localhost. */
export const DEFAULT_URL_POLICY: UrlPolicyConfig = {
  allowedSchemes: ["https"],
  allowedExperienceHosts: [],
  blockedHosts: [],
  maxUrlLength: 2048,
  maxRedirects: 3,
  requireHttps: true,
  rejectPrivateIp: true,
  rejectLocalhost: true,
};

// ─── SSRF / private-IP helpers ───────────────────────────────────

/**
 * Typed decision returned by URL validation.
 * `ok: true` means the URL passed all policy checks.
 * `ok: false` carries a machine-readable `reason` for the error response.
 */
export type UrlDecision =
  | { ok: true }
  | { ok: false; reason: UrlRejectReason };

export type UrlRejectReason =
  | "invalid_url"
  | "scheme_not_allowed"
  | "host_blocked"
  | "host_not_allowed"
  | "url_too_long"
  | "private_ip"
  | "localhost"
  | "too_many_redirects";

/**
 * Check whether an IPv4 address (dotted-quad string) falls in a private,
 * loopback, link-local or reserved range.
 *
 * Does NOT perform DNS resolution — the caller must resolve hostnames
 * before calling this helper. Accepts only canonical dotted-quad input.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const n = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) return -1;
    const v = Number(p);
    return v >= 0 && v <= 255 ? v : -1;
  });
  if (n.some((v) => v < 0)) return false;
  const [a, b] = n as [number, number, number, number];
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  return false;
}

/**
 * Check whether an IPv6 address string falls in loopback (::1),
 * unique-local (fc00::/7), or link-local (fe80::/10) range.
 *
 * Accepts simplified forms: full 8-group hex, or ::-compressed.
 * Does NOT parse IPv4-mapped IPv6 exhaustively; callers should
 * normalise addresses before calling.
 */
export function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 loopback
  if (lower === "::1") return true;
  // Unspecified
  if (lower === "::") return true;
  // Extract first hextet for range checks
  const firstGroup = lower.split(":")[0] ?? "";
  if (firstGroup === "") {
    // Leading :: — check second group for fc/fe
    const groups = lower.split(":");
    // Find the first non-empty group after ::
    const firstNonEmpty = groups.find((g) => g !== "");
    if (!firstNonEmpty) return true; // just "::"
    const v = parseInt(firstNonEmpty, 16);
    if (Number.isNaN(v)) return false;
    // fc00::/7 → first 7 bits are 1111 110x
    if ((v & 0xfe00) === 0xfc00) return true;
    // fe80::/10 → first 10 bits are 1111 1110 10xx
    if ((v & 0xffc0) === 0xfe80) return true;
    return false;
  }
  const v = parseInt(firstGroup, 16);
  if (Number.isNaN(v)) return false;
  // fc00::/7
  if ((v & 0xfe00) === 0xfc00) return true;
  // fe80::/10
  if ((v & 0xffc0) === 0xfe80) return true;
  return false;
}

/**
 * Returns true if the IP string (v4 or v6) is considered private / loopback
 * / link-local under the SSRF policy.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) return isPrivateIpv6(ip);
  return isPrivateIpv4(ip);
}

// ─── URL validation (pure, no DNS) ──────────────────────────────

/**
 * Pure syntactic URL check against the policy. Does NOT resolve DNS or
 * follow redirects — those are the API worker's responsibility.
 *
 * Use this at the API boundary for fast rejection before DNS lookup.
 */
export function validateUrlSyntax(
  rawUrl: string,
  config: UrlPolicyConfig = DEFAULT_URL_POLICY,
): UrlDecision {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, reason: "invalid_url" };
  }
  // Length check (UTF-8 byte length)
  const byteLen = new TextEncoder().encode(rawUrl).byteLength;
  if (byteLen > config.maxUrlLength) {
    return { ok: false, reason: "url_too_long" };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (config.requireHttps && scheme !== "https") {
    return { ok: false, reason: "scheme_not_allowed" };
  }
  if (!config.allowedSchemes.includes(scheme)) {
    return { ok: false, reason: "scheme_not_allowed" };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) {
    return { ok: false, reason: "invalid_url" };
  }
  if (config.blockedHosts.includes(host)) {
    return { ok: false, reason: "host_blocked" };
  }
  if (
    config.allowedExperienceHosts.length > 0 &&
    !config.allowedExperienceHosts.includes(host)
  ) {
    return { ok: false, reason: "host_not_allowed" };
  }
  return { ok: true };
}

// ─── Media whitelist ─────────────────────────────────────────────

/**
 * Content-type and extension policy for Project media attachments.
 * SVG and HTML are explicitly denied to prevent inline XSS vectors.
 */
export interface MediaPolicyConfig {
  /** Allowed image content-type prefixes / exact values. */
  readonly allowedImageContentTypes: readonly string[];
  /** Allowed video content-type prefixes / exact values. */
  readonly allowedVideoContentTypes: readonly string[];
  /** Image extensions that are always denied (e.g. svg). */
  readonly deniedImageExtensions: readonly string[];
  /** Video extensions that are always denied. */
  readonly deniedVideoExtensions: readonly string[];
}

/** Default media policy — raster images + MP4/WebM, no SVG/HTML. */
export const DEFAULT_MEDIA_POLICY: MediaPolicyConfig = {
  allowedImageContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  allowedVideoContentTypes: ["video/mp4", "video/webm"],
  deniedImageExtensions: ["svg", "svgz", "html", "htm"],
  deniedVideoExtensions: ["html", "htm", "svg"],
};

/**
 * Check whether a content-type is an allowed image type.
 */
export function isAllowedImageType(
  contentType: string,
  config: MediaPolicyConfig = DEFAULT_MEDIA_POLICY,
): boolean {
  const t = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return config.allowedImageContentTypes.some((allowed) =>
    allowed.endsWith("/") ? t.startsWith(allowed) : t === allowed,
  );
}

/**
 * Check whether a content-type is an allowed video type.
 */
export function isAllowedVideoType(
  contentType: string,
  config: MediaPolicyConfig = DEFAULT_MEDIA_POLICY,
): boolean {
  const t = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return config.allowedVideoContentTypes.some((allowed) =>
    allowed.endsWith("/") ? t.startsWith(allowed) : t === allowed,
  );
}

/**
 * Check whether a file extension is denied for media upload.
 */
export function isDeniedMediaExtension(
  ext: string,
  config: MediaPolicyConfig = DEFAULT_MEDIA_POLICY,
): boolean {
  const lower = ext.toLowerCase();
  return (
    config.deniedImageExtensions.includes(lower) ||
    config.deniedVideoExtensions.includes(lower)
  );
}

// ─── Release policy ──────────────────────────────────────────────

/**
 * Release / build-artifact policy.
 *
 * - `directUploadKinds`: which ReleaseKind values may be uploaded via R2 presign.
 * - `externalLinkOnlyKinds`: which ReleaseKind values may only be referenced by URL.
 * - `permanentlyBlockedExtensions`: file extensions that are NEVER accepted
 *   for direct upload under any circumstance.
 */
export interface ReleasePolicyConfig {
  readonly directUploadKinds: readonly ReleaseKind[];
  readonly externalLinkOnlyKinds: readonly ReleaseKind[];
  readonly permanentlyBlockedExtensions: ReadonlySet<string>;
}

/** Default release policy — no direct upload, APK external-link only, EXE blocked. */
export const DEFAULT_RELEASE_POLICY: ReleasePolicyConfig = {
  directUploadKinds: [],
  externalLinkOnlyKinds: ["apk_external"],
  permanentlyBlockedExtensions: PROJECT_BLOCKED_EXTENSIONS,
};

/**
 * Returns true if the given extension is permanently blocked from direct upload.
 */
export function isPermanentlyBlockedExtension(
  ext: string,
  config: ReleasePolicyConfig = DEFAULT_RELEASE_POLICY,
): boolean {
  return config.permanentlyBlockedExtensions.has(ext.toLowerCase());
}

/**
 * Returns true if the given ReleaseKind is allowed as a direct upload.
 * MVP: empty — no direct uploads of release binaries.
 */
export function isDirectUploadAllowed(
  kind: ReleaseKind,
  config: ReleasePolicyConfig = DEFAULT_RELEASE_POLICY,
): boolean {
  return config.directUploadKinds.includes(kind);
}

// ─── Feed cursor ─────────────────────────────────────────────────

/**
 * Opaque cursor encoding configuration.
 *
 * Cursor format: base64url(JSON({ v: 1, ...opaque-fields })).
 * The API is the only encoder/decoder; Web treats cursors as opaque strings.
 */
export interface FeedCursorConfig {
  /** Cursor format version — bump on breaking changes. */
  readonly version: number;
  /** Maximum cursor byte length (base64url-encoded). */
  readonly maxCursorLength: number;
  /** Cursor TTL in seconds; expired cursors are rejected. */
  readonly cursorTtlSeconds: number;
}

/** Default feed cursor configuration. */
export const DEFAULT_FEED_CURSOR: FeedCursorConfig = {
  version: 1,
  maxCursorLength: 512,
  cursorTtlSeconds: 600, // 10 minutes
};

/**
 * Internal cursor payload — encoded into the opaque string.
 * Not exposed to clients; this type is for API-side encode/decode.
 */
export interface CursorPayload {
  v: number;
  /** Unix-ms timestamp when the cursor was issued. */
  iat: number;
  /** Opaque sort key — meaning depends on feed type. */
  sortKey: string;
  /** Optional secondary key for deterministic ordering. */
  tiebreaker?: string;
}

/**
 * Encode a cursor payload into an opaque base64url string.
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode an opaque cursor string back to a payload.
 * Returns null if the cursor is malformed or has an unsupported version.
 */
export function decodeCursor(
  cursor: string,
  config: FeedCursorConfig = DEFAULT_FEED_CURSOR,
): CursorPayload | null {
  if (!cursor || cursor.length > config.maxCursorLength) return null;
  try {
    const b64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const obj = JSON.parse(json) as CursorPayload;
    if (typeof obj.v !== "number" || obj.v !== config.version) return null;
    if (typeof obj.sortKey !== "string") return null;
    if (typeof obj.iat !== "number") return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Validate a feed limit parameter: clamp to [1, max], default if falsy.
 */
export function clampFeedLimit(
  limit: number | null | undefined,
  config: {
    defaultLimit?: number;
    maxLimit?: number;
  } = {},
): number {
  const def = config.defaultLimit ?? PROJECT_FEED_DEFAULT_LIMIT;
  const max = config.maxLimit ?? PROJECT_FEED_MAX_LIMIT;
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return def;
  return Math.min(Math.floor(limit), max);
}

// ─── Rate-limit policy ───────────────────────────────────────────

/**
 * Typed rate-limit configuration for Project Showcase endpoints.
 *
 * These values are consumed by the KV/D1 rate-limiter in the API worker.
 * Web reads the same constants for client-side backoff hints.
 */
export interface ProjectRateLimitConfig {
  /** Reports per IP per window. */
  readonly report: { limit: number; windowSeconds: number };
  /** Publish attempts per user per window. */
  readonly publish: { limit: number; windowSeconds: number };
  /** Media presign requests per user per window. */
  readonly mediaRequest: { limit: number; windowSeconds: number };
}

/** Default rate-limit configuration — matches design.md §5. */
export const DEFAULT_PROJECT_RATE_LIMITS: ProjectRateLimitConfig = {
  report: { limit: REPORT_RATE_LIMIT_PER_MIN, windowSeconds: 60 },
  publish: { limit: PUBLISH_RATE_LIMIT_PER_HOUR, windowSeconds: 3600 },
  mediaRequest: { limit: MEDIA_REQUEST_RATE_LIMIT_PER_HOUR, windowSeconds: 3600 },
};

// ─── Expiry / cleanup policy ─────────────────────────────────────

/**
 * Expiry and cleanup configuration for Project lifecycle.
 *
 * - `draftExpirySeconds`: how long a draft with no edits stays before Cron purges.
 * - `pendingMediaExpirySeconds`: how long a pending_media project waits before
 *   being considered abandoned.
 * - `orphanCleanupDelaySeconds`: how long after R2 upload before Cron considers
 *   the object orphaned if D1 complete was never called.
 * - `cronBatchSize`: maximum entities processed per Cron invocation.
 * - `removedRetentionSeconds`: how long soft-deleted records are kept before
 *   hard cleanup.
 */
export interface ExpiryPolicyConfig {
  readonly draftExpirySeconds: number;
  readonly pendingMediaExpirySeconds: number;
  readonly orphanCleanupDelaySeconds: number;
  readonly cronBatchSize: number;
  readonly removedRetentionSeconds: number;
}

/** Default expiry policy — matches design.md §3 / §5. */
export const DEFAULT_EXPIRY_POLICY: ExpiryPolicyConfig = {
  draftExpirySeconds: 7 * 24 * 3600, // 7 days
  pendingMediaExpirySeconds: 24 * 3600, // 1 day
  orphanCleanupDelaySeconds: 15 * 60, // 15 minutes
  cronBatchSize: 25,
  removedRetentionSeconds: 30 * 24 * 3600, // 30 days
};

// ─── Media budget summary ─────────────────────────────────────────

/**
 * Aggregated media budget for a single Project.
 * Re-exports the per-item limits from project.ts for convenience.
 */
export const PROJECT_MEDIA_BUDGET = {
  maxImages: 12,
  maxVideos: 2,
  maxCovers: 1,
  maxImageBytes: PROJECT_MAX_IMAGE_BYTES,
  maxVideoBytes: PROJECT_MAX_VIDEO_BYTES,
  maxVideoDurationSeconds: PROJECT_MAX_VIDEO_DURATION_SECONDS,
} as const;

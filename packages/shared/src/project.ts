/**
 * Project Showcase — shared DTOs, enums, constants and stable error codes.
 *
 * THIS FILE MUST BE BYTE-IDENTICAL in both repos:
 *   wellorbetter-api/packages/shared/src/project.ts
 *   wellorbetter-share-web/packages/shared/src/project.ts
 *
 * A CI contract check (contract-check.test.ts / contract-check.mjs)
 * verifies identity by SHA-256 hash.
 *
 * MVP constraints enforced here:
 *   - Web URL, images / short-video, external build links only.
 *   - EXE is permanently rejected; APK is external-link only.
 */

// ─── Status enums ────────────────────────────────────────────────

/** Project lifecycle states (forward only; soft-delete via `removed`). */
export type ProjectStatus =
  | "draft"
  | "pending_media"
  | "published"
  | "rejected"
  | "hidden"
  | "removed";

/** Moderation / report resolution states. */
export type ModerationStatus = "pending" | "reviewed" | "dismissed";

/** Media attachment kind. */
export type MediaType = "image" | "video" | "cover";

/** Public feed variants. */
export type FeedType = "latest" | "random" | "tag" | "author";

/** Visitor-submitted report reason. */
export type ReportReason =
  | "spam"
  | "copyright"
  | "malware"
  | "nsfw"
  | "other";

/** How the experience URL is rendered to visitors. */
export type ExperienceUrlPolicy = "iframe" | "external" | "none";

/** Release / build artifact kind — EXE never allowed, APK external only. */
export type ReleaseKind = "web" | "apk_external" | "none";

/** Moderation actions an admin can take on a project or report. */
export type ModerationAction =
  | "hide"
  | "unhide"
  | "remove"
  | "restore"
  | "dismiss_report"
  | "resolve_report";

/** Auditable action types — covers project, media, report, moderation and admin operations. */
export type AuditAction =
  | "project_created"
  | "project_updated"
  | "project_published"
  | "project_hidden"
  | "project_unhidden"
  | "project_removed"
  | "project_restored"
  | "media_requested"
  | "media_completed"
  | "media_deleted"
  | "report_submitted"
  | "report_dismissed"
  | "report_resolved"
  | "moderation_action"
  | "user_quota_updated"
  | "user_role_updated"
  | "settings_updated";

/** Target entity type for audit events. */
export type AuditTargetType =
  | "project"
  | "media"
  | "report"
  | "user"
  | "settings";

// ─── Stable error codes ──────────────────────────────────────────

export const PROJECT_ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  VALIDATION_FAILED: "validation_failed",
  URL_NOT_ALLOWED: "url_not_allowed",
  MEDIA_TOO_LARGE: "media_too_large",
  QUOTA_EXCEEDED: "quota_exceeded",
  RATE_LIMITED: "rate_limited",
  UNREVIEWED_RELEASE: "unreviewed_release",
  MODERATION_REQUIRED: "moderation_required",
  INVALID_STATE: "invalid_state",
  INTERNAL: "internal",
  DUPLICATE_REPORT: "duplicate_report",
  PROJECT_NOT_PUBLISHABLE: "project_not_publishable",
  MEDIA_NOT_FOUND: "media_not_found",
  CURSOR_EXPIRED: "cursor_expired",
  CURSOR_INVALID: "cursor_invalid",
  LEGACY_UPLOAD_FROZEN: "legacy_upload_frozen",
} as const;

export type ProjectErrorCode =
  (typeof PROJECT_ERROR_CODES)[keyof typeof PROJECT_ERROR_CODES];

// ─── DTOs ────────────────────────────────────────────────────────

/** Feed card summary — safe for public consumption, no private fields. */
export interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  authorId: string;
  authorName: string;
  coverUrl: string | null;
  /** Cover intrinsic dims (denormalized) — enables zero-shift variable-height cards. */
  coverWidth?: number | null;
  coverHeight?: number | null;
  tags: string[];
  status: ProjectStatus;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** A single version / release of a project. */
export interface ProjectVersion {
  id: string;
  projectId: string;
  versionTag: string;
  experienceUrl: string | null;
  experienceUrlPolicy: ExperienceUrlPolicy;
  releaseUrl: string | null;
  releaseKind: ReleaseKind;
  isUnreviewed: boolean;
  changelog: string | null;
  createdAt: number;
}

/** A media attachment (image / video / cover). */
export interface ProjectMedia {
  id: string;
  projectId: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  fileSize: number;
  contentType: string;
  position: number;
  createdAt: number;
}

/** A Vibe Note attached to a project (never standalone). */
export interface VibeNote {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/** Full project detail (card + versions + media + notes). */
export interface ProjectDetail {
  card: ProjectCard;
  versions: ProjectVersion[];
  media: ProjectMedia[];
  vibeNotes: VibeNote[];
}

/** Returned after create / update while still in draft. */
export interface ProjectDraft {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  updatedAt: number;
}

/** Visitor-submitted report. */
export interface Report {
  id: string;
  projectId: string;
  reason: ReportReason;
  description: string;
  reporterId: string | null;
  moderationStatus: ModerationStatus;
  createdAt: number;
  resolvedAt: number | null;
}

// ─── Project CRUD DTOs ───────────────────────────────────────────

/** Input for creating a new project (draft). */
export interface CreateProjectInput {
  title: string;
  summary: string;
}

/** Input for updating an existing draft project. */
export interface UpdateProjectInput {
  title?: string;
  summary?: string;
}

/** Response after a successful publish — returns the full project detail. */
export interface PublishProjectResponse {
  ok: true;
  project: ProjectDetail;
}

// ─── Media request / complete DTOs ───────────────────────────────

/** Explicit media dimensions (width × height in pixels). */
export interface MediaDimensions {
  width: number;
  height: number;
}

/** Input for requesting a presigned R2 PUT URL for a new media attachment. */
export interface ProjectMediaRequestInput {
  type: MediaType;
  contentType: string;
  fileSize: number;
  dimensions?: MediaDimensions;
}

/** Response after a successful media request — client uploads to presignedUrl. */
export interface ProjectMediaRequestResponse {
  mediaId: string;
  presignedUrl: string;
  expiresAt: number;
}

/** Input for completing a media upload — client signals that R2 PUT finished. */
export interface ProjectMediaCompleteInput {
  mediaId: string;
}

/** Response after a successful media complete — returns the bound media record. */
export interface ProjectMediaCompleteResponse {
  ok: true;
  media: ProjectMedia;
}

// ─── Report DTOs ─────────────────────────────────────────────────

/** Input for submitting a visitor report (anonymous or authenticated). */
export interface CreateReportInput {
  reason: ReportReason;
  description?: string;
}

// ─── Moderation DTOs ─────────────────────────────────────────────

/** A single moderation event — append-only audit trail for admin actions. */
export interface ModerationEvent {
  id: string;
  projectId: string | null;
  reportId: string | null;
  action: ModerationAction;
  adminId: string;
  reason: string;
  createdAt: number;
}

/** Input for an admin moderation action. */
export interface ModerationRequestInput {
  action: ModerationAction;
  reason: string;
}

/** Response after a successful moderation action. */
export interface AdminModerationResponse {
  ok: true;
  event: ModerationEvent;
}

// ─── Audit DTOs ──────────────────────────────────────────────────

/** A single audit event — append-only log of significant system actions. */
export interface AuditEvent {
  id: string;
  action: AuditAction;
  actorId: string;
  targetType: AuditTargetType;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

// ─── Admin list DTOs ─────────────────────────────────────────────

/** Admin view of a project — extends public card with internal counters. */
export interface AdminProjectListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  authorId: string;
  authorName: string;
  coverUrl: string | null;
  tags: string[];
  status: ProjectStatus;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  reportCount: number;
  mediaCount: number;
}

/** Admin view of a report — extends base report with project context. */
export interface AdminReportListItem {
  id: string;
  projectId: string;
  projectTitle: string;
  projectSlug: string;
  reason: ReportReason;
  description: string;
  reporterId: string | null;
  moderationStatus: ModerationStatus;
  createdAt: number;
  resolvedAt: number | null;
}

// ─── Error envelope ──────────────────────────────────────────────

/** Unified Project API error response body. */
export interface ProjectApiError {
  error: {
    code: ProjectErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// ─── Unreviewed status ───────────────────────────────────────────

/** Warning payload shown to visitors when content has not been reviewed. */
export interface UnreviewedWarning {
  isUnreviewed: true;
  message: string;
  releaseKind: ReleaseKind;
}

// ─── Feed / pagination ──────────────────────────────────────────

/** Opaque-cursor feed response (latest / random / tag). */
export interface FeedCursorResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/** Offset-based paginated response (admin lists). */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Project Showcase constants ──────────────────────────────────

/** Feed default and maximum page sizes. */
export const PROJECT_FEED_DEFAULT_LIMIT = 20;
export const PROJECT_FEED_MAX_LIMIT = 50;

/** Per-project media budgets. */
export const PROJECT_MAX_IMAGES = 12;
export const PROJECT_MAX_VIDEOS = 2;
export const PROJECT_MAX_COVERS = 1;
export const PROJECT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const PROJECT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const PROJECT_MAX_VIDEO_DURATION_SECONDS = 60;
export const PROJECT_MAX_TEXT_BYTES = 32 * 1024;
export const VIBE_NOTE_MAX_BYTES = 4 * 1024;

/** API request-body metadata limit. */
export const PROJECT_METADATA_MAX_BYTES = 64 * 1024;

/** Rate limits (per-IP or per-user as documented). */
export const REPORT_RATE_LIMIT_PER_MIN = 5;
export const PUBLISH_RATE_LIMIT_PER_HOUR = 10;
export const MEDIA_REQUEST_RATE_LIMIT_PER_HOUR = 30;

/** Allowed release kinds — EXE permanently rejected, APK external-link only. */
export const ALLOWED_RELEASE_KINDS: readonly ReleaseKind[] = [
  "web",
  "apk_external",
  "none",
];

/** Executable extensions that are always rejected for direct upload. */
export const PROJECT_BLOCKED_EXTENSIONS = new Set([
  "exe",
  "msi",
  "dll",
  "bat",
  "cmd",
  "scr",
]);

// ─── Project field limits ────────────────────────────────────────

/** Maximum title length in characters. */
export const PROJECT_TITLE_MAX_LENGTH = 120;

/** Maximum summary length in characters. */
export const PROJECT_SUMMARY_MAX_LENGTH = 500;

/** Maximum number of tags per project. */
export const PROJECT_MAX_TAGS = 8;

/** Maximum tag label length in characters. */
export const PROJECT_TAG_MAX_LENGTH = 32;

/** Maximum report description length in bytes (UTF-8). */
export const REPORT_DESCRIPTION_MAX_BYTES = 2048;

/** Presigned URL validity for media uploads (seconds). */
export const MEDIA_PRESIGNED_URL_TTL_SECONDS = 300;

/** Moderation reason maximum length in characters. */
export const MODERATION_REASON_MAX_LENGTH = 1000;

// ─── Admin policy contract (T106) ────────────────────────────────

/**
 * Admin actions that may be subject to secondary confirmation.
 *
 * The admin capability matrix (T106) classifies each admin operation
 * by destructiveness. "Destructive" actions require the client to
 * echo the action name in a `confirmAction` field, preventing
 * accidental clicks from causing irreversible state changes.
 */
export type AdminAction =
  | "hide_project"
  | "unhide_project"
  | "remove_project"
  | "restore_project"
  | "reject_project"
  | "approve_project"
  | "resolve_report"
  | "dismiss_report"
  | "delete_user"
  | "reset_user_password"
  | "adjust_user_quota"
  | "adjust_global_settings";

/**
 * Set of admin actions that require secondary confirmation.
 *
 * These are destructive or irreversible operations. The handler must
 * verify the client sent `confirmAction` matching the action name
 * before proceeding. Non-destructive reads and soft operations
 * (hide/unhide) do not require confirmation.
 */
export const ADMIN_CONFIRMATION_REQUIRED: ReadonlySet<AdminAction> = new Set([
  "remove_project",
  "restore_project",
  "delete_user",
  "reset_user_password",
]);

/**
 * Valid admin state transitions for projects.
 *
 * Maps each target status to the set of source statuses from which
 * an admin may transition. This is the admin-side state machine;
 * the owner-side transitions (T201) are a subset.
 *
 * `removed` is a terminal soft-delete state; `restore_project`
 * transitions it back to `draft` for re-work.
 */
export const ADMIN_PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  draft: [],
  pending_media: [],
  published: ["hidden", "rejected", "removed"],
  rejected: ["published", "removed"],
  hidden: ["published", "removed"],
  removed: ["draft"],
};

/**
 * Maps admin moderation actions to their target status transitions.
 *
 * Used by the admin policy to validate that a requested action
 * is valid for the project's current status.
 */
export const ADMIN_ACTION_TRANSITIONS: Readonly<Record<string, { from: readonly ProjectStatus[]; to: ProjectStatus }>> = {
  hide_project: { from: ["published"], to: "hidden" },
  unhide_project: { from: ["hidden"], to: "published" },
  remove_project: { from: ["published", "rejected", "hidden"], to: "removed" },
  restore_project: { from: ["removed"], to: "draft" },
  reject_project: { from: ["published", "hidden"], to: "rejected" },
  approve_project: { from: ["rejected"], to: "published" },
};

/**
 * Result of an admin policy check.
 *
 * `allowed: true` means the action may proceed (subject to handler-layer
 * validation). `allowed: false` includes a reason code for logging and
 * error response mapping.
 */
export interface AdminPolicyDecision {
  readonly allowed: boolean;
  readonly reason?: AdminDenialReason;
}

/**
 * Reasons an admin action may be denied by the policy layer.
 *
 * These are internal decision codes; the handler maps them to
 * HTTP status codes and user-facing messages.
 */
export type AdminDenialReason =
  | "not_admin"
  | "action_requires_confirmation"
  | "confirmation_mismatch"
  | "invalid_transition"
  | "cannot_operate_on_self"
  | "last_admin_protection"
  | "target_not_found"
  | "already_resolved";

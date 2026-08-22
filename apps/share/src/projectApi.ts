/**
 * Project Showcase API client (T307).
 *
 * Wraps the backend routes from T201–T207. Reuses the same request/ApiError
 * envelope as ./api.ts (credentials + JSON error parsing).
 */
import type {
  CreateReportInput,
  ProjectCard,
  ProjectDetail,
  ProjectDraft,
  ProjectMediaCompleteResponse,
  ProjectMediaRequestInput,
  ProjectMediaRequestResponse,
  ProjectStatus,
  PublishProjectResponse,
  UpdateProjectInput,
} from "@wellorbetter/shared";
import { ApiError, request } from "./api.js";

// The backend draft output includes fields beyond the shared ProjectDraft DTO.
export interface ProjectDraftOutput extends ProjectDraft {
  summary: string;
}

export interface MyProjectsResponse {
  items: ProjectDraftOutput[];
  total: number;
}

export interface VibeNotesResponse {
  items: Array<{
    id: string;
    projectId: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }>;
}

/** Extend create/update inputs with backend-accepted optional fields. */
export interface CreateProjectBody {
  title: string;
  summary?: string;
  description?: string;
  experienceUrlPolicy?: "iframe" | "external" | "none";
  releaseKind?: "web" | "apk_external" | "none";
  releaseUrl?: string | null;
}

export type UpdateProjectBody = Partial<CreateProjectBody>;

export const projectApi = {
  // ── Own projects (T201) ────────────────────────────────────────
  create: (input: CreateProjectBody) =>
    request<ProjectDraftOutput>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: UpdateProjectBody) =>
    request<ProjectDraftOutput>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  publish: (id: string) =>
    request<PublishProjectResponse | ProjectDraftOutput>(`/api/projects/${id}/publish`, { method: "POST" }),
  remove: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  listMine: (params?: { status?: ProjectStatus; offset?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.offset) q.set("offset", String(params.offset));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<MyProjectsResponse>(`/api/me/projects${qs ? `?${qs}` : ""}`);
  },

  // ── Public detail (T202) ───────────────────────────────────────
  detail: (slug: string) => request<ProjectDetail>(`/api/projects/${slug}`),

  // ── Vibe notes (T204) ──────────────────────────────────────────
  listNotes: (projectIdOrSlug: string) =>
    request<VibeNotesResponse>(`/api/projects/${projectIdOrSlug}/notes`),
  createNote: (projectId: string, content: string) =>
    request<unknown>(`/api/projects/${projectId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // ── Report (T204) ──────────────────────────────────────────────
  report: (projectIdOrSlug: string, input: CreateReportInput) =>
    request<{ ok: true }>(`/api/projects/${projectIdOrSlug}/report`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // ── Media (T203) ───────────────────────────────────────────────
  mediaRequest: (projectId: string, input: ProjectMediaRequestInput) =>
    request<ProjectMediaRequestResponse>(`/api/projects/${projectId}/media`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  mediaComplete: (projectId: string, mediaId: string) =>
    request<ProjectMediaCompleteResponse>(`/api/projects/${projectId}/media/${mediaId}/complete`, {
      method: "POST",
      body: JSON.stringify({ mediaId }),
    }),
  mediaList: (projectId: string) =>
    request<{ items: unknown[] }>(`/api/projects/${projectId}/media`),
};

export { ApiError };

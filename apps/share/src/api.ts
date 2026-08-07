/** Worker API 客户端（同源，开发环境走 vite proxy） */
import type {
  AdminCreateUserInput,
  AdminUpdateSettingsInput,
  AdminUpdateUserInput,
  AdminUsageResponse,
  AdminUsersResponse,
  LoginInput,
  LoginResponse,
  MeResponse,
  ShareMetaResponse,
  ShareVerifyResponse,
  SharesListResponse,
  UploadCompleteResponse,
  UploadRequestInput,
  UploadRequestResponse,
} from "@wellorbetter/shared";

/** API 基地址：生产分离部署到 api 子域；本地开发走 Vite 代理（同源） */
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.PROD ? "https://api.wellorbetterai.com" : "");

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    let code = "unknown";
    let message = "请求失败";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(code, message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  login: (username: string, password: string) => {
    const input: LoginInput = { username, password };
    return request<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
  },
  logout: () => request<LoginResponse>("/api/auth/logout", { method: "POST" }),
  me: () => request<MeResponse>("/api/me"),
  uploadRequest: (input: UploadRequestInput) =>
    request<UploadRequestResponse>("/api/upload/request", { method: "POST", body: JSON.stringify(input) }),
  uploadComplete: (shareId: string) =>
    request<UploadCompleteResponse>("/api/upload/complete", { method: "POST", body: JSON.stringify({ shareId }) }),
  listShares: (page = 1) => request<SharesListResponse>(`/api/shares?page=${page}`),
  deleteShare: (id: string) => request<{ ok: true }>(`/api/shares/${id}`, { method: "DELETE" }),
  shareMeta: (id: string) => request<ShareMetaResponse>(`/api/share/${id}/meta`),
  shareVerify: (id: string, password?: string) =>
    request<ShareVerifyResponse>(`/api/share/${id}/verify`, { method: "POST", body: JSON.stringify({ password }) }),

  // 管理员：用户权限控制
  adminListUsers: () => request<AdminUsersResponse>("/api/admin/users"),
  adminCreateUser: (input: AdminCreateUserInput) =>
    request<{ ok: true }>("/api/admin/users", { method: "POST", body: JSON.stringify(input) }),
  adminDeleteUser: (id: string) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: "DELETE" }),
  adminResetPassword: (id: string, password: string) =>
    request<{ ok: true }>(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  adminUsage: () => request<AdminUsageResponse>("/api/admin/usage"),
  adminUpdateSettings: (input: AdminUpdateSettingsInput) =>
    request<{ ok: true; settings: AdminUsageResponse["settings"] }>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  adminUpdateUser: (id: string, input: AdminUpdateUserInput) =>
    request<{ ok: true }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};

/** 复制文本（剪贴板 API + 降级） */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** 微信 UA 检测 */
export function isWeChat(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}
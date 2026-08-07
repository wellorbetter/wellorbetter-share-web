import type { ShareState } from "./utils.js";

/** API 统一错误响应体 */
export interface ApiError {
  error: { code: string; message: string };
}

/** 用户角色 */
export type UserRole = "admin" | "user";

/** 登录请求 */
export interface LoginInput {
  username: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  ok: true;
}

/** 当前会话 */
export interface MeResponse {
  ok: true;
  user: { id: string; username: string; role: UserRole };
}

/** 管理员：用户列表项 */
export interface AdminUserItem {
  id: string;
  username: string;
  role: UserRole;
  createdAt: number;
}

/** 管理员：用户列表响应 */
export interface AdminUsersResponse {
  items: AdminUserItem[];
}

/** 管理员：创建用户请求 */
export interface AdminCreateUserInput {
  username: string;
  password: string;
  role?: UserRole;
}

/** 上传请求（request 阶段） */
export interface UploadRequestInput {
  fileName: string;
  fileSize: number;
  contentType: string;
  expirySeconds: number | null;
  password?: string;
  maxDownloads?: number | null;
}

/** 上传 request 响应：拿到预签名 PUT 地址与 shareId */
export interface UploadRequestResponse {
  shareId: string;
  presignedUrl: string;
}

/** 上传 complete 响应 */
export interface UploadCompleteResponse {
  ok: true;
  shareId: string;
  url: string;
}

/** 管理列表中的单个分享 */
export interface ShareListItem {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  status: ShareState;
  hasPassword: boolean;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: number | null;
  createdAt: number;
  deletedAt: number | null;
}

/** 管理列表响应 */
export interface SharesListResponse {
  items: ShareListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 删除响应 */
export interface DeleteResponse {
  ok: true;
}

/** 下载页元数据响应（公开，不含敏感信息） */
export interface ShareMetaResponse {
  state: ShareState;
  id?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  hasPassword?: boolean;
  expiresAt?: number | null;
}

/** 下载凭证响应 */
export interface ShareVerifyResponse {
  ticket: string;
  downloadUrl: string;
}

/** 上传进度事件（前端 XHR 用） */
export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}
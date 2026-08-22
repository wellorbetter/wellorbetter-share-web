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

export interface RegisterInput {
  username: string;
  password: string;
}

export interface RegisterResponse {
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
  /** 存储配额（字节；null = 使用全局默认值） */
  storageQuotaBytes: number | null;
  /** 每月对外下载配额（字节；null = 使用全局默认值） */
  downloadQuotaBytes: number | null;
}

/** 管理员：用户列表响应 */
export interface AdminUsersResponse {
  items: AdminUserItem[];
}

/** 全局配额设置（后台可调） */
export interface AdminSettings {
  /** 新用户默认存储配额（字节，0 = 不允许上传） */
  defaultStorageQuotaBytes: number;
  /** 全局存储配额（字节） */
  globalStorageQuotaBytes: number;
  /** 每个用户每月对外下载配额（字节） */
  defaultDownloadQuotaBytes: number;
  /** 全局每月对外下载配额（字节） */
  globalDownloadQuotaBytes: number;
  /** 每用户同时进行中的上传任务上限 */
  maxPendingUploads: number;
}

/** 用量与配额响应 */
export interface AdminUsageResponse {
  /** 统计月份 'YYYY-MM'（下载用量按月累计） */
  month: string;
  users: Array<
    AdminUserItem & {
      storageUsedBytes: number;
      downloadUsedBytes: number;
      /** 生效配额（用户显式值或全局默认） */
      effectiveStorageQuotaBytes: number;
      effectiveDownloadQuotaBytes: number;
    }
  >;
  global: {
    storageUsedBytes: number;
    storageQuotaBytes: number;
    downloadUsedBytes: number;
    downloadQuotaBytes: number;
    pendingUploads: number;
    activeShares: number;
    totalShares: number;
  };
  settings: AdminSettings;
}

/** 管理员：更新单个用户配额/角色请求 */
export interface AdminUpdateUserInput {
  /** null = 回落到全局默认值 */
  storageQuotaBytes?: number | null;
  downloadQuotaBytes?: number | null;
  role?: UserRole;
}

/** 管理员：更新全局设置请求（只传需要修改的字段） */
export interface AdminUpdateSettingsInput {
  defaultStorageQuotaBytes?: number;
  globalStorageQuotaBytes?: number;
  defaultDownloadQuotaBytes?: number;
  globalDownloadQuotaBytes?: number;
  maxPendingUploads?: number;
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

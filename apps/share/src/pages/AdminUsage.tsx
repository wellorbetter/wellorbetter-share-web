import { useCallback, useEffect, useState } from "react";
import { formatBytes, type AdminSettings, type AdminUsageResponse } from "@wellorbetter/shared";
import { api, ApiError } from "../api.js";
import { Dialog } from "../components/Dialog.js";

const GB = 1024 * 1024 * 1024;

function bytesToGb(n: number): string {
  return String(Math.round(n / GB));
}

function gbToBytes(input: string, fallback: number): number {
  const v = Number(input);
  return Number.isFinite(v) && v > 0 ? Math.round(v * GB) : fallback;
}

function QuotaBar({ used, quota }: { used: number; quota: number }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div className="usage-bar" aria-label={`已用 ${pct}%`}>
      <div
        className={`usage-bar-fill${danger ? " is-danger" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface SettingsForm {
  defaultStorageGb: string;
  globalStorageGb: string;
  defaultDownloadGb: string;
  globalDownloadGb: string;
  maxPending: string;
}

function toForm(s: AdminSettings): SettingsForm {
  return {
    defaultStorageGb: bytesToGb(s.defaultStorageQuotaBytes),
    globalStorageGb: bytesToGb(s.globalStorageQuotaBytes),
    defaultDownloadGb: bytesToGb(s.defaultDownloadQuotaBytes),
    globalDownloadGb: bytesToGb(s.globalDownloadQuotaBytes),
    maxPending: String(s.maxPendingUploads),
  };
}

export function AdminUsagePage() {
  const [data, setData] = useState<AdminUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quotaTarget, setQuotaTarget] = useState<{ user: AdminUsageResponse["users"][number]; kind: "storage" | "download" } | null>(null);
  const [quotaInput, setQuotaInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminUsage();
      setData(res);
      setForm((prev) => prev ?? toForm(res.settings));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.adminUpdateSettings({
        defaultStorageQuotaBytes: gbToBytes(form.defaultStorageGb, 2 * GB),
        globalStorageQuotaBytes: gbToBytes(form.globalStorageGb, 10 * GB),
        defaultDownloadQuotaBytes: gbToBytes(form.defaultDownloadGb, 20 * GB),
        globalDownloadQuotaBytes: gbToBytes(form.globalDownloadGb, 100 * GB),
        maxPendingUploads: Math.max(1, Math.floor(Number(form.maxPending) || 5)),
      });
      setSavedAt(Date.now());
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  /** 打开配额编辑对话框 */
  function openQuota(userId: string, kind: "storage" | "download") {
    const u = data?.users.find((x) => x.id === userId);
    if (!u) return;
    const current =
      kind === "storage" ? u.effectiveStorageQuotaBytes : u.effectiveDownloadQuotaBytes;
    setQuotaTarget({ user: u, kind });
    setQuotaInput(bytesToGb(current));
  }

  /** 保存单用户配额（空 = 恢复默认） */
  async function saveQuota() {
    if (!quotaTarget || busyId) return;
    const { user, kind } = quotaTarget;
    const current =
      kind === "storage" ? user.effectiveStorageQuotaBytes : user.effectiveDownloadQuotaBytes;
    setBusyId(user.id);
    setError(null);
    try {
      await api.adminUpdateUser(user.id, {
        [kind === "storage" ? "storageQuotaBytes" : "downloadQuotaBytes"]:
          quotaInput.trim() === "" ? null : gbToBytes(quotaInput, current),
      });
      setQuotaTarget(null);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新失败");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) return <div className="loading-block">加载中…</div>;

  if (!data) {
    return (
      <div className="manage-page">
        <h2>用量与配额</h2>
        {error && (
          <div className="error-block" role="alert">
            <p>{error}</p>
            <button type="button" className="ghost-btn" onClick={() => void load()}>
              重试
            </button>
          </div>
        )}
      </div>
    );
  }

  const { global, settings } = data;

  return (
    <div className="manage-page usage-page">
      <Dialog
        title={quotaTarget ? `设置配额 · ${quotaTarget.user.username}` : "设置配额"}
        open={quotaTarget !== null}
        onClose={() => {
          if (!busyId) setQuotaTarget(null);
        }}
      >
        <p>
          {quotaTarget?.kind === "storage" ? "存储配额" : "每月下载配额"}
          （单位 GB，留空恢复为全局默认）。当前生效：
          {quotaTarget
            ? bytesToGb(
                quotaTarget.kind === "storage"
                  ? quotaTarget.user.effectiveStorageQuotaBytes
                  : quotaTarget.user.effectiveDownloadQuotaBytes,
              )
            : ""}{" "}
          GB
        </p>
        <input
          type="number"
          min={0.0625}
          value={quotaInput}
          onChange={(e) => setQuotaInput(e.target.value)}
          placeholder="留空恢复默认"
          aria-label="配额"
          autoFocus
        />
        <div className="m3-dialog-actions">
          <button type="button" className="ghost-btn" disabled={busyId !== null} onClick={() => setQuotaTarget(null)}>
            取消
          </button>
          <button type="button" className="primary-btn" disabled={busyId !== null} onClick={() => void saveQuota()}>
            {busyId !== null ? "保存中…" : "保存"}
          </button>
        </div>
      </Dialog>
      <div className="manage-head">
        <h2>用量与配额</h2>
        <span className="manage-count">统计月份 {data.month}（下载流量按月累计）</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {savedAt && <p className="usage-saved" role="status">已保存 ✓</p>}

      <section className="usage-section" aria-label="全局用量">
        <h3>全局用量</h3>
        <div className="usage-global">
          <div className="usage-card">
            <span className="usage-label">存储占用</span>
            <strong>
              {formatBytes(global.storageUsedBytes)} / {formatBytes(global.storageQuotaBytes)}
            </strong>
            <QuotaBar used={global.storageUsedBytes} quota={global.storageQuotaBytes} />
            <span className="usage-hint">含进行中的上传（pending），删除后立即释放</span>
          </div>
          <div className="usage-card">
            <span className="usage-label">本月下载流量</span>
            <strong>
              {formatBytes(global.downloadUsedBytes)} / {formatBytes(global.downloadQuotaBytes)}
            </strong>
            <QuotaBar used={global.downloadUsedBytes} quota={global.downloadQuotaBytes} />
            <span className="usage-hint">按分享归属用户计费，用于控制 R2 出站成本</span>
          </div>
          <div className="usage-card">
            <span className="usage-label">分享统计</span>
            <strong>
              {global.activeShares} 个有效
              <span className="usage-dot" />
              {global.pendingUploads} 个进行中
            </strong>
            <span className="usage-hint">共 {global.totalShares} 条记录</span>
          </div>
        </div>
      </section>

      <section className="usage-section" aria-label="全局设置">
        <h3>全局设置</h3>
        {form && (
          <form onSubmit={saveSettings} className="usage-settings">
            <label>
              新用户默认存储配额（GB）
              <input
                type="number"
                min={0.0625}
                value={form.defaultStorageGb}
                onChange={(e) => setForm({ ...form, defaultStorageGb: e.target.value })}
              />
            </label>
            <label>
              全局存储配额（GB）
              <input
                type="number"
                min={0.0625}
                value={form.globalStorageGb}
                onChange={(e) => setForm({ ...form, globalStorageGb: e.target.value })}
              />
            </label>
            <label>
              每用户每月下载配额（GB）
              <input
                type="number"
                min={0.0625}
                value={form.defaultDownloadGb}
                onChange={(e) => setForm({ ...form, defaultDownloadGb: e.target.value })}
              />
            </label>
            <label>
              全局每月下载配额（GB）
              <input
                type="number"
                min={0.0625}
                value={form.globalDownloadGb}
                onChange={(e) => setForm({ ...form, globalDownloadGb: e.target.value })}
              />
            </label>
            <label>
              每用户同时上传任务上限
              <input
                type="number"
                min={1}
                max={50}
                value={form.maxPending}
                onChange={(e) => setForm({ ...form, maxPending: e.target.value })}
              />
            </label>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "保存中…" : "保存设置"}
            </button>
          </form>
        )}
        <p className="usage-hint">全局默认仅对未单独设置的用户生效；单独设置覆盖全局默认。</p>
      </section>

      <section className="usage-section" aria-label="用户用量">
        <h3>用户用量</h3>
        {data.users.length === 0 ? (
          <div className="empty-block">
            <p>还没有用户</p>
          </div>
        ) : (
          <div className="usage-users">
            {data.users.map((u) => (
              <div className="usage-user" key={u.id}>
                <div className="usage-user-head">
                  <span className="share-name">{u.username}</span>
                  <span className={`badge ${u.role === "admin" ? "is-active" : ""}`}>
                    {u.role === "admin" ? "管理员" : "普通用户"}
                  </span>
                </div>
                <div className="usage-user-row">
                  <span className="usage-label">存储</span>
                  <div className="usage-user-bar">
                    <QuotaBar used={u.storageUsedBytes} quota={u.effectiveStorageQuotaBytes} />
                    <span>
                      {formatBytes(u.storageUsedBytes)} / {formatBytes(u.effectiveStorageQuotaBytes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn usage-edit"
                    disabled={busyId === u.id}
                    onClick={() => void openQuota(u.id, "storage")}
                  >
                    调整
                  </button>
                </div>
                <div className="usage-user-row">
                  <span className="usage-label">本月下载</span>
                  <div className="usage-user-bar">
                    <QuotaBar used={u.downloadUsedBytes} quota={u.effectiveDownloadQuotaBytes} />
                    <span>
                      {formatBytes(u.downloadUsedBytes)} / {formatBytes(u.effectiveDownloadQuotaBytes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn usage-edit"
                    disabled={busyId === u.id}
                    onClick={() => void openQuota(u.id, "download")}
                  >
                    调整
                  </button>
                </div>
                {settings && (
                  <p className="usage-hint">
                    {u.storageQuotaBytes === null ? "存储使用全局默认" : "存储已单独设置"}
                    {" · "}
                    {u.downloadQuotaBytes === null ? "下载使用全局默认" : "下载已单独设置"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
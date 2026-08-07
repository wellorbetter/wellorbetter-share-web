import { useCallback, useEffect, useState } from "react";
import type { AdminUserItem, UserRole } from "@wellorbetter/shared";
import { api, ApiError } from "../api.js";
import { Dialog } from "../components/Dialog.js";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [busy, setBusy] = useState(false);

  // 删除 / 重置密码对话框
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListUsers();
      setUsers(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !username.trim() || password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminCreateUser({ username: username.trim(), password, role });
      setUsername("");
      setPassword("");
      setRole("user");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || dialogBusy) return;
    setDialogBusy(true);
    setError(null);
    try {
      await api.adminDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDialogBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget || dialogBusy || newPassword.length < 8) return;
    setDialogBusy(true);
    setError(null);
    try {
      await api.adminResetPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重置失败");
    } finally {
      setDialogBusy(false);
    }
  }

  return (
    <div className="manage-page">
      <div className="manage-head">
        <h2>用户管理</h2>
        <span className="manage-count">{users ? `${users.length} 个用户` : ""}</span>
      </div>
      {error && users === null && (
        <div className="error-block" role="alert">
          <p>{error}</p>
          <button type="button" className="ghost-btn" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
      {error && users !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={createUser} className="admin-create" aria-label="创建用户">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名（2-32 位字母数字_-）"
          aria-label="用户名"
          autoComplete="off"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="初始密码（至少 8 位）"
          aria-label="初始密码"
          autoComplete="new-password"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} aria-label="角色">
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <button type="submit" className="primary-btn" disabled={busy || !username.trim() || password.length < 8}>
          {busy ? "创建中…" : "创建用户"}
        </button>
      </form>

      {loading ? (
        <div className="loading-block">加载中…</div>
      ) : users === null ? null : users.length === 0 ? (
        <div className="empty-block">
          <p>还没有用户</p>
          <p className="empty-hint">在上方创建第一个用户</p>
        </div>
      ) : (
        <div className="share-list">
          {users.map((u) => (
            <div key={u.id} className="share-row">
              <div className="share-row-main">
                <span className="share-name">{u.username}</span>
                <span className={`badge ${u.role === "admin" ? "is-active" : ""}`}>
                  {u.role === "admin" ? "管理员" : "普通用户"}
                </span>
                <span className="share-row-sub">
                  创建于 {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <div className="share-row-actions">
                <button type="button" className="ghost-btn" onClick={() => setResetTarget(u)}>
                  重置密码
                </button>
                <button type="button" className="ghost-btn danger-text" onClick={() => setDeleteTarget(u)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认对话框 */}
      <Dialog
        title="删除用户"
        open={deleteTarget !== null}
        onClose={() => {
          if (!dialogBusy) setDeleteTarget(null);
        }}
      >
        <p>
          确认删除用户 <strong>{deleteTarget?.username}</strong>？其名下分享将保留但无法再登录。
        </p>
        <div className="m3-dialog-actions">
          <button type="button" className="ghost-btn" disabled={dialogBusy} onClick={() => setDeleteTarget(null)}>
            取消
          </button>
          <button type="button" className="danger-btn" disabled={dialogBusy} onClick={() => void confirmDelete()}>
            {dialogBusy ? "删除中…" : "确认删除"}
          </button>
        </div>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog
        title="重置密码"
        open={resetTarget !== null}
        onClose={() => {
          if (!dialogBusy) {
            setResetTarget(null);
            setNewPassword("");
          }
        }}
      >
        <form onSubmit={submitReset}>
          <p>
            为用户 <strong>{resetTarget?.username}</strong> 设置新密码（至少 8 位）。
          </p>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新密码（至少 8 位）"
            aria-label="新密码"
            autoComplete="new-password"
            autoFocus
          />
          <div className="m3-dialog-actions">
            <button
              type="button"
              className="ghost-btn"
              disabled={dialogBusy}
              onClick={() => {
                setResetTarget(null);
                setNewPassword("");
              }}
            >
              取消
            </button>
            <button type="submit" className="primary-btn" disabled={dialogBusy || newPassword.length < 8}>
              {dialogBusy ? "重置中…" : "确认重置"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

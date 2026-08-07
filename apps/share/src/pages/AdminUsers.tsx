import { useCallback, useEffect, useState } from "react";
import type { AdminUserItem, UserRole } from "@wellorbetter/shared";
import { api, ApiError } from "../api.js";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [busy, setBusy] = useState(false);

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

  async function remove(id: string, name: string) {
    if (!window.confirm(`确认删除用户 ${name}？其名下分享将保留但无法再登录。`)) return;
    try {
      await api.adminDeleteUser(id);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  async function resetPassword(id: string, name: string) {
    const next = window.prompt(`为用户 ${name} 设置新密码（至少 8 位）：`);
    if (!next) return;
    if (next.length < 8) {
      setError("密码长度需为 8-72 位");
      return;
    }
    try {
      await api.adminResetPassword(id, next);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重置失败");
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
                <button type="button" className="ghost-btn" onClick={() => resetPassword(u.id, u.username)}>
                  重置密码
                </button>
                <button type="button" className="ghost-btn danger-text" onClick={() => remove(u.id, u.username)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useState } from "react";
import { api, ApiError } from "../api.js";

export function LoginPage({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await api.login(username, password);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>wellorbetter 文件分享</h1>
      <p className="auth-sub">登录后上传文件并管理分享链接</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
          autoComplete="username"
          autoFocus
        />
        <label htmlFor="password">密码</label>
        <div className="input-with-icon">
          <input
            id="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="input-icon-btn"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "隐藏密码" : "显示密码"}
          >
            {show ? "🙈" : "👁"}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary-btn" disabled={loading || !username || !password}>
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
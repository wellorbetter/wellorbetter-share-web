import { useState } from "react";
import { icon } from "@wellorbetter/design";
import { api, ApiError } from "../api.js";

type AuthMode = "login" | "register";

export function LoginPage({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: AuthMode) {
    setMode(next);
    setUsername("");
    setPassword("");
    setShow(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !username || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") await api.register(username, password);
      await api.login(username, password);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : mode === "login" ? "登录失败，请重试" : "注册失败，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>wellorbetter</h1>
      <p className="auth-sub">登录或创建账号，发布你的 vibecoding 作品</p>
      <div className="auth-tabs" role="tablist" aria-label="账号操作">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "auth-tab is-active" : "auth-tab"} onClick={() => switchMode("login")}>登录</button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "auth-tab is-active" : "auth-tab"} onClick={() => switchMode("register")}>注册</button>
      </div>

      <form onSubmit={submit} className="auth-form">
        <label htmlFor="username">用户名</label>
        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="2-32 位字母、数字、下划线或连字符" autoComplete="username" autoFocus />
        <label htmlFor="password">密码</label>
        <div className="input-with-icon">
          <input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "至少 8 位，包含字母和数字" : "请输入密码"} autoComplete={mode === "register" ? "new-password" : "current-password"} />
          <button type="button" className="input-icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "隐藏密码" : "显示密码"}>
            <span dangerouslySetInnerHTML={{ __html: icon(show ? "eye-off" : "eye", 20) }} />
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-btn" disabled={loading || !username || !password}>
          {loading ? (mode === "login" ? "登录中…" : "注册中…") : mode === "login" ? "登录" : "创建账号"}
        </button>
      </form>
    </div>
  );
}

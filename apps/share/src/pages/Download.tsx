import { useCallback, useEffect, useState } from "react";
import { formatBytes, type ShareMetaResponse } from "@wellorbetter/shared";
import { fileTypeEmoji } from "@wellorbetter/design";
import { api, ApiError, isWeChat } from "../api.js";

type ViewState =
  | { kind: "loading" }
  | { kind: "active"; meta: ShareMetaResponse }
  | { kind: "need_password"; meta: ShareMetaResponse }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

export function DownloadPage({ id }: { id: string }) {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setView({ kind: "loading" });
    setError(null);
    try {
      const meta = await api.shareMeta(id);
      if (meta.state !== "active") {
        setView({ kind: "invalid" });
        return;
      }
      setView(
        meta.hasPassword
          ? { kind: "need_password", meta }
          : { kind: "active", meta },
      );
    } catch (err) {
      setView({
        kind: "invalid",
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await api.shareVerify(id, password || undefined);
      window.location.href = res.downloadUrl;
    } catch (err) {
      setDownloading(false);
      if (err instanceof ApiError && err.code === "invalid_password") {
        setError("密码不正确，请重新输入");
        setPassword("");
      } else {
        setError(err instanceof ApiError ? err.message : "下载失败，请重试");
      }
    }
  }

  if (view.kind === "loading") {
    return <div className="loading-block">加载中…</div>;
  }

  if (view.kind === "invalid") {
    return (
      <div className="download-card">
        <h1>链接已失效</h1>
        <p className="muted">该分享可能已过期、被删除或达到下载次数上限</p>
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="download-card">
        <h1>加载失败</h1>
        <p className="muted">{view.message}</p>
      </div>
    );
  }

  const meta = view.meta;

  return (
    <div className="download-card">
      <h1>分享给你一个文件</h1>
      <div className="download-file">
        <span className="download-icon">{fileTypeEmoji(meta.fileName ?? "")}</span>
        <div>
          <p className="download-name" title={meta.fileName}>
            {meta.fileName}
          </p>
          <p className="muted">
            {meta.fileSize !== undefined && formatBytes(meta.fileSize)}
            {meta.expiresAt ? " · " + new Date(meta.expiresAt).toLocaleDateString("zh-CN") + " 过期" : " · 永久有效"}
          </p>
        </div>
      </div>

      {isWeChat() && (
        <p className="wechat-tip">请在浏览器中打开以下载文件</p>
      )}

      {view.kind === "need_password" && (
        <>
          <label className="download-password" htmlFor="download-password">
            密码
            <div className="input-with-icon">
              <input
                id="download-password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入分享密码"
                autoFocus
                aria-describedby={error ? "download-password-error" : undefined}
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
          </label>
          {error && (
            <p id="download-password-error" className="form-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </>
      )}

      <button type="button" className="primary-btn" onClick={download} disabled={downloading}>
        {downloading ? "准备下载…" : "下载文件"}
      </button>
    </div>
  );
}
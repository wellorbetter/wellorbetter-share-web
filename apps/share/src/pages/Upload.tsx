import { useEffect, useRef, useState } from "react";
import {
  MAX_FILE_SIZE,
  EXPIRY_OPTIONS_SECONDS,
  formatBytes,
  type UploadProgress,
} from "@wellorbetter/shared";
import { api, ApiError, copyText } from "../api.js";

type Phase = "idle" | "uploading" | "success" | "error";

export function UploadPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expiry, setExpiry] = useState<number | null>(7 * 24 * 60 * 60);
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时中止进行中的上传、清理定时器（内存/资源回收 L1/L2）
  useEffect(() => {
    return () => {
      xhrRef.current?.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError(`文件超过 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB 上限`);
      return;
    }
    setError(null);
    setFile(f);
    setPhase("idle");
  }

  async function upload() {
    if (!file || phase === "uploading") return;
    if (expiry === null && !window.confirm("永久链接将长期可访问，确定生成吗？")) return;
    setPhase("uploading");
    setError(null);
    setProgress(null);
    try {
      // 1. request：拿预签名 PUT 地址
      const { shareId, presignedUrl } = await api.uploadRequest({
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        expirySeconds: expiry,
        password: password || undefined,
        maxDownloads: maxDownloads ? Number(maxDownloads) : null,
      });

      // 2. 浏览器直传 R2（XHR 以获得上传进度，进度节流 ~10Hz）
      await uploadWithProgress(presignedUrl, file, setProgress, xhrRef);

      // 3. complete：HEAD 校验 + 落库
      const res = await api.uploadComplete(shareId);
      setShareUrl(res.url);
      setPhase("success");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPhase("error");
      setError(err instanceof ApiError ? err.message : "上传失败，请重试");
    }
  }

  function reset() {
    setPhase("idle");
    setFile(null);
    setShareUrl(null);
    setError(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function copyLink() {
    if (!shareUrl) return;
    const ok = await copyText(shareUrl);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    if (!ok) {
      setError("复制失败，请长按链接手动复制");
    }
  }

  return (
    <div className="upload-page">
      <div
        className={`dropzone${dragOver ? " is-dragover" : ""}${file ? " has-file" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <div className="dropzone-icon">⬆</div>
        <p>{file ? file.name : "拖拽文件到此处，或点击选择"}</p>
        <p className="dropzone-hint">
          {file ? formatBytes(file.size) : `最大 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB`}
        </p>
      </div>

      {phase === "uploading" && progress && (
        <div className="progress-block" aria-live="polite">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="progress-text">{progress.percent}%</p>
        </div>
      )}

      {phase === "error" && (
        <div className="error-block" role="alert">
          <p>{error}</p>
          <button type="button" className="ghost-btn" onClick={upload}>
            重试
          </button>
        </div>
      )}

      {phase === "success" && shareUrl && (
        <div className="success-block">
          <p className="success-title">✅ 分享链接已生成</p>
          <div className="share-url-row">
            <code className="share-url">{shareUrl}</code>
            <button type="button" className="primary-btn" onClick={copyLink}>
              {copied ? "已复制 ✓" : "复制"}
            </button>
          </div>
          <button type="button" className="ghost-btn" onClick={reset}>
            再传一个
          </button>
        </div>
      )}

      {phase !== "success" && (
        <div className="options-panel">
          <label>
            过期时间
            <select value={expiry ?? ""} onChange={(e) => setExpiry(e.target.value ? Number(e.target.value) : null)} disabled={phase === "uploading"}>
              {EXPIRY_OPTIONS_SECONDS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            密码（可选）
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则不设密码"
              disabled={phase === "uploading"}
            />
          </label>
          <label>
            下载次数上限（可选）
            <input
              type="number"
              min={1}
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
              placeholder="留空则不限制"
              disabled={phase === "uploading"}
            />
          </label>
          <button type="button" className="primary-btn" onClick={upload} disabled={!file || phase === "uploading"}>
            {phase === "uploading" ? "上传中…" : "生成分享链接"}
          </button>
        </div>
      )}
    </div>
  );
}

/** XHR 上传并回报进度（fetch 无上传进度事件；进度节流 ~10Hz，性能 M5） */
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (p: UploadProgress) => void,
  xhrRef: { current: XMLHttpRequest | null },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    let lastEmit = 0;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      if (now - lastEmit < 100) return;
      lastEmit = now;
      onProgress({
        loaded: e.loaded,
        total: e.total,
        percent: Math.min(100, Math.round((e.loaded / e.total) * 100)),
      });
    };
    const done = () => {
      xhrRef.current = null;
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, total: file.size, percent: 100 });
        resolve();
      } else {
        reject(new ApiError("upload_failed", `上传失败（HTTP ${xhr.status}）`, xhr.status));
      }
    };
    xhr.onerror = () => {
      done();
      reject(new ApiError("upload_failed", "网络错误，上传失败", 0));
    };
    xhr.onabort = () => {
      done();
      reject(new DOMException("上传已取消", "AbortError"));
    };
    xhr.send(file);
  });
}
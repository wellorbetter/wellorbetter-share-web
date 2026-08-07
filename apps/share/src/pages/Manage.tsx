import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes, formatRemaining, type ShareListItem } from "@wellorbetter/shared";
import { api, ApiError, copyText } from "../api.js";

interface ListState {
  items: ShareListItem[];
  total: number;
  page: number;
}

export function ManagePage() {
  const [state, setState] = useState<ListState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时清理确认定时器（内存回收 L2）
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listShares(page);
      setState({ items: res.items, total: res.total, page: res.page });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = state ? Math.max(1, Math.ceil(state.total / 20)) : 1;

  /** 二次确认 3 秒未操作自动还原（防误触） */
  function startConfirm(id: string) {
    setConfirming(id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(null), 3000);
  }

  function cancelConfirm() {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirming(null);
  }

  async function remove(id: string) {
    cancelConfirm();
    try {
      await api.deleteShare(id);
      void load(state?.page ?? 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  async function copyLink(id: string) {
    const url = `${window.location.origin}/f/${id}`;
    const ok = await copyText(url);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setError("复制失败，请手动复制链接");
    }
  }

  return (
    <div className="manage-page">
      <div className="manage-head">
        <h2>我的分享（{state?.total ?? "…"}）</h2>
      </div>

      {error && (
        <div className="error-block" role="alert">
          <p>{error}</p>
          <button type="button" className="ghost-btn" onClick={() => void load(state?.page ?? 1)}>
            重试
          </button>
        </div>
      )}

      {loading && !state && <div className="loading-block">加载中…</div>}

      {state && state.items.length === 0 && !loading && (
        <div className="empty-block">
          <p>还没有分享</p>
          <p className="empty-hint">去上传第一个文件吧</p>
        </div>
      )}

      {state && state.items.length > 0 && (
        <>
          <div className="share-table">
            {state.items.map((item) => (
              <div className="share-row" key={item.id}>
                <div className="share-file">
                  <span className="share-file-name" title={item.fileName}>
                    {item.fileName}
                  </span>
                  <span className="share-file-meta">
                    {formatBytes(item.fileSize)} · {formatRemaining(item.expiresAt)}
                    {" · 创建于 "}
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="share-count">
                  {item.downloadCount}
                  {item.maxDownloads !== null ? `/${item.maxDownloads}` : ""} 次
                  {item.hasPassword ? " 🔒" : ""}
                </div>
                <div className="share-status">
                  <span className={`badge is-${item.status}`}>
                    {item.status === "active" ? "有效" : item.status === "expired" ? "已过期" : item.status === "over_limit" ? "已达上限" : "已删除"}
                  </span>
                </div>
                <div className="share-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => void copyLink(item.id)}
                    disabled={item.status !== "active"}
                  >
                    {copiedId === item.id ? "已复制 ✓" : "复制"}
                  </button>
                  {confirming === item.id ? (
                    <>
                      <button type="button" className="danger-btn" onClick={() => void remove(item.id)}>
                        确认删除
                      </button>
                      <button type="button" className="ghost-btn" onClick={cancelConfirm}>
                        取消
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ghost-btn danger-text" onClick={() => startConfirm(item.id)}>
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              type="button"
              className="ghost-btn"
              disabled={state.page <= 1 || loading}
              onClick={() => void load(state.page - 1)}
            >
              上一页
            </button>
            <span>
              {state.page} / {totalPages}
            </span>
            <button
              type="button"
              className="ghost-btn"
              disabled={state.page >= totalPages || loading}
              onClick={() => void load(state.page + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
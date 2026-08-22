/**
 * MyProjects — the user's own projects at /my-projects (T307).
 *
 * Lists drafts + published works with status badges, edit entry
 * (→ /publish?edit=<id>), publish and delete actions with confirmation.
 */
import { useCallback, useEffect, useState } from "react";
import type { ProjectStatus } from "@wellorbetter/shared";
import { StatusBadge } from "../components/StatusBadge.js";
import { projectApi, type ProjectDraftOutput } from "../projectApi.js";

type Filter = "all" | ProjectStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
];

export interface MyProjectsPageProps {
  onEdit: (id: string) => void;
  onView: (slug: string) => void;
}

export function MyProjectsPage({ onEdit, onView }: MyProjectsPageProps) {
  const [items, setItems] = useState<ProjectDraftOutput[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    projectApi
      .listMine(filter === "all" ? undefined : { status: filter })
      .then((res) => setItems(res.items))
      .catch(() => setError("加载失败，请稍后再试"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(load, [load]);

  const publishOne = async (id: string) => {
    try {
      await projectApi.publish(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    }
  };

  const removeOne = async (id: string) => {
    try {
      await projectApi.remove(id);
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <div className="my-projects-page">
      <div className="my-projects-head">
        <h1 className="home-title">我的作品</h1>
        <div className="segmented" role="tablist" aria-label="状态筛选">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? "segment is-active" : "segment"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-block">加载中…</div>
      ) : error ? (
        <div className="feed-status feed-error" role="alert">
          <p className="feed-status-hint">{error}</p>
          <button type="button" className="ghost-btn" onClick={load}>
            重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="feed-status feed-empty">
          <p className="feed-status-title">还没有作品</p>
          <p className="feed-status-hint">去发布你的第一个 vibe coding 作品吧</p>
        </div>
      ) : (
        <ul className="my-projects-list">
          {items.map((p) => (
            <li key={p.id} className="my-project-row">
              <div className="my-project-info">
                <button type="button" className="my-project-title" onClick={() => onView(p.slug)}>
                  {p.title}
                </button>
                <span className="muted my-project-slug">/p/{p.slug}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="my-project-actions">
                {p.status === "draft" && (
                  <>
                    <button type="button" className="ghost-btn" onClick={() => onEdit(p.id)}>
                      编辑
                    </button>
                    <button type="button" className="primary-btn" onClick={() => void publishOne(p.id)}>
                      发布
                    </button>
                  </>
                )}
                {p.status === "published" && (
                  <button type="button" className="ghost-btn" onClick={() => onView(p.slug)}>
                    查看
                  </button>
                )}
                {confirmDeleteId === p.id ? (
                  <>
                    <button type="button" className="danger-btn" onClick={() => void removeOne(p.id)}>
                      确认删除
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => setConfirmDeleteId(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  p.status !== "removed" && (
                    <button type="button" className="ghost-btn" onClick={() => setConfirmDeleteId(p.id)}>
                      删除
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

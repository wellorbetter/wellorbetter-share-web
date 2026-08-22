/**
 * AdminProjects — admin moderation console at /admin/projects (T301).
 *
 * Lists all projects (GET /api/admin/projects) with status filter + search,
 * and pending reports (GET /api/admin/reports) with resolve/dismiss actions
 * (POST /api/admin/reports/:id/resolve), plus project hide/unhide/remove
 * moderation (POST /api/admin/projects/:id/moderate).
 */
import { useCallback, useEffect, useState } from "react";
import type { ModerationStatus, ProjectStatus } from "@wellorbetter/shared";
import { StatusBadge } from "../components/StatusBadge.js";
import { request, ApiError } from "../api.js";

interface AdminProjectItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: ProjectStatus;
  ownerId: string;
  ownerName: string | null;
  createdAt: number;
  publishedAt: number | null;
}

interface AdminReportItem {
  id: string;
  projectId: string;
  projectTitle: string | null;
  reason: string;
  description: string | null;
  moderationStatus: ModerationStatus;
  createdAt: number;
}

type Tab = "projects" | "reports";

const STATUS_FILTERS: Array<{ value: ProjectStatus | "all"; label: string }> = [
  { value: "all", label: "全部" },
  { value: "published", label: "已发布" },
  { value: "draft", label: "草稿" },
  { value: "hidden", label: "已隐藏" },
  { value: "removed", label: "已删除" },
];

const REASON_LABELS: Record<string, string> = {
  spam: "垃圾信息",
  copyright: "侵犯版权",
  malware: "恶意软件",
  nsfw: "不适内容",
  other: "其他",
};

const STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: "待处理",
  reviewed: "已处理",
  dismissed: "已驳回",
};

export function AdminProjectsPage() {
  const [tab, setTab] = useState<Tab>("reports");
  const [projects, setProjects] = useState<AdminProjectItem[]>([]);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Pending action awaiting reason confirmation. */
  const [pending, setPending] = useState<{
    kind: "moderate" | "resolve";
    targetId: string;
    projectId?: string;
    action: string;
    label: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const jobs: Array<Promise<void>> = [];

    const q = new URLSearchParams();
    if (statusFilter !== "all") q.set("status", statusFilter);
    if (search.trim()) q.set("search", search.trim());
    jobs.push(
      request<{ items: AdminProjectItem[]; total: number }>(`/api/admin/projects?${q}`)
        .then((r) => setProjects(r.items))
        .catch(() => setError("作品列表加载失败")),
    );

    if (tab === "reports") {
      jobs.push(
        request<{ items: AdminReportItem[]; total: number }>(`/api/admin/reports?status=pending`)
          .then((r) => setReports(r.items))
          .catch(() => setError("举报列表加载失败")),
      );
    }

    Promise.all(jobs).finally(() => setLoading(false));
  }, [statusFilter, search, tab]);

  useEffect(load, [load]);

  const moderate = async (projectId: string, action: string, why: string) => {
    setBusyId(projectId);
    setError(null);
    try {
      await request(`/api/admin/projects/${projectId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, reason: why, confirmAction: action }),
      });
      setPending(null);
      setReason("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const resolveReport = async (reportId: string, action: "resolve_report" | "dismiss_report", why: string) => {
    setBusyId(reportId);
    setError(null);
    try {
      await request(`/api/admin/reports/${reportId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action, reason: why }),
      });
      setPending(null);
      setReason("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPending = () => {
    if (!pending || !reason.trim()) return;
    if (pending.kind === "moderate") void moderate(pending.projectId ?? pending.targetId, pending.action, reason.trim());
    else void resolveReport(pending.targetId, pending.action as "resolve_report" | "dismiss_report", reason.trim());
  };

  return (
    <div className="admin-projects-page">
      <h1 className="home-title">作品与举报管理</h1>

      <div className="segmented" role="tablist" aria-label="管理视图">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          className={tab === "reports" ? "segment is-active" : "segment"}
          onClick={() => setTab("reports")}
        >
          待处理举报{reports.length > 0 ? ` (${reports.length})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "projects"}
          className={tab === "projects" ? "segment is-active" : "segment"}
          onClick={() => setTab("projects")}
        >
          全部作品
        </button>
      </div>

      {tab === "projects" && (
        <div className="admin-projects-filters">
          <div className="segmented" role="group" aria-label="状态筛选">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={statusFilter === f.value ? "segment is-active" : "segment"}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="admin-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题 / slug"
          />
        </div>
      )}

      {error && <p className="publish-error" role="alert">{error}</p>}

      {pending && (
        <div className="admin-reason-box" role="dialog" aria-label={`${pending.label}确认`}>
          <strong>{pending.label}</strong>
          <p className="muted">填写处理理由（写入审计日志）</p>
          <input
            className="admin-search"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：违反社区规范"
            autoFocus
          />
          <div className="my-project-actions">
            <button type="button" className="danger-btn" disabled={!reason.trim() || busyId !== null} onClick={confirmPending}>
              确认执行
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setPending(null);
                setReason("");
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-block">加载中…</div>
      ) : tab === "reports" ? (
        reports.length === 0 ? (
          <div className="feed-status feed-empty">
            <p className="feed-status-title">没有待处理举报</p>
          </div>
        ) : (
          <ul className="admin-report-list">
            {reports.map((r) => (
              <li key={r.id} className="admin-report-row">
                <div className="admin-report-info">
                  <strong>{REASON_LABELS[r.reason] ?? r.reason}</strong>
                  {r.projectTitle && <span className="muted"> · {r.projectTitle}</span>}
                  {r.description && <p className="admin-report-desc">{r.description}</p>}
                  <span className="muted">{new Date(r.createdAt).toLocaleString("zh-CN")}</span>
                </div>
                <div className="my-project-actions">
                  <button
                    type="button"
                    className="danger-btn"
                    disabled={busyId === r.id}
                    onClick={() => setPending({ kind: "resolve", targetId: r.id, action: "resolve_report", label: "标记举报已处理" })}
                  >
                    处理完成
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busyId === r.id}
                    onClick={() => setPending({ kind: "resolve", targetId: r.id, action: "dismiss_report", label: "驳回举报" })}
                  >
                    驳回
                  </button>
                  {r.projectId && (
                    <>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busyId === r.id}
                        onClick={() => setPending({ kind: "moderate", targetId: r.projectId!, projectId: r.projectId, action: "hide_project", label: `隐藏作品 ${r.projectTitle ?? ""}`.trim() })}
                      >
                        隐藏作品
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busyId === r.id}
                        onClick={() => setPending({ kind: "moderate", targetId: r.projectId!, projectId: r.projectId, action: "remove_project", label: `下架作品 ${r.projectTitle ?? ""}`.trim() })}
                      >
                        下架作品
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="my-projects-list">
          {projects.map((p) => (
            <li key={p.id} className="my-project-row">
              <div className="my-project-info">
                <span className="my-project-title">{p.title}</span>
                <span className="muted my-project-slug">/p/{p.slug}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="my-project-actions">
                {p.status === "published" && (
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busyId === p.id}
                    onClick={() => setPending({ kind: "moderate", targetId: p.id, projectId: p.id, action: "hide_project", label: `隐藏 ${p.title}` })}
                  >
                    隐藏
                  </button>
                )}
                {p.status === "hidden" && (
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busyId === p.id}
                    onClick={() => setPending({ kind: "moderate", targetId: p.id, projectId: p.id, action: "unhide_project", label: `恢复 ${p.title}` })}
                  >
                    恢复
                  </button>
                )}
                {p.status !== "removed" && (
                  <button
                    type="button"
                    className="danger-btn"
                    disabled={busyId === p.id}
                    onClick={() => setPending({ kind: "moderate", targetId: p.id, projectId: p.id, action: "remove_project", label: `下架 ${p.title}` })}
                  >
                    下架
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

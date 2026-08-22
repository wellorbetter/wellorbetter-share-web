/**
 * ProjectDetail — public project page at /p/:slug (T307).
 *
 * - Cover / media gallery (lazy images, video poster-only)
 * - Title / author / tags / status badge
 * - Vibe Notes list
 * - "试玩" (experienceUrl): sandboxed iframe, user-initiated, default collapsed
 * - Release external link: noopener + unreviewed warning
 * - Report dialog (anonymous allowed, rate-limited server-side)
 */
import { useCallback, useEffect, useState } from "react";
import type { ProjectDetail as ProjectDetailDto, ReportReason } from "@wellorbetter/shared";
import { StatusBadge } from "../components/StatusBadge.js";
import { projectApi, ApiError } from "../projectApi.js";

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "malware", label: "恶意软件 / 病毒" },
  { value: "copyright", label: "侵犯版权" },
  { value: "spam", label: "垃圾信息" },
  { value: "nsfw", label: "不适内容" },
  { value: "other", label: "其他" },
];

export function ProjectDetailPage({ slug, onBack }: { slug: string; onBack?: () => void }) {
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playOpen, setPlayOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    projectApi
      .detail(slug)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const back = useCallback(() => {
    if (onBack) onBack();
    else window.history.back();
  }, [onBack]);

  if (loading) return <div className="loading-block">加载中…</div>;
  if (error)
    return (
      <div className="feed-status feed-error" role="alert">
        <p className="feed-status-title">作品不存在或已下架</p>
        <p className="feed-status-hint">{error}</p>
        <button type="button" className="ghost-btn" onClick={back}>
          返回
        </button>
      </div>
    );
  if (!detail) return null;

  const { card, versions, media, vibeNotes } = detail;
  const images = media.filter((m) => m.type === "image" || m.type === "cover");
  const latestVersion = versions[0] ?? null;
  const experienceUrl = latestVersion?.experienceUrl ?? null;
  const releaseUrl = latestVersion?.releaseUrl ?? null;
  const isUnreviewed = latestVersion?.isUnreviewed ?? true;

  return (
    <article className="project-detail">
      <button type="button" className="ghost-btn project-back" onClick={back}>
        ← 返回
      </button>

      <header className="project-header">
        <div>
          <h1 className="project-title">{card.title}</h1>
          <p className="project-author">
            by {card.authorName}
            {card.publishedAt && (
              <time className="project-time"> · {new Date(card.publishedAt).toLocaleDateString("zh-CN")}</time>
            )}
          </p>
        </div>
        <StatusBadge status={card.status} />
      </header>

      {card.summary && <p className="project-summary">{card.summary}</p>}

      {card.tags.length > 0 && (
        <div className="feed-card-tags project-tags">
          {card.tags.map((t) => (
            <span key={t} className="feed-card-tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="project-media">
          {images.map((m) => (
            <img
              key={m.id}
              src={m.type === "cover" && m.url ? m.url : m.url}
              alt={card.title}
              className="project-media-img"
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}

      {experienceUrl && (
        <section className="project-play">
          <div className="project-play-head">
            <h2>在线试玩</h2>
            <button
              type="button"
              className={playOpen ? "ghost-btn" : "primary-btn"}
              onClick={() => setPlayOpen((v) => !v)}
            >
              {playOpen ? "收起" : "进入试玩"}
            </button>
          </div>
          {playOpen && (
            <div className="project-play-frame">
              <iframe
                src={experienceUrl}
                title={`${card.title} 在线试玩`}
                sandbox="allow-scripts allow-forms allow-pointer-lock"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
          )}
          <p className="muted project-play-hint">试玩内容来自作者的外部站点，请注意账号与数据安全。</p>
        </section>
      )}

      {releaseUrl && (
        <section className="project-release">
          <h2>下载 / 获取</h2>
          {isUnreviewed && (
            <p className="unreviewed-warning" role="warning">
              ⚠️ 该构建产物来自外部链接，未经平台审核，请自行确认来源安全。
            </p>
          )}
          <button
            type="button"
            className="primary-btn project-release-link"
            onClick={() => {
              if (window.confirm(`即将离开本站，打开外部下载链接：\n\n${releaseUrl}\n\n该链接由作品作者提供，请注意安全。继续？`)) {
                window.open(releaseUrl, "_blank", "noopener,noreferrer");
              }
            }}
          >
            打开下载链接
          </button>
        </section>
      )}

      <section className="project-notes">
        <h2>Vibe Notes</h2>
        {vibeNotes.length === 0 ? (
          <p className="muted">作者还没有记录创作笔记。</p>
        ) : (
          <ul className="project-notes-list">
            {vibeNotes.map((n) => (
              <li key={n.id} className="project-note">
                <p className="project-note-content">{n.content}</p>
                <time className="project-note-time">{new Date(n.createdAt).toLocaleDateString("zh-CN")}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="project-footer">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setReportOpen((v) => !v)}
          aria-expanded={reportOpen}
        >
          举报此作品
        </button>
        {reportOpen && (
          <ReportForm
            projectId={card.id}
            onDone={() => setReportOpen(false)}
          />
        )}
      </footer>
    </article>
  );
}

function ReportForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason>("other");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"ok" | "dup" | "limited" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await projectApi.report(projectId, { reason, description: description || undefined });
      setResult("ok");
      setTimeout(onDone, 1200);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "duplicate_report") setResult("dup");
        else if (e.code === "rate_limited") setResult("limited");
        else setError(e.message);
      } else {
        setError("提交失败，请稍后再试");
      }
    } finally {
      setBusy(false);
    }
  };

  if (result === "ok") return <p className="muted">已收到举报，我们会尽快处理。</p>;
  if (result === "dup") return <p className="muted">你已举报过该作品，请勿重复提交。</p>;
  if (result === "limited") return <p className="muted">提交过于频繁，请稍后再试。</p>;

  return (
    <form
      className="report-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit();
      }}
    >
      <label>
        举报原因
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        补充说明（可选）
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="请描述问题（不要包含个人隐私）"
        />
      </label>
      {error && <p className="muted">{error}</p>}
      <button type="submit" className="primary-btn" disabled={busy}>
        {busy ? "提交中…" : "提交举报"}
      </button>
    </form>
  );
}

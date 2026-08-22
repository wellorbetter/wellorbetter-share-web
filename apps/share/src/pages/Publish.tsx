/**
 * Publish — create / edit / publish a project at /publish (T307).
 *
 * Flow: fill form → save draft (POST/PATCH) → optional cover upload
 * (media request → presigned PUT → complete) → publish.
 *
 * MVP notes:
 * - experienceUrl (试玩) has no backend API yet — versions API deferred;
 *   releaseUrl (external link) IS supported via create/update input.
 * - Cover upload uses the T203 media flow; on unsupported environments
 *   the form degrades to publish-without-cover.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReleaseKind } from "@wellorbetter/shared";
import { PROJECT_SUMMARY_MAX_LENGTH, PROJECT_TITLE_MAX_LENGTH } from "@wellorbetter/shared";
import { projectApi, ApiError, type ProjectDraftOutput } from "../projectApi.js";

type Phase = "form" | "saving" | "publishing" | "published";

export interface PublishPageProps {
  /** Existing project id (edit mode, from /publish/:id). */
  editId?: string;
  onPublished?: (slug: string) => void;
}

const RELEASE_OPTIONS: Array<{ value: ReleaseKind; label: string; hint?: string }> = [
  { value: "none", label: "不提供下载" },
  { value: "web", label: "Web 应用链接" },
  {
    value: "apk_external",
    label: "APK 外部链接",
    hint: "仅支持外链（GitHub Releases 等），平台不直传 EXE/APK",
  },
];

export function PublishPage({ editId, onPublished }: PublishPageProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [releaseKind, setReleaseKind] = useState<ReleaseKind>("none");
  const [releaseUrl, setReleaseUrl] = useState("");
  const [note, setNote] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [draft, setDraft] = useState<ProjectDraftOutput | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);

  // Edit mode: load existing draft fields.
  useEffect(() => {
    if (!editId) return;
    projectApi
      .listMine()
      .then((res) => {
        const found = res.items.find((p) => p.id === editId);
        if (found) {
          setTitle(found.title);
          setSummary(found.summary ?? "");
          setDraft(found);
        }
      })
      .catch(() => setError("无法加载原作品信息"));
  }, [editId]);

  const needsUrl = releaseKind !== "none";

  // Real-time validation — displayed inline as the user types.
  const validate = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "标题必填";
    else if (title.trim().length > PROJECT_TITLE_MAX_LENGTH)
      errs.title = `标题 ≤ ${PROJECT_TITLE_MAX_LENGTH} 字`;
    if (summary.length > PROJECT_SUMMARY_MAX_LENGTH)
      errs.summary = `简介 ≤ ${PROJECT_SUMMARY_MAX_LENGTH} 字`;
    if (needsUrl) {
      if (!releaseUrl.trim()) errs.releaseUrl = "请填写外部链接";
      else {
        try {
          const u = new URL(releaseUrl.trim());
          if (u.protocol !== "https:") errs.releaseUrl = "仅支持 https:// 链接";
        } catch {
          errs.releaseUrl = "链接格式不正确";
        }
      }
    }
    return errs;
  }, [title, summary, needsUrl, releaseUrl]);

  const canSubmit = Object.keys(validate).length === 0;

  const saveDraft = useCallback(async (): Promise<ProjectDraftOutput | null> => {
    if (!canSubmit) return null;

    setPhase("saving");
    setError(null);
    const body = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim() || undefined,
      releaseKind,
      releaseUrl: needsUrl ? releaseUrl.trim() : null,
    };
    try {
      const result = draft ? await projectApi.update(draft.id, body) : await projectApi.create(body);
      setDraft(result);
      setPhase("form");
      // Attach initial vibe note after create if provided.
      if (!draft && note.trim()) {
        try {
          await projectApi.createNote(result.id, note.trim());
        } catch {
          /* non-fatal: note can be added later */
        }
      }
      return result;
    } catch (e) {
      setPhase("form");
      if (e instanceof ApiError) setError(errorText(e));
      else setError("保存失败，请稍后再试");
      return null;
    }
  }, [canSubmit, draft, title, summary, description, releaseKind, needsUrl, releaseUrl, note]);

  const uploadCover = useCallback(async (projectId: string): Promise<boolean> => {
    if (!coverFile) return true; // cover optional
    const isImage = coverFile.type.startsWith("image/") && coverFile.type !== "image/svg+xml";
    if (!isImage) {
      setError("封面仅支持 JPEG/PNG/WebP/GIF");
      return false;
    }
    try {
      const req = await projectApi.mediaRequest(projectId, {
        type: "cover",
        contentType: coverFile.type,
        fileSize: coverFile.size,
      });
      const put = await fetch(req.presignedUrl, {
        method: "PUT",
        body: coverFile,
        headers: { "Content-Type": coverFile.type },
      });
      if (!put.ok) {
        setError(`封面上传失败（${put.status}）`);
        return false;
      }
      await projectApi.mediaComplete(projectId, req.mediaId);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "media_too_large") setError("封面超过 10MB 限制");
      else setError("封面上传失败，可先不传封面直接发布");
      return false;
    }
  }, [coverFile]);

  const publish = useCallback(async () => {
    if (!canSubmit) return;

    setPhase("publishing");
    setError(null);
    try {
      const current = draft ?? (await saveDraft());
      if (!current) {
        setPhase("form");
        return;
      }
      const coverOk = await uploadCover(current.id);
      if (!coverOk) {
        setPhase("form");
        return;
      }
      const res = await projectApi.publish(current.id);
      setPhase("published");
      const slug = (res as { project?: { card: { slug: string } } }).project?.card.slug ?? current.slug;
      if (onPublished) onPublished(slug);
    } catch (e) {
      setPhase("form");
      if (e instanceof ApiError) setError(errorText(e));
      else setError("发布失败，请稍后再试");
    }
  }, [canSubmit, draft, saveDraft, uploadCover, onPublished]);

  if (phase === "published") {
    return (
      <div className="feed-status" role="status">
        <p className="feed-status-title">发布成功 🎉</p>
        <p className="feed-status-hint">作品已进入公开发现流。</p>
      </div>
    );
  }

  const busy = phase === "saving" || phase === "publishing";

  return (
    <div className="publish-page">
      <h1 className="home-title">{editId || draft ? "编辑作品" : "发布作品"}</h1>
      <p className="muted publish-hint">展示你的 vibe coding 成果：一个标题、一句简介、可选的外部链接。</p>

      <form
        className="publish-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void publish();
        }}
      >
        <label className="publish-field">
          标题 *
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={PROJECT_TITLE_MAX_LENGTH}
            placeholder="例如：桌面宠物 Chocola"
            disabled={busy}
          />
          {validate.title && <span className="field-error">{validate.title}</span>}
        </label>

        <label className="publish-field">
          一句话简介
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={PROJECT_SUMMARY_MAX_LENGTH}
            rows={2}
            placeholder="用一句话说清它是干嘛的"
            disabled={busy}
          />
          {validate.summary && <span className="field-error">{validate.summary}</span>}
        </label>

        <label className="publish-field">
          详细说明（可选）
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={busy} />
        </label>

        <fieldset className="publish-field">
          <legend>下载方式</legend>
          {RELEASE_OPTIONS.map((o) => (
            <label key={o.value} className="publish-radio">
              <input
                type="radio"
                name="releaseKind"
                value={o.value}
                checked={releaseKind === o.value}
                onChange={() => setReleaseKind(o.value)}
                disabled={busy}
              />
              <span>
                {o.label}
                {o.hint && <em className="publish-radio-hint">{o.hint}</em>}
              </span>
            </label>
          ))}
          {needsUrl && (
            <input
              className="publish-url-input"
              value={releaseUrl}
              onChange={(e) => setReleaseUrl(e.target.value)}
              placeholder="https://github.com/you/your-app/releases/..."
              disabled={busy}
            />
          )}
          {validate.releaseUrl && <span className="field-error">{validate.releaseUrl}</span>}
        </fieldset>

        <label className="publish-field">
          封面图（可选，≤10MB）
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </label>

        {!draft && (
          <label className="publish-field">
            第一条 Vibe Note（可选）
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="记录一句创作想法 / 踩坑……"
              disabled={busy}
            />
          </label>
        )}

        {error && (
          <p className="publish-error" role="alert">
            {error}
          </p>
        )}

        <div className="publish-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void saveDraft()}
            disabled={busy || !canSubmit}
          >
            {draft ? "保存修改" : "存为草稿"}
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !canSubmit}>
            {phase === "publishing" ? "发布中…" : draft ? "发布" : "保存并发布"}
          </button>
        </div>
        {draft && <p className="muted">当前状态：草稿已保存（slug: {draft.slug}）</p>}
      </form>
    </div>
  );
}

/** Map stable error codes to friendly Chinese copy. */
function errorText(e: ApiError): string {
  switch (e.code) {
    case "validation_failed":
      return "内容校验未通过，请检查表单";
    case "url_not_allowed":
      return "该链接不被允许（仅支持公网 https 链接）";
    case "media_too_large":
      return "文件超过大小限制";
    case "quota_exceeded":
      return "存储配额不足，请删除旧作品后重试";
    case "rate_limited":
      return "操作过于频繁，请稍后再试";
    case "invalid_state":
      return "作品当前状态不允许此操作（可能已发布或已删除）";
    case "legacy_upload_frozen":
      return "旧上传入口已冻结，请使用本发布流程";
    default:
      return e.message || "请求失败";
  }
}

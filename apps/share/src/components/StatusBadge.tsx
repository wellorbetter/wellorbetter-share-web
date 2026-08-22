/**
 * StatusBadge — project status pill using the M3 --status-* tokens (T306).
 */
import type { ProjectStatus } from "@wellorbetter/shared";

const LABELS: Record<ProjectStatus, string> = {
  draft: "草稿",
  pending_media: "待补媒体",
  published: "已发布",
  rejected: "被拒",
  hidden: "已隐藏",
  removed: "已删除",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status] ?? status}</span>;
}

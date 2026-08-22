/**
 * FeedTabs — tab bar for latest / random / tag / author feeds.
 *
 * Mobile-first: horizontal scroll on narrow viewports, pill-style tabs.
 * Tag and author tabs expand an inline input when selected.
 */
import { useCallback, useRef, useState, type FormEvent } from "react";
import type { FeedType } from "@wellorbetter/shared";

export interface FeedTabsProps {
  active: FeedType;
  tag?: string;
  authorId?: string;
  onChange: (feed: FeedType, tag?: string, authorId?: string) => void;
}

const TABS: Array<{ feed: FeedType; label: string }> = [
  { feed: "latest", label: "最新" },
  { feed: "random", label: "随机" },
  { feed: "tag", label: "标签" },
  { feed: "author", label: "作者" },
];

export function FeedTabs({ active, tag, authorId, onChange }: FeedTabsProps) {
  const [tagInput, setTagInput] = useState(tag ?? "");
  const [authorInput, setAuthorInput] = useState(authorId ?? "");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);

  const handleTabClick = useCallback(
    (feed: FeedType) => {
      if (feed === "tag") {
        onChange(feed, tagInput || undefined, undefined);
        // Focus input after render
        setTimeout(() => tagInputRef.current?.focus(), 0);
      } else if (feed === "author") {
        onChange(feed, undefined, authorInput || undefined);
        setTimeout(() => authorInputRef.current?.focus(), 0);
      } else {
        onChange(feed);
      }
    },
    [onChange, tagInput, authorInput],
  );

  const handleTagSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onChange("tag", tagInput || undefined, undefined);
    },
    [onChange, tagInput],
  );

  const handleAuthorSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onChange("author", undefined, authorInput || undefined);
    },
    [onChange, authorInput],
  );

  return (
    <div className="feed-tabs" role="tablist" aria-label="Feed 类型">
      {TABS.map((t) => (
        <button
          key={t.feed}
          type="button"
          role="tab"
          aria-selected={active === t.feed}
          className={`feed-tab${active === t.feed ? " is-active" : ""}`}
          onClick={() => handleTabClick(t.feed)}
        >
          {t.label}
        </button>
      ))}

      {active === "tag" && (
        <form className="feed-tab-input" onSubmit={handleTagSubmit}>
          <input
            ref={tagInputRef}
            type="text"
            placeholder="输入标签…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="feed-tab-field"
            aria-label="标签筛选"
          />
        </form>
      )}

      {active === "author" && (
        <form className="feed-tab-input" onSubmit={handleAuthorSubmit}>
          <input
            ref={authorInputRef}
            type="text"
            placeholder="输入作者 ID…"
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            className="feed-tab-field"
            aria-label="作者筛选"
          />
        </form>
      )}
    </div>
  );
}

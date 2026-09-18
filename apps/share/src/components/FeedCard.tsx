import { useState } from "react";
import type { ProjectCard } from "@wellorbetter/shared";
import { pickAspect } from "../lib/aspect.js";
import { hashToHsl, placeholderInk } from "../lib/colors.js";

export interface FeedCardProps {
  card: ProjectCard;
  onOpen?: (slug: string) => void;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".m4v", ".mov"];

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase().split("?")[0]!.split("#")[0]!;
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function initial(value: string): string {
  return Array.from(value.trim())[0]?.toUpperCase() ?? "W";
}

/** Tags are the cheapest orientation on a card, but a card is ~250px wide —
 *  past three the row wraps and starts competing with the title. */
const MAX_TAGS = 3;

export function FeedCard({ card, onOpen }: FeedCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isVideoCover = card.coverUrl !== null && isVideoUrl(card.coverUrl);
  const showImage = card.coverUrl !== null && !isVideoCover && !imgFailed;
  const aspectRatio = pickAspect(card.slug, card.coverWidth, card.coverHeight);
  const [gradientFrom, gradientTo] = hashToHsl(card.slug);
  const tags = card.tags.slice(0, MAX_TAGS);

  return (
    <article className="feed-card" data-project-id={card.id}>
      <button
        type="button"
        className="feed-card-open"
        onClick={onOpen ? () => onOpen(card.slug) : undefined}
        aria-label={`查看 ${card.title}`}
      >
        <div className="feed-card-cover" style={{ aspectRatio }}>
          {showImage ? (
            <img
              src={card.coverUrl ?? undefined}
              alt={card.title}
              className="feed-card-img"
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className={isVideoCover ? "feed-card-placeholder feed-card-placeholder--video" : "feed-card-placeholder"}
              style={{
                backgroundImage: `linear-gradient(145deg, ${gradientFrom}, ${gradientTo})`,
                color: placeholderInk(card.slug),
              }}
              aria-hidden={isVideoCover ? undefined : "true"}
              role={isVideoCover ? "img" : undefined}
              aria-label={isVideoCover ? `${card.title} 视频封面` : undefined}
            >
              <span>{isVideoCover ? "🎬" : initial(card.title)}</span>
            </div>
          )}
        </div>

        <div className="feed-card-body">
          <h3 className="feed-card-title">{card.title}</h3>
          {/* summary is on every ProjectCard and was going unread. Without it a
              card is a title in a lot of whitespace, which is what made the feed
              look emptier than it is. */}
          {card.summary ? <p className="feed-card-summary">{card.summary}</p> : null}
          {tags.length > 0 ? (
            <ul className="feed-card-tags">
              {tags.map((tag) => (
                <li key={tag} className="feed-card-tag">{tag}</li>
              ))}
            </ul>
          ) : null}
          <div className="feed-card-author">
            <span className="feed-card-avatar" aria-hidden="true">{initial(card.authorName)}</span>
            <span>{card.authorName}</span>
          </div>
        </div>
      </button>
    </article>
  );
}

/**
 * Masonry — react-masonry-css wrapper with finite windowing.
 *
 * - Responsive columns: 2 (mobile) / 3 (tablet) / 4 (desktop) / 5 (large)
 * - Top spacer for dropped items (height estimated by useFeed)
 * - Sentinel element at bottom for IntersectionObserver
 * - 12px gap between cards
 */
import { type ReactNode, type RefObject } from "react";
import MasonryCSS from "react-masonry-css";

export interface MasonryProps {
  children: ReactNode;
  topSpacerPx: number;
  sentinelRef: RefObject<HTMLDivElement>;
  showSentinel: boolean;
  loadingIndicator?: ReactNode;
}

const breakpointCols = {
  default: 5,
  1440: 4,
  1024: 3,
  640: 2,
};

export function Masonry({
  children,
  topSpacerPx,
  sentinelRef,
  showSentinel,
  loadingIndicator,
}: MasonryProps) {
  return (
    <div className="masonry-container">
      {topSpacerPx > 0 && (
        <div
          className="masonry-top-spacer"
          style={{ height: `${topSpacerPx}px` }}
          aria-hidden="true"
        />
      )}

      <MasonryCSS
        breakpointCols={breakpointCols}
        className="masonry-grid"
        columnClassName="masonry-column"
      >
        {children}
      </MasonryCSS>

      {loadingIndicator}

      {showSentinel && (
        <div ref={sentinelRef} className="masonry-sentinel" aria-hidden="true" />
      )}
    </div>
  );
}

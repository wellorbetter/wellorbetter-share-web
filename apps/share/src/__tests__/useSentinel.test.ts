/**
 * Tests for useSentinel hook:
 *   - calls onIntersect when sentinel enters viewport
 *   - disconnects on unmount
 *   - no observation when disabled
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { useSentinel } from "../hooks/useSentinel.js";

type ObserverInstance = {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let instances: ObserverInstance[] = [];
let intersectCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
    intersectCallback = cb;
    const inst: ObserverInstance = { observe: this.observe, disconnect: this.disconnect };
    instances.push(inst);
  }
}

beforeEach(() => {
  instances = [];
  intersectCallback = null;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as unknown as typeof IntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeRef() {
  const el = document.createElement("div");
  return { ref: { current: el } as RefObject<HTMLElement>, el };
}

describe("useSentinel", () => {
  it("observes the sentinel element on mount", () => {
    const { ref } = makeRef();
    renderHook(() => useSentinel(ref, { onIntersect: () => {} }));

    expect(instances).toHaveLength(1);
    expect(instances[0]!.observe).toHaveBeenCalledWith(ref.current);
  });

  it("calls onIntersect when intersection fires", () => {
    const { ref } = makeRef();
    const onIntersect = vi.fn();
    renderHook(() => useSentinel(ref, { onIntersect }));

    act(() => {
      intersectCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });
    expect(onIntersect).toHaveBeenCalledTimes(1);

    // Non-intersecting entries do not fire
    act(() => {
      intersectCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    });
    expect(onIntersect).toHaveBeenCalledTimes(1);
  });

  it("does not observe when disabled", () => {
    const { ref } = makeRef();
    renderHook(() => useSentinel(ref, { onIntersect: () => {}, enabled: false }));

    expect(instances).toHaveLength(0);
  });

  it("disconnects on unmount", () => {
    const { ref } = makeRef();
    const { unmount } = renderHook(() => useSentinel(ref, { onIntersect: () => {} }));
    expect(instances[0]!.disconnect).not.toHaveBeenCalled();

    unmount();
    expect(instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not crash when ref.current is null", () => {
    const ref = { current: null } as unknown as RefObject<HTMLElement>;
    expect(() => renderHook(() => useSentinel(ref, { onIntersect: () => {} }))).not.toThrow();
    expect(instances).toHaveLength(0);
  });
});

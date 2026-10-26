import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBottomBarInset } from "../useBottomBarInset";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Harness({ enabled = true }) {
  const { contentRef, barRef } = useBottomBarInset(enabled);
  return <main ref={contentRef}><footer ref={barRef}>Summary</footer></main>;
}

it("reserves the measured height and follows footer expansion", () => {
  let height = 156.3;
  let resize;
  const disconnect = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  const { container, unmount } = render(<Harness />);
  const main = container.querySelector("main");
  expect(main.style.getPropertyValue("--pe-action-bar-height")).toBe("157px");
  height = 284;
  resize();
  expect(main.style.getPropertyValue("--pe-action-bar-height")).toBe("284px");
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(main.style.getPropertyValue("--pe-action-bar-height")).toBe("");
});

it("also measures on resize and details toggle without ResizeObserver", () => {
  let height = 140;
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height }));
  const { container } = render(<Harness />);
  height = 210;
  window.dispatchEvent(new Event("resize"));
  expect(container.querySelector("main").style.getPropertyValue("--pe-action-bar-height")).toBe("210px");
  height = 260;
  container.querySelector("footer").dispatchEvent(new Event("toggle"));
  expect(container.querySelector("main").style.getPropertyValue("--pe-action-bar-height")).toBe("260px");
});

it("attaches only while the action bar is enabled and cleans up when cancelled", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 84 });
  const { container, rerender } = render(<Harness enabled={false} />);
  const main = container.querySelector("main");
  expect(main.style.getPropertyValue("--pe-action-bar-height")).toBe("");
  rerender(<Harness enabled />);
  expect(main.style.getPropertyValue("--pe-action-bar-height")).toBe("84px");
  rerender(<Harness enabled={false} />);
  expect(main.style.getPropertyValue("--pe-action-bar-height")).toBe("");
});

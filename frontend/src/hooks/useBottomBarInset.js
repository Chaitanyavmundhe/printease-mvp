import { useEffect, useRef } from "react";

// Layout only: a changing footer must reserve its actual height, not hide the
// final form controls. Keep payment/preparation state out of this measurement.
export function useBottomBarInset(enabled = true) {
  const contentRef = useRef(null);
  const barRef = useRef(null);

  useEffect(() => {
    const content = contentRef.current;
    const bar = barRef.current;
    if (!enabled || !content || !bar) return;
    const measure = () => content.style.setProperty("--pe-action-bar-height", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    window.addEventListener("resize", measure);
    bar.addEventListener("toggle", measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      bar.removeEventListener("toggle", measure, true);
      content.style.removeProperty("--pe-action-bar-height");
    };
  }, [enabled]);

  return { contentRef, barRef };
}

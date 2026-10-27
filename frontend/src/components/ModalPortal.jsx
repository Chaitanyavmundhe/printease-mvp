import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

const layers = [];
let savedStyles;

// Portals escape transformed dashboard/table ancestors. A shared lock also lets
// a preview open over Documents without one dialog unlocking another's scroll.
export default function ModalPortal({ children, onClose, className = "", labelledBy, label, busy = false }) {
  const element = useRef(null);
  const token = useRef(Symbol("modal"));
  const close = useRef(onClose);
  close.current = onClose;
  const isBusy = useRef(busy);
  isBusy.current = busy;

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    if (!layers.length) {
      savedStyles = { body: document.body.style.overflow, html: document.documentElement.style.overflow };
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    layers.push(token.current);
    element.current?.focus({ preventScroll: true });
    function onKey(event) {
      if (layers[layers.length - 1] !== token.current) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!isBusy.current) close.current?.();
      }
      if (event.key !== "Tab") return;
      const controls = [...element.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter(node => node.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); element.current.focus(); return; }
      if (!element.current.contains(document.activeElement) || document.activeElement === element.current ||
          (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const key = token.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      const index = layers.indexOf(key);
      if (index !== -1) layers.splice(index, 1);
      if (!layers.length && savedStyles) {
        document.body.style.overflow = savedStyles.body;
        document.documentElement.style.overflow = savedStyles.html;
        savedStyles = null;
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div ref={element} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy}
      onClick={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}
      className={`fixed inset-0 z-[100] outline-none ${className}`}>
      {children}
    </div>,
    document.body
  );
}


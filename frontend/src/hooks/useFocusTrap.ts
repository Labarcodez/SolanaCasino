import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  active: boolean,
  onEscape?: () => void,
): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const focusFirst = () => {
      const nodes = focusables();
      (nodes[0] ?? container).focus();
    };

    requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = focusables();
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [active, onEscape]);

  return containerRef;
}

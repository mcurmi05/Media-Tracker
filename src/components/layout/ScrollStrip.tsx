import "../../styles/layout/ScrollStrip.css";
import { useCallback, useEffect, useRef, useState } from "react";

// A horizontally-scrolling strip with no scrollbar: vertical wheel input pans
// it sideways, and ‹ › arrows appear only when there's more to scroll in that
// direction. The inner scroll container keeps the consumer's `className` so its
// own layout/sizing styles still apply.
function ScrollStrip({ className = "", wrapClassName = "", children }) {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    // Translate vertical wheel scrolling into horizontal movement of the strip.
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
      el.removeEventListener("wheel", onWheel);
    };
  }, [updateArrows, children]);

  const scrollByDir = (dir) => {
    const el = ref.current;
    if (!el) return;
    const amount = Math.max(220, el.clientWidth * 0.8);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div className={`scroll-strip-wrap ${wrapClassName}`.trim()}>
      {canLeft && (
        <button
          type="button"
          className="scroll-strip-arrow scroll-strip-arrow-left"
          onClick={() => scrollByDir(-1)}
          aria-label="Scroll left"
        >
          {String.fromCharCode(0x2039)}
        </button>
      )}
      <div className={className} ref={ref}>
        {children}
      </div>
      {canRight && (
        <button
          type="button"
          className="scroll-strip-arrow scroll-strip-arrow-right"
          onClick={() => scrollByDir(1)}
          aria-label="Scroll right"
        >
          {String.fromCharCode(0x203a)}
        </button>
      )}
    </div>
  );
}

export default ScrollStrip;

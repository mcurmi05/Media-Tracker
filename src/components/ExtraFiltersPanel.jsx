import { useRef, useEffect } from "react";
import "../styles/ExtraFiltersPanel.css";

function ExtraFiltersPanel({ open, onClose, activeCount, onToggle, onClear, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="efp-wrap">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggle}
        className={`efp-trigger${activeCount > 0 ? " efp-trigger--active" : ""}`}
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      {open && (
        <div className="efp-panel">
          {children}
          {onClear && (
            <button
              type="button"
              className="efp-clear"
              onClick={onClear}
              disabled={!activeCount}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ExtraFiltersPanel;

import { useEffect, useRef, useState } from "react";
import "../styles/Toolbar.css";

export default function SortByMenu({ sortKey, sortDir, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = options.find((o) => o.value === sortKey);
  const toggleDir = () => onChange(sortKey, sortDir === "asc" ? "desc" : "asc");

  return (
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-flex", gap: "4px" }}
    >
      <button
        type="button"
        className="toolbar-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        Sort by{selected ? `: ${selected.label}` : ""}
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn--square"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleDir}
        title={sortDir === "asc" ? "Ascending" : "Descending"}
      >
        {sortDir === "asc" ? "↑" : "↓"}
      </button>
      {open && (
        <div className="menu-pop">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`menu-pop-item${
                o.value === sortKey ? " menu-pop-item--active" : ""
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.value, sortDir);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

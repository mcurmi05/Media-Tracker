import { useEffect, useRef, useState } from "react";

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
  const toggleDir = () =>
    onChange(sortKey, sortDir === "asc" ? "desc" : "asc");

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        margin: "6px",
      }}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        style={{
          height: "32px",
          padding: "0 12px",
          border: "1px solid #cccccc",
          borderRadius: "6px",
          backgroundColor: "#3b3b3b",
          color: "#ffffff",
          fontSize: "0.8rem",
          outline: "none",
          boxShadow: "none",
          cursor: "pointer",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        Sort by{selected ? `: ${selected.label}` : ""}
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleDir}
        title={sortDir === "asc" ? "Ascending" : "Descending"}
        style={{
          height: "32px",
          width: "32px",
          padding: 0,
          border: "1px solid #cccccc",
          borderRadius: "6px",
          backgroundColor: "#3b3b3b",
          color: "#ffffff",
          fontSize: "1rem",
          outline: "none",
          boxShadow: "none",
          cursor: "pointer",
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {sortDir === "asc"
          ? String.fromCharCode(0x2191)
          : String.fromCharCode(0x2193)}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            background: "#2c2c2c",
            border: "1px solid #444",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {options.map((o) => {
            const active = o.value === sortKey;
            return (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value, sortDir);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  background: active ? "#444" : "transparent",
                  color: "#ffffff",
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                  textAlign: "left",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = active
                    ? "#555"
                    : "#383838")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = active
                    ? "#444"
                    : "transparent")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

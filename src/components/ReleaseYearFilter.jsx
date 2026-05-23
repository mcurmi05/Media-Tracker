import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/RangeFilter.css";

function ReleaseYearFilter({ from, to, onChange, minYear, maxYear }) {
  const [open, setOpen] = useState(false);
  const [decadeOpen, setDecadeOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setDecadeOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setDecadeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const years = useMemo(() => {
    const lo = Math.min(minYear, maxYear);
    const hi = Math.max(minYear, maxYear);
    const arr = [];
    for (let y = hi; y >= lo; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const decades = useMemo(() => {
    const lo = Math.min(minYear, maxYear);
    const hi = Math.max(minYear, maxYear);
    const startDecade = Math.floor(hi / 10) * 10;
    const endDecade = Math.floor(lo / 10) * 10;
    const arr = [];
    for (let d = startDecade; d >= endDecade; d -= 10) arr.push(d);
    return arr;
  }, [minYear, maxYear]);

  let triggerLabel = "Release Years";
  if (from && to) triggerLabel = `Released ${from} - ${to}`;
  else if (from) triggerLabel = `Released from ${from}`;
  else if (to) triggerLabel = `Released to ${to}`;

  const pickDecade = (d) => {
    onChange({ from: String(d), to: String(d + 9) });
    setDecadeOpen(false);
  };

  return (
    <div ref={wrapRef} className="range-filter-wrap">
      <button
        type="button"
        className={`range-filter-trigger ${from || to ? "has-value" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="range-filter-popover">
          <div className="range-filter-columns">
            <div className="range-filter-column">
              <div className="range-filter-column-head">From</div>
              <button
                type="button"
                className="range-filter-clear"
                onClick={() => onChange({ from: "", to })}
                disabled={!from}
              >
                Clear
              </button>
              <div className="range-filter-year-list">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`range-filter-option ${
                      String(y) === String(from) ? "selected" : ""
                    }`}
                    onClick={() => onChange({ from: String(y), to })}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="range-filter-column">
              <div className="range-filter-column-head">To</div>
              <button
                type="button"
                className="range-filter-clear"
                onClick={() => onChange({ from, to: "" })}
                disabled={!to}
              >
                Clear
              </button>
              <div className="range-filter-year-list">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`range-filter-option ${
                      String(y) === String(to) ? "selected" : ""
                    }`}
                    onClick={() => onChange({ from, to: String(y) })}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="range-filter-decade-row">
            <button
              type="button"
              className="range-filter-decade-trigger"
              onClick={() => setDecadeOpen((v) => !v)}
            >
              Decade In
            </button>
            {decadeOpen && (
              <div className="range-filter-decade-menu">
                {decades.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="range-filter-decade-option"
                    onClick={() => pickDecade(d)}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="range-filter-footer">
            <button
              type="button"
              className="range-filter-clear-all"
              onClick={() => onChange({ from: "", to: "" })}
              disabled={!from && !to}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReleaseYearFilter;

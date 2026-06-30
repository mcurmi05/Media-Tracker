import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import "react-day-picker/style.css";
import "../../styles/search/RangeFilter.css";

function isoFromDate(d) {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

function dateFromIso(s) {
  if (!s) return undefined;
  try {
    return parseISO(s);
  } catch {
    return undefined;
  }
}

function fmtLabel(s) {
  const d = dateFromIso(s);
  if (!d || Number.isNaN(d.getTime())) return "";
  return format(d, "MMM d, yyyy");
}

function DateAddedFilter({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const fromDate = dateFromIso(from);
  const toDate = dateFromIso(to);

  const [fromMonth, setFromMonth] = useState(fromDate || new Date());
  const [toMonth, setToMonth] = useState(toDate || new Date());

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const fromLabel = fmtLabel(from);
  const toLabel = fmtLabel(to);

  let triggerLabel = "Dates Added";
  if (from && to) triggerLabel = `Added ${fromLabel} - ${toLabel}`;
  else if (from) triggerLabel = `Added from ${fromLabel}`;
  else if (to) triggerLabel = `Added to ${toLabel}`;

  const clearFrom = () => {
    onChange({ from: "", to });
    setFromMonth(new Date());
  };

  const clearTo = () => {
    onChange({ from, to: "" });
    setToMonth(new Date());
  };

  const clearAll = () => {
    onChange({ from: "", to: "" });
    setFromMonth(new Date());
    setToMonth(new Date());
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
        <div className="range-filter-popover range-filter-popover-dates">
          <div className="range-filter-dates-grid">
            <div className="range-filter-column">
              <div className="range-filter-column-head">From</div>
              <button
                type="button"
                className="range-filter-clear"
                onClick={clearFrom}
                disabled={!from}
              >
                Clear
              </button>
              <DayPicker
                mode="single"
                selected={fromDate}
                onSelect={(d) => {
                  onChange({ from: d ? isoFromDate(d) : "", to });
                  if (d) setFromMonth(d);
                }}
                month={fromMonth}
                onMonthChange={setFromMonth}
              />
            </div>
            <div className="range-filter-column">
              <div className="range-filter-column-head">To</div>
              <button
                type="button"
                className="range-filter-clear"
                onClick={clearTo}
                disabled={!to}
              >
                Clear
              </button>
              <DayPicker
                mode="single"
                selected={toDate}
                onSelect={(d) => {
                  onChange({ from, to: d ? isoFromDate(d) : "" });
                  if (d) setToMonth(d);
                }}
                month={toMonth}
                onMonthChange={setToMonth}
              />
            </div>
          </div>
          <div className="range-filter-footer">
            <button
              type="button"
              className="range-filter-clear-all"
              onClick={clearAll}
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

export default DateAddedFilter;

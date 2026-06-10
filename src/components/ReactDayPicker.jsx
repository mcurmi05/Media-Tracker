import { useEffect, useId, useRef, useState } from "react";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import "../styles/ReactDayPicker.css";

export function Dialog({
  initialDate,
  onDateChange,
  showWeekday,
  dateColor,
  iconGap = "10px",
  minWidth = "150px",
  // Text shown when no date is set
  placeholder = "Pick a date",
  // Optional extra action buttons rendered inside the picker modal.
  // Each: { label, onClick, danger?, disabled? }
  extraActions = [],
}) {
  const dialogRef = useRef(null);
  const dialogId = useId();
  const headerId = useId();

  const [month, setMonth] = useState(initialDate || new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate || undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const toggleDialog = () => setIsDialogOpen(!isDialogOpen);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (isDialogOpen) {
      document.body.style.overflow = "hidden";
      dialogRef.current.showModal();
    } else {
      document.body.style.overflow = "";
      dialogRef.current.close();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDialogOpen]);

  // Close the dialog when clicking on the backdrop (native dialog area)
  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    const onBackdropClick = (e) => {
      if (e.target === dialogEl) setIsDialogOpen(false);
    };
    dialogEl.addEventListener("click", onBackdropClick);
    return () => dialogEl.removeEventListener("click", onBackdropClick);
  }, [dialogRef]);

  const dateFormat = showWeekday ? "EEE, dd MMM yyyy" : "dd MMM yyyy";

  const handleDayPickerSelect = (date) => {
    if (!date) {
      dialogRef.current?.close();
      return;
    }
    setMonth(date);
    setSelectedDate(date);
    setIsDialogOpen(false);
    if (onDateChange) onDateChange(date);
  };

  const displayText = selectedDate
    ? format(selectedDate, dateFormat)
    : placeholder;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: iconGap,
          justifyContent: "center",
          width: "100%",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.95rem",
            color: typeof dateColor === "string" ? dateColor : "#fff",
            textAlign: "center",
            minWidth: minWidth,
            fontWeight: 500,
            letterSpacing: "0.01em",
            textShadow: "0 1px 4px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flexShrink: 0,
          }}
        >
          {displayText}
        </p>
        <img
          onClick={toggleDialog}
          aria-controls="dialog"
          aria-haspopup="dialog"
          aria-expanded={isDialogOpen}
          style={{ padding: 0, cursor: "pointer" }}
          src="/calendar.png"
          width="20px"
          alt="Pick a date"
        />
      </div>
      {isDialogOpen && (
        <div
          role="presentation"
          onClick={() => setIsDialogOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1000,
            cursor: "pointer",
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <dialog
          role="dialog"
          ref={dialogRef}
          id={dialogId}
          aria-modal
          aria-labelledby={headerId}
          onClose={() => setIsDialogOpen(false)}
        >
          <div style={{ position: "relative" }}>
            <button
              aria-label="Close date picker"
              onClick={() => setIsDialogOpen(false)}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 10,
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: 18,
                cursor: "pointer",
                padding: "2px 6px",
                outline: "none",
                boxShadow: "none",
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div style={{ padding: "36px 12px 12px 12px", boxSizing: "border-box" }}>
              <DayPicker
                month={month}
                onMonthChange={setMonth}
                autoFocus
                mode="single"
                selected={selectedDate}
                onSelect={handleDayPickerSelect}
                footer={
                  selectedDate
                    ? `Selected: ${selectedDate.toDateString()}`
                    : "Pick a date"
                }
              />
              {extraActions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "center",
                    marginTop: 10,
                  }}
                >
                  {extraActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (!action.disabled && action.onClick) action.onClick();
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={action.disabled}
                      style={{
                        background: action.danger ? "#c91919" : "transparent",
                        color: action.disabled ? "#777" : "white",
                        border: action.danger
                          ? "1px solid #c91919"
                          : "1px solid #555",
                        borderRadius: 6,
                        padding: "6px 12px",
                        cursor: action.disabled ? "default" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        outline: "none",
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </dialog>
      </div>
    </>
  );
}

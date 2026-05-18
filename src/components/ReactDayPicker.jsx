import { useEffect, useId, useRef, useState } from "react";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";

export function Dialog({
  initialDate,
  onDateChange,
  showWeekday,
  dateColor,
  iconGap = "10px",
  minWidth = "150px",
  // Multi-day movie log support (movies only)
  enableMultiDay = false,
  endDate = null,
  onEndDateChange,
  isMultiDay = false,
  onMultiDayChange,
}) {
  const dialogRef = useRef(null);
  const dialogId = useId();
  const headerId = useId();

  const [month, setMonth] = useState(initialDate || new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Which date the calendar is editing while in multi-day mode
  const [activeField, setActiveField] = useState("start");

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
      // If the click target is the dialog itself (i.e., the backdrop), close without changing date
      if (e.target === dialogEl) {
        setIsDialogOpen(false);
      }
    };
    dialogEl.addEventListener("click", onBackdropClick);
    return () => dialogEl.removeEventListener("click", onBackdropClick);
  }, [dialogRef]);

  const dateFormat = showWeekday ? "EEE, dd MMM yyyy" : "dd MMM yyyy";

  // When a date is picked
  const handleDayPickerSelect = (date) => {
    if (!date) {
      dialogRef.current?.close();
      return;
    }
    setMonth(date);
    // Multi-day mode: route the pick to whichever field is active and keep open
    if (enableMultiDay && isMultiDay) {
      if (activeField === "end") {
        if (onEndDateChange) onEndDateChange(date);
      } else {
        setSelectedDate(date);
        if (onDateChange) onDateChange(date);
      }
      return;
    }
    // Single-day mode: pick and close
    setSelectedDate(date);
    setIsDialogOpen(false);
    if (onDateChange) onDateChange(date);
  };

  // Toggle between single-day and multi-day movie log mode
  const handleMultiDayToggle = () => {
    const next = !isMultiDay;
    if (next) setActiveField("start");
    if (onMultiDayChange) onMultiDayChange(next);
  };

  // Switch which date the calendar edits in multi-day mode
  const selectField = (field) => {
    setActiveField(field);
    if (field === "end" && endDate) setMonth(endDate);
    if (field === "start" && selectedDate) setMonth(selectedDate);
  };

  const multiDayActive = enableMultiDay && isMultiDay;
  const calendarSelected =
    multiDayActive && activeField === "end"
      ? endDate || undefined
      : selectedDate;

  // Display text: single date, or "date1 - date2" in multi-day mode
  let displayText = "Pick a date";
  if (multiDayActive) {
    const start = selectedDate ? format(selectedDate, dateFormat) : "...";
    const end = endDate ? format(endDate, dateFormat) : "...";
    displayText = `${start} - ${end}`;
  } else if (selectedDate) {
    displayText = format(selectedDate, dateFormat);
  }

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
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: 18,
                cursor: "pointer",
                padding: 4,
                outline: "none",
                boxShadow: "none",
              }}
            >
              ×
            </button>
            <div style={{ padding: 12, boxSizing: "border-box" }}>
              {multiDayActive && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  {["start", "end"].map((field) => (
                    <button
                      key={field}
                      onClick={() => selectField(field)}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        background:
                          activeField === field ? "#e50914" : "transparent",
                        color: "white",
                        border: "1px solid #555",
                        borderRadius: 6,
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        outline: "none",
                      }}
                    >
                      {field}
                    </button>
                  ))}
                </div>
              )}
              <DayPicker
                month={month}
                onMonthChange={setMonth}
                autoFocus
                mode="single"
                selected={calendarSelected}
                onSelect={handleDayPickerSelect}
                footer={
                  multiDayActive
                    ? `Start: ${
                        selectedDate
                          ? selectedDate.toDateString()
                          : "not set"
                      } - End: ${
                        endDate ? endDate.toDateString() : "not set"
                      }`
                    : selectedDate !== undefined &&
                      `Selected: ${selectedDate.toDateString()}`
                }
              />
              {enableMultiDay && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 10,
                  }}
                >
                  <button
                    onClick={handleMultiDayToggle}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      background: "transparent",
                      color: "white",
                      border: "1px solid #555",
                      borderRadius: 6,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    {isMultiDay
                      ? "Set to single day movie mode"
                      : "Set to multi-day movie log"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </dialog>
      </div>
    </>
  );
}

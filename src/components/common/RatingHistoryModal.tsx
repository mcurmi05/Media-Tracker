import { useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 380,
  maxWidth: "92vw",
  maxHeight: "80vh",
  overflowY: "auto",
  bgcolor: "#1a1a1a",
  color: "white",
  boxShadow: 24,
  p: 3,
  borderRadius: 2,
};

const confirmBtnStyle = {
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "bold",
  padding: "2px 8px",
};

// Every rating event for a title (set + each change), newest first. Events
// come from the user_ratings.rating_history jsonb column: [{ rating, at }].
// When onDeleteEvent is provided, each event can be deleted (with an inline
// confirmation); it receives the event's index in the original history array.
export default function RatingHistoryModal({
  open,
  onClose,
  title,
  history = [],
  onDeleteEvent = null,
}) {
  // Index (in the original array) of the event awaiting delete confirmation.
  const [confirmIdx, setConfirmIdx] = useState(null);

  // Keep each event's original array index so deletes hit the right entry
  // after the newest-first sort.
  const events = (history || [])
    .map((e, i) => ({ ...e, _idx: i }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleClose = () => {
    setConfirmIdx(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: "bold", fontSize: "1.05rem", marginBottom: 4 }}>
          Rating history{title ? `: ${title}` : ""}
        </div>
        <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: 14 }}>
          Every time this rating was set or changed.
        </div>
        {events.length === 0 ? (
          <div style={{ color: "#888", padding: "8px 0" }}>
            No history recorded for this rating yet.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {events.map((e, i) => (
              <li
                key={`${e.at}-${e._idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom:
                    i < events.length - 1 ? "1px solid #333" : "none",
                }}
              >
                <span style={{ color: "#ccc", fontSize: "0.92rem" }}>
                  {e.at ? fmt(e.at) : "Unknown date"}
                  {i === events.length - 1 ? " (first rated)" : ""}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    {e.rating}
                  </span>
                  {onDeleteEvent &&
                    (confirmIdx === e._idx ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ color: "#e23030", fontSize: "0.85rem" }}>
                          Delete?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteEvent(e._idx);
                            setConfirmIdx(null);
                          }}
                          style={{
                            ...confirmBtnStyle,
                            background: "#c91919",
                            color: "white",
                          }}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmIdx(null)}
                          style={{
                            ...confirmBtnStyle,
                            background: "#333",
                            color: "#ccc",
                          }}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        title="Delete this entry"
                        onClick={() => setConfirmIdx(e._idx)}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#777",
                          cursor: "pointer",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          outline: "none",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Box>
    </Modal>
  );
}

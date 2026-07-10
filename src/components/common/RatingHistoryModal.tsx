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

// Every rating event for a title (set + each change), newest first. Events
// come from the user_ratings.rating_history jsonb column: [{ rating, at }].
export default function RatingHistoryModal({
  open,
  onClose,
  title,
  history = [],
}) {
  const events = [...(history || [])].sort(
    (a, b) => new Date(b.at) - new Date(a.at),
  );
  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <Modal open={open} onClose={onClose}>
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
                key={`${e.at}-${i}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "8px 0",
                  borderBottom:
                    i < events.length - 1 ? "1px solid #333" : "none",
                }}
              >
                <span style={{ color: "#ccc", fontSize: "0.92rem" }}>
                  {e.at ? fmt(e.at) : "Unknown date"}
                  {i === events.length - 1 ? " (first rated)" : ""}
                </span>
                <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
                  {e.rating}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Box>
    </Modal>
  );
}

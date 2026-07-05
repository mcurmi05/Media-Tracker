import { useEffect, useRef, useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { supabase } from "../../services/supabase-client";
import { getTitleImages } from "../../services/api";
import { useLogs } from "../../contexts/UserLogsContext";
import { useBookLogs } from "../../contexts/UserBookLogsContext";
import { getBookInfo } from "../../utils/bookInfo";
import { Dialog } from "../common/ReactDayPicker";
import MovieRatingStar from "./MovieRatingStar";
import BookRatingStar from "../books/BookRatingStar";
import "../../styles/common/LogComponent.css";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 640,
  maxWidth: "94vw",
  maxHeight: "90vh",
  overflowY: "auto",
  bgcolor: "#1a1a1a",
  color: "white",
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

// Compact log editor shown right after a log is created: (movies/tv) pick a
// poster, set/adjust the watch date or mark it unknown, rate, and jot a note.
// Books get the same minus the poster grid. Every field saves to the new row.
export default function LogModal({ open, movie, book, logId, onConfirm, onCancel }) {
  const isBook = !!book;
  const { updateLog, updateDate, patchLog } = useLogs();
  const { updateBookLog } = useBookLogs();

  const bookInfo = isBook ? getBookInfo(book) : null;
  const title = isBook ? bookInfo?.title : movie?.primaryTitle;

  const [note, setNote] = useState("");
  const [posters, setPosters] = useState([]);
  const [selectedPoster, setSelectedPoster] = useState(
    isBook ? bookInfo?.cover_image || null : movie?.primaryImage || null,
  );
  const [dateUnknown, setDateUnknown] = useState(false);
  const [watchDate, setWatchDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const noteTimeout = useRef(null);

  // Load poster options once the modal opens (movies/tv only).
  useEffect(() => {
    if (!open || isBook || movie?.tmdb_id == null) return;
    let live = true;
    getTitleImages(movie.media_type, movie.tmdb_id).then((list) => {
      if (live) setPosters(Array.isArray(list) ? list : []);
    });
    return () => {
      live = false;
    };
  }, [open, isBook, movie?.tmdb_id, movie?.media_type]);

  // Debounced note save.
  useEffect(() => {
    if (!open) return;
    if (noteTimeout.current) clearTimeout(noteTimeout.current);
    noteTimeout.current = setTimeout(async () => {
      const value = note.trim() || null;
      if (isBook) {
        await updateBookLog(logId, { log: value });
      } else {
        const { error } = await supabase
          .from("user_logs")
          .update({ log: value })
          .eq("id", logId);
        if (!error) updateLog(logId, value);
      }
    }, 1000);
    return () => clearTimeout(noteTimeout.current);
  }, [note, open, logId, isBook, updateLog, updateBookLog]);

  async function choosePoster(url) {
    setSelectedPoster(url);
    setSaving(true);
    // Poster belongs to this log, not the shared media entry.
    const { error } = await supabase
      .from("user_logs")
      .update({ poster_url: url })
      .eq("id", logId);
    setSaving(false);
    if (!error) {
      // Reflect the new poster on the in-memory log so the Log page card and
      // this modal preview update immediately.
      patchLog(logId, {
        poster_url: url,
        movie_object: { ...movie, primaryImage: url, poster_url: url },
      });
    }
  }

  async function saveDate(date) {
    const iso = date.toISOString().slice(0, 10);
    setDateUnknown(false);
    setWatchDate(date);
    if (isBook) {
      await updateBookLog(logId, { start_date: iso });
    } else {
      const { error } = await supabase
        .from("user_logs")
        .update({ started_at: iso })
        .eq("id", logId);
      if (!error) updateDate(logId, iso);
    }
  }

  async function markDateUnknown() {
    setDateUnknown(true);
    if (isBook) {
      await updateBookLog(logId, { start_date: null });
    } else {
      const { error } = await supabase
        .from("user_logs")
        .update({ started_at: null })
        .eq("id", logId);
      if (!error) updateDate(logId, null);
    }
  }

  return (
    <Modal open={open} onClose={onCancel}>
      <Box sx={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: 16 }}>
          Log:{title ? ` ${title}` : ""}
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
          {/* current poster/cover preview */}
          <img
            src={selectedPoster || "/images/placeholderimage.jpg"}
            alt="Selected poster"
            style={{
              width: 120,
              height: 180,
              objectFit: "cover",
              borderRadius: 8,
              flexShrink: 0,
            }}
          />

          <div
            style={{
              flex: 1,
              minWidth: 240,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* date + rating row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.9rem", color: "#ccc" }}>
                  {isBook ? "Read:" : "Watched:"}
                </span>
                {dateUnknown ? (
                  <button
                    type="button"
                    onClick={() => saveDate(new Date())}
                    style={unknownBtnStyle}
                    title="Set a date"
                  >
                    Date unknown
                  </button>
                ) : (
                  <Dialog
                    initialDate={watchDate}
                    onDateChange={saveDate}
                    showWeekday={false}
                    dateColor="#fff"
                    minWidth="auto"
                    extraActions={[
                      { label: "Date unknown", onClick: markDateUnknown },
                    ]}
                  />
                )}
              </div>
              <div className="logmodal-rating">
                {isBook ? (
                  <BookRatingStar book={book} />
                ) : (
                  <MovieRatingStar movie={movie} />
                )}
              </div>
            </div>

            <textarea
              className="log-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a note or review (optional)..."
              style={{ width: "100%", flex: 1, minHeight: 100, resize: "none" }}
            />
          </div>
        </div>

        {/* poster grid (movies/tv only) */}
        {!isBook && posters.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: "0.9rem", color: "#ccc", marginBottom: 8 }}>
              Choose a poster
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))",
                gap: 8,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {posters.map((p) => (
                <img
                  key={p.full}
                  src={p.thumb}
                  alt="Poster option"
                  onClick={() => choosePoster(p.full)}
                  className={`poster-option${selectedPoster === p.full ? " is-selected" : ""}`}
                />
              ))}
            </div>
          </div>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={saving}
            sx={{
              color: "white",
              borderColor: "#666",
              "&:hover": { borderColor: "#888" },
              fontWeight: "bold",
              textTransform: "none",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={saving}
            sx={{
              fontWeight: "bold",
              textTransform: "none",
              backgroundColor: "#c91919",
              "&:hover": { backgroundColor: "#e23030" },
            }}
          >
            Add
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

const unknownBtnStyle = {
  background: "transparent",
  border: "1px dashed #666",
  color: "#bbb",
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: "0.85rem",
};

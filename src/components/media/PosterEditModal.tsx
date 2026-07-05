import { useEffect, useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { supabase } from "../../services/supabase-client";
import { getTitleImages } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useLogs } from "../../contexts/UserLogsContext";
import { useRatings } from "../../contexts/UserRatingsContext";
import { useWatchlist } from "../../contexts/UserWatchlistContext";

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

// Change the poster shown for a movie/tv log. The user picks a poster, then
// chooses how widely to apply it: this one log, every log they have of this
// title, or everywhere (the title's shared default cover).
export default function PosterEditModal({
  open,
  movie,
  logId,
  entryId,
  onClose,
  onApplied,
}) {
  const { user } = useAuth();
  const { patchLog, setUserLogs } = useLogs();
  const { setUserRatings } = useRatings();
  const { setUserWatchlist } = useWatchlist();

  const [posters, setPosters] = useState([]);
  const [selected, setSelected] = useState(movie?.primaryImage || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || movie?.tmdb_id == null) return;
    let live = true;
    setSelected(movie?.primaryImage || null);
    getTitleImages(movie.media_type, movie.tmdb_id).then((list) => {
      if (live) setPosters(Array.isArray(list) ? list : []);
    });
    return () => {
      live = false;
    };
  }, [open, movie?.tmdb_id, movie?.media_type, movie?.primaryImage]);

  const overrideObject = (mo) =>
    mo ? { ...mo, primaryImage: selected, poster_url: selected } : mo;

  async function applyThisLog() {
    setSaving(true);
    const { error } = await supabase
      .from("user_logs")
      .update({ poster_url: selected })
      .eq("id", logId);
    setSaving(false);
    if (!error) {
      patchLog(logId, {
        poster_url: selected,
        movie_object: overrideObject(movie),
      });
      onClose();
    }
  }

  async function applyAllMyLogs() {
    setSaving(true);
    const { error } = await supabase
      .from("user_logs")
      .update({ poster_url: selected })
      .eq("user_id", user.id)
      .eq("entry_id", entryId);
    setSaving(false);
    if (!error) {
      setUserLogs((prev) =>
        prev.map((l) =>
          l.movie_entry_id === entryId && l.user_id === user.id
            ? {
                ...l,
                poster_url: selected,
                movie_object: overrideObject(l.movie_object),
              }
            : l,
        ),
      );
      onClose();
    }
  }

  async function applyEverywhere() {
    setSaving(true);
    const { error } = await supabase
      .from("media_entries")
      .update({ cover_url: selected })
      .eq("id", entryId);
    setSaving(false);
    if (!error) {
      // Reflect the new default cover everywhere it's cached in state, so the
      // change shows without a reload. Logs that carry their own poster_url
      // keep their per-log override.
      const patchMatching = (row) =>
        row.movie_entry_id === entryId
          ? { ...row, movie_object: overrideObject(row.movie_object) }
          : row;
      setUserLogs((prev) =>
        prev.map((l) =>
          l.movie_entry_id === entryId && !l.poster_url
            ? { ...l, movie_object: overrideObject(l.movie_object) }
            : l,
        ),
      );
      setUserRatings((prev) => prev.map(patchMatching));
      setUserWatchlist((prev) => prev.map(patchMatching));
      onApplied?.(selected);
      onClose();
    }
  }

  const scopeBtn = {
    color: "white",
    borderColor: "#666",
    "&:hover": { borderColor: "#888" },
    fontWeight: "bold",
    textTransform: "none",
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: 6 }}>
          Change poster{movie?.primaryTitle ? `: ${movie.primaryTitle}` : ""}
        </div>
        <div style={{ color: "#aaa", fontSize: "0.9rem", marginBottom: 16 }}>
          Pick a poster, then choose where it applies.
        </div>

        {posters.length === 0 ? (
          <div style={{ color: "#888", padding: "12px 0" }}>
            No poster options found for this title.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
              gap: 10,
              maxHeight: 340,
              overflowY: "auto",
            }}
          >
            {posters.map((p) => (
              <img
                key={p.full}
                src={p.thumb}
                alt="Poster option"
                onClick={() => setSelected(p.full)}
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: 6,
                  cursor: "pointer",
                  border:
                    selected === p.full
                      ? "2px solid #e23030"
                      : "2px solid transparent",
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          <Button variant="outlined" onClick={onClose} disabled={saving} sx={scopeBtn}>
            Cancel
          </Button>
          {logId != null && (
            <>
              <Button
                variant="outlined"
                onClick={applyThisLog}
                disabled={saving || !selected}
                sx={scopeBtn}
              >
                Only this log
              </Button>
              <Button
                variant="outlined"
                onClick={applyAllMyLogs}
                disabled={saving || !selected}
                sx={scopeBtn}
              >
                Every log of this title
              </Button>
            </>
          )}
          <Button
            variant="contained"
            onClick={applyEverywhere}
            disabled={saving || !selected || !entryId}
            sx={{
              fontWeight: "bold",
              textTransform: "none",
              whiteSpace: "nowrap",
              backgroundColor: "#c91919",
              "&:hover": { backgroundColor: "#e23030" },
            }}
          >
            Everywhere
          </Button>
        </div>
      </Box>
    </Modal>
  );
}

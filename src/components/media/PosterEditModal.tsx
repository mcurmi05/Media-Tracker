import { useEffect, useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import "../../styles/layout/Loader.css";
import { getTitleImages, getBookCovers } from "../../services/api";
import { useCovers } from "../../contexts/UserCoversContext";

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

// Change the cover a user sees for a title. The picked poster is stored as a
// per-user override (user_media_covers) and shows everywhere that user sees the
// title - logs, ratings, watchlist, details - without changing what anyone else
// sees. Works for movies/tv (TMDB posters) and books (Hardcover editions).
export default function PosterEditModal({
  open,
  entryId,
  mediaType,
  tmdbId,
  hardcoverId,
  title,
  currentImage,
  onClose,
}) {
  const { coverFor, setCover } = useCovers();
  const isBook = mediaType === "book";

  const [posters, setPosters] = useState([]);
  const [selected, setSelected] = useState(
    coverFor(entryId) ?? currentImage ?? null,
  );
  const [customUrl, setCustomUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(coverFor(entryId) ?? currentImage ?? null);
    setCustomUrl("");
    let live = true;
    setLoading(true);
    setPosters([]);
    const fetcher = isBook
      ? hardcoverId != null
        ? getBookCovers(hardcoverId)
        : Promise.resolve([])
      : tmdbId != null
        ? getTitleImages(mediaType, tmdbId)
        : Promise.resolve([]);
    fetcher
      .then((list) => {
        if (live) setPosters(Array.isArray(list) ? list : []);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isBook, tmdbId, hardcoverId, mediaType]);

  const hasOverride = coverFor(entryId) != null;

  const keys = { mediaType, tmdbId, hardcoverId };

  async function apply() {
    setSaving(true);
    await setCover(entryId, selected, keys);
    setSaving(false);
    onClose();
  }

  async function resetToDefault() {
    setSaving(true);
    await setCover(entryId, null, keys);
    setSaving(false);
    onClose();
  }

  const btn = {
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
          Change cover{title ? `: ${title}` : ""}
        </div>
        <div style={{ color: "#aaa", fontSize: "0.9rem", marginBottom: 16 }}>
          Pick a cover. Only you will see it - it applies everywhere you see this
          title.
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "32px 0",
            }}
          >
            <span
              className="app-spinner"
              style={{ width: 32, height: 32, borderWidth: 3 }}
              aria-label="Loading"
            />
          </div>
        ) : posters.length === 0 ? (
          <div style={{ color: "#888", padding: "12px 0" }}>
            No cover options found for this title.
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
                alt="Cover option"
                onClick={() => {
                  setSelected(p.full);
                  setCustomUrl("");
                }}
                className={`poster-option${selected === p.full ? " is-selected" : ""}`}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: 6 }}>
            Or paste an image URL
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="url"
              value={customUrl}
              onChange={(e) => {
                const url = e.target.value;
                setCustomUrl(url);
                setSelected(url.trim() || coverFor(entryId) || currentImage || null);
              }}
              placeholder="https://..."
              style={{
                flex: 1,
                minWidth: 0,
                background: "#111",
                color: "#eee",
                border: "1px solid #444",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: "0.9rem",
              }}
            />
            {customUrl.trim() && (
              <img
                src={customUrl.trim()}
                alt="Custom cover preview"
                onError={(e) => {
                  e.target.style.visibility = "hidden";
                }}
                onLoad={(e) => {
                  e.target.style.visibility = "visible";
                }}
                style={{
                  width: 46,
                  height: 69,
                  objectFit: "cover",
                  borderRadius: 4,
                  border: "2px solid #e23030",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          <Button variant="outlined" onClick={onClose} disabled={saving} sx={btn}>
            Cancel
          </Button>
          {hasOverride && (
            <Button
              variant="outlined"
              onClick={resetToDefault}
              disabled={saving}
              sx={btn}
            >
              Reset to default
            </Button>
          )}
          <Button
            variant="contained"
            onClick={apply}
            disabled={saving || !selected || !entryId}
            sx={{
              fontWeight: "bold",
              textTransform: "none",
              whiteSpace: "nowrap",
              backgroundColor: "#c91919",
              "&:hover": { backgroundColor: "#e23030" },
            }}
          >
            Change cover
          </Button>
        </div>
      </Box>
    </Modal>
  );
}

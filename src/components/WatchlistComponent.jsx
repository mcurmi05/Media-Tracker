import Rating from "./Rating.jsx";
import "../styles/Rating.css";
import "../styles/LogComponent.css";
import { supabase } from "../services/supabase-client";
import { useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useWatchlist } from "../contexts/UserWatchlistContext.jsx";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "#1a1a1a",
  color: "white",
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  fontWeight: "bold",
};

export default function WatchlistComponent({
  watchlist_id,
  movie,
  addedDate,
  newSeasonToWatch,
}) {
  const [visible, setVisible] = useState(true);
  const {
    removeWatchlist,
    updateNewSeason,
    watchlistQueue,
    addToQueue,
    removeFromQueue,
  } = useWatchlist();
  const [newSeason, setNewSeason] = useState(!!newSeasonToWatch);

  const queueEntry = watchlistQueue.find(
    (q) => q.watchlist_id === watchlist_id,
  );
  const inQueue = !!queueEntry;

  function handleQueueToggle() {
    if (inQueue) removeFromQueue(queueEntry.id);
    else addToQueue(watchlist_id);
  }

  const isTV =
    (movie?.type || "").toLowerCase().includes("tv") ||
    (movie?.titleType || "").toLowerCase().includes("tv") ||
    !!movie?.episodes;

  async function handleNewSeasonToggle() {
    const newValue = !newSeason;
    setNewSeason(newValue);
    updateNewSeason(watchlist_id, newValue);
    const { error } = await supabase
      .from("watchlist")
      .update({ new_season_to_watch: newValue ? true : null })
      .eq("id", watchlist_id);
    if (error) {
      console.error("Error updating new_season_to_watch:", error);
      setNewSeason(!newValue);
      updateNewSeason(watchlist_id, !newValue);
    }
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  async function confirmDeleteWatchlist() {
    // Remove the queue entry first so the watchlist delete isn't blocked by the
    // queue's foreign key reference.
    if (queueEntry) await removeFromQueue(queueEntry.id);
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", watchlist_id);
    removeWatchlist(watchlist_id);
    if (error) {
      console.error("Error deleting watchlist entry:", error);
    } else {
      setVisible(false);
    }
    setShowDeleteModal(false);
  }

  if (!visible) return null;
  const formattedDate = addedDate
    ? new Date(addedDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  return (
    <div className="log-rating-wrapper">
      <Rating
        key={watchlist_id}
        movie_object={movie}
        ratingDate={null}
        addedToWatchlistDate={
          formattedDate !== "Invalid Date" ? formattedDate : null
        }
        actionSlot={
          <>
            <img
              src="/add-to-queue.png"
              onClick={handleQueueToggle}
              title={inQueue ? "Remove from queue" : "Add to queue"}
              style={{
                width: "22px",
                height: "22px",
                cursor: "pointer",
                opacity: inQueue ? 1 : 0.35,
                transition: "opacity 0.2s",
                marginLeft: "2px",
                marginBottom: "1px",
              }}
            />
            {isTV ? (
              <img
                src="/new_season_to_watch.png"
                onClick={handleNewSeasonToggle}
                title={
                  newSeason
                    ? "Unmark new season"
                    : "Mark as new season to watch"
                }
                style={{
                  width: "22px",
                  height: "22px",
                  cursor: "pointer",
                  opacity: newSeason ? 1 : 0.35,
                  transition: "opacity 0.2s",
                  marginLeft: "2px",
                  marginBottom: "1px",
                }}
              />
            ) : null}
          </>
        }
      />
      <img
        src="/logdelete.png"
        className="log-delete-icon"
        onClick={() => setShowDeleteModal(true)}
      ></img>
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        aria-labelledby="delete-watchlist-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Are you sure you want to remove this from your watchlist?
          </div>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setShowDeleteModal(false)}
              sx={{
                color: "white",
                borderColor: "#666",
                "&:hover": { borderColor: "#888" },
                fontWeight: "bold",
                textTransform: "none",
                "&.Mui-focusVisible": {
                  boxShadow: "none",
                  outline: "none",
                  borderColor: "#666",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={confirmDeleteWatchlist}
              sx={{
                backgroundColor: "#ff0000ff",
                "&:hover": { backgroundColor: "#cc0000" },
                fontWeight: "bold",
                textTransform: "none",
                "&.Mui-focusVisible": {
                  boxShadow: "none",
                  outline: "none",
                  borderColor: "#ff0000ff",
                },
              }}
            >
              Remove
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
}

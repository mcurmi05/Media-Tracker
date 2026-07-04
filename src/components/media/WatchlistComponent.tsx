import ListComponent from "../common/ListComponent";
import AddToList from "../common/AddToList";
import "../../styles/pages/Rating.css";
import "../../styles/common/LogComponent.css";
import { supabase } from "../../services/supabase-client";
import { useState } from "react";
import { useWatchlist } from "../../contexts/UserWatchlistContext";

export default function WatchlistComponent({
  watchlist_id,
  movie,
  addedDate,
  newSeasonToWatch,
}) {
  const { updateNewSeason, watchlistQueue, addToQueue, removeFromQueue } =
    useWatchlist();
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
      .from("user_saves")
      .update({ new_season_to_watch: newValue })
      .eq("id", watchlist_id);
    if (error) {
      console.error("Error updating new_season_to_watch:", error);
      setNewSeason(!newValue);
      updateNewSeason(watchlist_id, !newValue);
    }
  }

  const formattedDate = addedDate
    ? new Date(addedDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  return (
    <div className="div-wrapper-rating-testing">
      <ListComponent
        key={watchlist_id}
        movie_object={movie}
        ratingDate={null}
        addedToWatchlistDate={
          formattedDate !== "Invalid Date" ? formattedDate : null
        }
        betweenSlot={<AddToList movie={movie} />}
        actionSlot={
          <>
            <img
              className="press-icon"
              src="/images/add-to-queue.png"
              onClick={handleQueueToggle}
              title={inQueue ? "Remove from queue" : "Add to queue"}
              style={{
                width: "22px",
                height: "22px",
                cursor: "pointer",
                opacity: inQueue ? 1 : 0.35,
                transition:
                  "opacity 0.2s, transform 120ms cubic-bezier(0.23, 1, 0.32, 1)",
                marginLeft: "2px",
                marginBottom: "1px",
              }}
            />
            {isTV ? (
              <img
                className="press-icon"
                src="/images/new_season_to_watch.png"
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
                  transition:
                    "opacity 0.2s, transform 120ms cubic-bezier(0.23, 1, 0.32, 1)",
                  marginLeft: "2px",
                  marginBottom: "1px",
                }}
              />
            ) : null}
          </>
        }
      />
    </div>
  );
}

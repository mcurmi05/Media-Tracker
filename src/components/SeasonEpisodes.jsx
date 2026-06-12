import "../styles/SeasonEpisodes.css";
import { useState } from "react";
import { Dialog } from "./ReactDayPicker.jsx";
import ScrollStrip from "./ScrollStrip.jsx";
import EpisodeModal from "./EpisodeModal.jsx";

// Expanded per-episode list for one season on the Log page. Watch state and the
// optional per-episode watched date live in the separate `watch_status` table,
// kept fully independent of the log's own season dates - ticking an episode here
// never touches the log. All state is owned by the parent LogComponent.
//
// Mirrors the MediaDetails episode strip (horizontal, with stills) at a smaller
// size. Clicking a card opens the shared episode detail modal.
export default function SeasonEpisodes({
  episodes,
  loading,
  seasonName,
  canEdit = true,
  isWatched,
  getDate,
  onToggle,
  onSetDate,
}) {
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  if (loading) {
    return (
      <div className="season-eps-msg">
        Loading episodes...
        <span className="season-eps-spinner" aria-hidden="true" />
      </div>
    );
  }
  if (!episodes || episodes.length === 0) {
    return <div className="season-eps-msg">No episode data available.</div>;
  }

  const selectedNum = selectedEpisode?.episode_number;

  return (
    <div className="season-eps">
      <ScrollStrip className="log-eps-scroll" wrapClassName="log-eps-strip">
        {episodes.map((ep) => {
          const watched = isWatched(ep.episode_number);
          const watchedDate = getDate(ep.episode_number);
          return (
            <div
              className={`log-ep-card${watched ? " watched" : ""}`}
              key={ep.episode_number}
              onClick={() =>
                setSelectedEpisode({ ...ep, _seasonName: seasonName })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedEpisode({ ...ep, _seasonName: seasonName });
                }
              }}
            >
              <div className="log-ep-still-wrap">
                <img
                  className="log-ep-still"
                  src={ep.still || "/placeholderimage.jpg"}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/placeholderimage.jpg";
                  }}
                  alt={ep.name}
                />
                <button
                  type="button"
                  className="log-ep-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(ep.episode_number);
                  }}
                  aria-pressed={watched}
                  title={watched ? "Mark as unwatched" : "Mark as watched"}
                >
                  {String.fromCharCode(10003)}
                </button>
              </div>
              <div className="log-ep-meta">
                <p className="log-ep-label">
                  E{ep.episode_number}
                  {ep.runtime ? ` · ${ep.runtime}m` : ""}
                </p>
                <p className="log-ep-name" title={ep.name}>
                  {ep.name}
                </p>
                {watched && (
                  <div
                    className="log-ep-date"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Dialog
                      initialDate={watchedDate ? new Date(watchedDate) : null}
                      onDateChange={(d) =>
                        onSetDate(ep.episode_number, d.toISOString())
                      }
                      showWeekday={false}
                      dateColor="#bbb"
                      iconGap="4px"
                      minWidth="auto"
                      placeholder="+"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </ScrollStrip>

      {selectedEpisode && (
        <EpisodeModal
          episode={selectedEpisode}
          onClose={() => setSelectedEpisode(null)}
          canEdit={canEdit}
          isWatched={isWatched(selectedNum)}
          onToggleWatched={() => onToggle(selectedNum)}
          watchedDate={getDate(selectedNum)}
          onSetDate={(iso) => onSetDate(selectedNum, iso)}
        />
      )}
    </div>
  );
}

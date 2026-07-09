import "../../styles/media/EpisodeModal.css";
import { useEffect } from "react";
import { Dialog } from "../common/ReactDayPicker";
import { toLocalDateString } from "../../utils/localDate";

function formatEpisodeDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Shared episode detail modal used by both the MediaDetails page and the Log
// page. Shows the episode info and, when editable, a watched toggle plus an
// optional watched-date picker. The watched date is stored separately from any
// log dates - setting it here is purely optional.
export default function EpisodeModal({
  episode,
  onClose,
  canEdit = false,
  isWatched = false,
  onToggleWatched,
  watchedDate = null,
  onSetDate,
  onClearDate,
}) {
  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!episode) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [episode, onClose]);

  if (!episode) return null;

  return (
    <div className="episode-modal-overlay" onClick={onClose}>
      <div
        className="episode-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="episode-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {episode.still && (
          <img
            className="episode-modal-still"
            src={episode.still}
            alt={episode.name}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
        <div className="episode-modal-body">
          <p className="episode-modal-eyebrow">
            {episode._seasonName} · Episode {episode.episode_number}
          </p>
          <h2 className="episode-modal-title">{episode.name}</h2>
          <div className="episode-modal-meta">
            {formatEpisodeDate(episode.air_date) && (
              <span>{formatEpisodeDate(episode.air_date)}</span>
            )}
            {episode.runtime ? <span>{episode.runtime} min</span> : null}
            {episode.vote_average ? (
              <span className="episode-modal-rating">
                {String.fromCharCode(9733)}{" "}
                {Number(episode.vote_average).toFixed(1)}
              </span>
            ) : null}
          </div>
          <p className="episode-modal-overview">
            {episode.overview || "No overview available for this episode."}
          </p>
          {canEdit && (
            <button
              className={`episode-modal-watch${isWatched ? " done" : ""}`}
              onClick={onToggleWatched}
            >
              {isWatched
                ? `${String.fromCharCode(10003)} Watched`
                : "Mark as watched"}
            </button>
          )}
          {canEdit && isWatched && (
            <div className="episode-modal-date">
              <span className="episode-modal-date-label">Watched on</span>
              <Dialog
                key={watchedDate || "none"}
                initialDate={watchedDate ? new Date(watchedDate) : null}
                onDateChange={(d) => onSetDate(toLocalDateString(d))}
                showWeekday={false}
                dateColor="#ddd"
                iconGap="8px"
                minWidth="auto"
                placeholder="Add a date (optional)"
                extraActions={
                  watchedDate && onClearDate
                    ? [{ label: "Clear date", onClick: () => onClearDate() }]
                    : []
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

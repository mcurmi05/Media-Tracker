import "../../styles/pages/Rating.css";
import "../../styles/media/MovieCard.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PosterEditModal from "../media/PosterEditModal";
import { useCovers } from "../../contexts/UserCoversContext";
import MovieRatingStar from "../media/MovieRatingStar";
import ReleaseAndRunTime from "../media/ReleaseAndRunTime";
import AddLog from "../media/AddLog";
import AddWatchlist from "../media/AddWatchlist";
import IMDBInfo from "../media/IMDBInfo";
import LetterboxdInfo from "../media/LetterboxdInfo";
import { getRatingDateInfo } from "../../utils/ratingDate";
import { makeNavHandlers } from "../../utils/navClick";

function ListComponent({
  movie_object,
  ratingDate,
  ratingUpdatedDate,
  ratingPreviousValue = null,
  ratingDateUnknown = false,
  addedToWatchlistDate,
  rankNumber = null,
  showRankControls = false,
  rankLeft = false,
  onMoveUp,
  onMoveDown,
  onSendTop,
  onSendBottom,
  dateSlot = null,
  betweenSlot = null,
  actionSlot = null,
  belowRank = null,
  posterEditable = false,
  posterEntryId = null,
}) {
  const navigate = useNavigate();
  const { coverFor } = useCovers();
  // Self-managed cover edit modal, so any page (log, ratings, watchlist, ...)
  // gets it for free just by passing posterEditable + posterEntryId.
  const [showPosterEdit, setShowPosterEdit] = useState(false);
  // A user's per-title override wins over the shared/entry poster everywhere.
  const displayImage = coverFor(posterEntryId) ?? movie_object.primaryImage;

  const detailHandlers = makeNavHandlers(
    navigate,
    `/mediadetails/${movie_object.media_type}/${movie_object.tmdb_id}`,
  );

  const ratingDateInfo = getRatingDateInfo(
    ratingDate,
    ratingUpdatedDate,
    ratingPreviousValue,
    { dateUnknown: ratingDateUnknown },
  );

  // The four reorder controls, shared between the inline (ratings) layout and
  // the vertical right-side stack used in the watchlist queue. Stack order:
  // send to top, move up, move down, send to bottom.
  const rankBtnStyle = {
    border: "none",
    background: "none",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  };
  const rankButtons = (
    <>
      <button className="rank-btn" onClick={onSendTop} title="Send to top" style={rankBtnStyle}>
        <img src="/images/doublepromote.png" alt="Top" />
      </button>
      <button className="rank-btn" onClick={onMoveUp} title="Move up" style={rankBtnStyle}>
        <img src="/images/promote.png" alt="Up" />
      </button>
      <button className="rank-btn" onClick={onMoveDown} title="Move down" style={rankBtnStyle}>
        <img src="/images/demote.png" alt="Down" />
      </button>
      <button className="rank-btn" onClick={onSendBottom} title="Send to bottom" style={rankBtnStyle}>
        <img src="/images/doubledemote.png" alt="Bottom" />
      </button>
    </>
  );

  // The gold/silver/bronze rank pill. Rendered in two slots (title row on
  // desktop, date line on mobile) and toggled by CSS - see .rank-badge-slot-*.
  const rankBadge = (
    <span
      className="rank-badge"
      title={rankNumber ? `#${rankNumber}` : "Unranked"}
      style={{
        background:
          rankNumber === 1
            ? "linear-gradient(135deg,#FFD700,#E6C200)"
            : rankNumber === 2
              ? "linear-gradient(135deg,#C0C0C0,#A9A9A9)"
              : rankNumber === 3
                ? "linear-gradient(135deg,#CD7F32,#B87333)"
                : "#444",
        color: rankNumber ? "#000" : "#fff",
      }}
    >
      {rankNumber ? `#${rankNumber}` : "Unranked"}
    </span>
  );
  const showRankBadge = (rankNumber || showRankControls) && !rankLeft;

  return (
    <div className={`container${rankLeft ? " container-queue" : ""}`}>
      <div className="top-stuff">
        {rankLeft && rankNumber != null && (
          <div className="queue-rank">
            <span className="queue-rank-badge">{`#${rankNumber}`}</span>
            {belowRank}
          </div>
        )}
        <div
          className={`poster-wrapper${posterEditable ? " poster-editable" : ""}`}
        >
          {/* Rank badge sitting in the poster (mobile), like the home top-4. */}
          {showRankBadge && rankNumber != null && (
            <span className={`poster-rank poster-rank-${rankNumber}`}>
              {rankNumber}
            </span>
          )}
          <img
            src={displayImage ? `${displayImage}` : "/images/placeholderimage.jpg"}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/placeholderimage.jpg";
            }}
            className="rating-poster"
            {...detailHandlers}
          />
          {posterEditable && (
            <button
              type="button"
              className="poster-edit-overlay"
              title="Change poster"
              onClick={(e) => {
                e.stopPropagation();
                setShowPosterEdit(true);
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          )}
        </div>
        <div className="right-stuff">
          <div className="title-and-star">
            <p className="movie-title" {...detailHandlers}>
              {movie_object.primaryTitle}{" "}
            </p>
            {/* Rank badge (desktop slot - in the title row) */}
            {showRankBadge && (
              <div className="rank-badge-slot rank-badge-slot-title">
                {rankBadge}
              </div>
            )}
            <div className="rating-actions" style={{ display: "flex" }}>
              <div className="rating-star-div">
                <MovieRatingStar movie={movie_object}></MovieRatingStar>
              </div>
              <div className="rating-action-spacer" style={{ margin: "5px" }}></div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <AddWatchlist movie={movie_object}></AddWatchlist>
                {betweenSlot}
                <AddLog movie={movie_object}></AddLog>
                {actionSlot}
              </div>
            </div>
          </div>

          <div className="rating-page-subtitle">
            <ReleaseAndRunTime
              style={{ textWrap: "wrap" }}
              movie={movie_object}
            ></ReleaseAndRunTime>
            <span className="rating-imdb-wrap" style={{ position: "relative", top: "12px" }}>
              <IMDBInfo movie={movie_object} useLiveRating></IMDBInfo>
            </span>
            <span className="rating-letterboxd-wrap">
              <LetterboxdInfo movie={movie_object}></LetterboxdInfo>
            </span>
            <div className="rating-date-row">
              {addedToWatchlistDate ? (
                <span
                  className="rating-date-line"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      color: "#888",
                      fontSize: "0.93em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Added: {addedToWatchlistDate}
                  </span>
                  {dateSlot}
                </span>
              ) : ratingDateInfo ? (
                <span
                  className="rating-date-line"
                  style={{
                    color: "#888",
                    fontSize: "0.93em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ratingDateInfo.unknown ? (
                    <span style={{ fontWeight: 600 }}>
                      Updated: {ratingDateInfo.lastUpdatedFormatted}
                      {ratingDateInfo.previousRating != null
                        ? `, was ${ratingDateInfo.previousRating}`
                        : ""}
                    </span>
                  ) : (
                    <>
                      Rated: {ratingDateInfo.ratedFormatted}
                      {ratingDateInfo.changed ? (
                        <span className="rating-last-updated" style={{ fontWeight: 600 }}>
                          {" "}
                          (Updated: {ratingDateInfo.updatedFormatted}
                          {ratingDateInfo.previousRating != null
                            ? `, was ${ratingDateInfo.previousRating}`
                            : ""}
                          )
                        </span>
                      ) : null}
                    </>
                  )}
                </span>
              ) : null}
              {/* Rank badge (mobile slot - to the right of the date text) */}
              {showRankBadge && (
                <span className="rank-badge-slot rank-badge-slot-date">
                  {rankBadge}
                </span>
              )}
            </div>
          </div>

          <div className="top">
            <div className="description-and-stars-and-director">
              <div className="directors-and-stars">
                {movie_object.media_type === "movie" &&
                  movie_object.directors &&
                  movie_object.directors.length > 0 && (
                    <p className="director-p">
                      <span className="bold-span">Directed by</span>{" "}
                      {movie_object.directors
                        .map((director) => director.fullName)
                        .join(", ")}
                    </p>
                  )}
                {movie_object.media_type === "tv" &&
                  movie_object.creators &&
                  movie_object.creators.length > 0 && (
                    <p className="director-p">
                      <span className="bold-span">Created by</span>{" "}
                      {movie_object.creators
                        .map((c) => c.fullName)
                        .join(", ")}
                    </p>
                  )}
                <p>
                  <span className="bold-span">Stars</span>{" "}
                  {movie_object.cast
                    .slice(0, 3)
                    .map((castMember) => castMember.fullName)
                    .join(", ")}
                </p>
              </div>
            </div>
          </div>
        </div>
        {showRankControls && (
          <div className="rank-controls-stack">{rankButtons}</div>
        )}
      </div>
      {posterEditable && showPosterEdit && (
        <PosterEditModal
          open={showPosterEdit}
          entryId={posterEntryId}
          mediaType={movie_object.media_type}
          tmdbId={movie_object.tmdb_id}
          title={movie_object.primaryTitle}
          currentImage={movie_object.primaryImage}
          onClose={() => setShowPosterEdit(false)}
        />
      )}
    </div>
  );
}

export default ListComponent;

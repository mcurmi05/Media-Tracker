import "../styles/Rating.css";
import "../styles/MovieCard.css";
import { useNavigate } from "react-router-dom";
import MovieRatingStar from "./MovieRatingStar";
import ReleaseAndRunTime from "./ReleaseAndRunTime";
import AddLog from "./AddLog.jsx";
import AddWatchlist from "./AddWatchlist.jsx";
import IMDBInfo from "./IMDBInfo.jsx";
import { getRatingDateInfo } from "../utils/ratingDate.js";
import { makeNavHandlers } from "../utils/navClick.js";

function ListComponent({
  movie_object,
  ratingDate,
  ratingUpdatedDate,
  ratingPreviousValue = null,
  ratingAccurate = null,
  addedToWatchlistDate,
  rankNumber = null,
  showRankControls = false,
  rankLeft = false,
  onMoveUp,
  onMoveDown,
  onSendTop,
  onSendBottom,
  dateSlot = null,
  actionSlot = null,
}) {
  const navigate = useNavigate();

  const detailHandlers = makeNavHandlers(
    navigate,
    `/mediadetails/${movie_object.media_type}/${movie_object.tmdb_id}`,
  );

  const ratingDateInfo = getRatingDateInfo(
    ratingDate,
    ratingUpdatedDate,
    ratingPreviousValue,
    ratingAccurate,
  );

  // The four reorder controls, shared between the inline (ratings) layout and
  // the vertical right-side stack used in the watchlist queue. Stack order:
  // send to top, move up, move down, send to bottom.
  const rankBtnStyle = {
    border: "1px solid #cccccc",
    background: "#2a2a2a",
    color: "#fff",
    borderRadius: 4,
    padding: 0,
    cursor: "pointer",
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  };
  const rankButtons = (
    <>
      <button onClick={onSendTop} title="Send to top" style={rankBtnStyle}>
        <img src="/doublepromote.png" alt="Top" style={{ width: 12, height: 12 }} />
      </button>
      <button onClick={onMoveUp} title="Move up" style={rankBtnStyle}>
        <img src="/promote.png" alt="Up" style={{ width: 10, height: 10 }} />
      </button>
      <button onClick={onMoveDown} title="Move down" style={rankBtnStyle}>
        <img src="/demote.png" alt="Down" style={{ width: 10, height: 10 }} />
      </button>
      <button onClick={onSendBottom} title="Send to bottom" style={rankBtnStyle}>
        <img src="/doubledemote.png" alt="Bottom" style={{ width: 12, height: 12 }} />
      </button>
    </>
  );

  return (
    <div className={`container${rankLeft ? " container-queue" : ""}`}>
      <div className="top-stuff">
        {rankLeft && rankNumber != null && (
          <div className="queue-rank">
            <span className="queue-rank-badge">{`#${rankNumber}`}</span>
          </div>
        )}
        <div className="poster-wrapper">
          <img
            src={
              movie_object.primaryImage
                ? `${movie_object.primaryImage}`
                : "/placeholderimage.jpg"
            }
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholderimage.jpg";
            }}
            className="rating-poster"
            {...detailHandlers}
          />
        </div>
        <div className="right-stuff">
          <div className="title-and-star">
            <p className="movie-title" {...detailHandlers}>
              {movie_object.primaryTitle}{" "}
            </p>
            {/* Rank badge and optional controls */}
            {(rankNumber || showRankControls) && !rankLeft && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginLeft: 8,
                }}
              >
                <span
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
                    borderRadius: 10,
                    padding: "2px 8px",
                    fontSize: "0.85rem",
                    minWidth: 42,
                    textAlign: "center",
                  }}
                >
                  {rankNumber ? `#${rankNumber}` : "Unranked"}
                </span>
                {showRankControls && (
                  <div style={{ display: "flex", gap: 3 }}>{rankButtons}</div>
                )}
              </div>
            )}
            <div className="rating-actions" style={{ display: "flex" }}>
              <div className="rating-star-div">
                <MovieRatingStar movie={movie_object}></MovieRatingStar>
              </div>
              <div className="rating-action-spacer" style={{ margin: "5px" }}></div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <AddWatchlist movie={movie_object}></AddWatchlist>
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
            <span className="rating-imdb-wrap" style={{ position: "relative", top: "11px" }}>
              <IMDBInfo movie={movie_object} useLiveRating></IMDBInfo>
            </span>
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
                {ratingDateInfo.dateInaccurate ? (
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
        {showRankControls && rankLeft && (
          <div className="rank-controls-stack">{rankButtons}</div>
        )}
      </div>
    </div>
  );
}

export default ListComponent;

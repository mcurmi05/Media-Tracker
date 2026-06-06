import "../styles/Rating.css";
import { useNavigate } from "react-router-dom";
import MovieRatingStar from "./MovieRatingStar";
import ReleaseAndRunTime from "./ReleaseAndRunTime";
import AddLog from "./AddLog.jsx";
import AddWatchlist from "./AddWatchlist.jsx";
import { getRatingDateInfo } from "../utils/ratingDate.js";

function Rating({
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

  function onMovieClick() {
    console.log("Navigating to movie details for:", movie_object.primaryTitle);
    navigate(`/mediadetails/${movie_object.id}`);
  }

  const ratingDateInfo = getRatingDateInfo(
    ratingDate,
    ratingUpdatedDate,
    ratingPreviousValue,
    ratingAccurate,
  );

  return (
    <div className="container">
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
            onClick={onMovieClick}
          />
        </div>
        <div className="right-stuff">
          <div className="title-and-star">
            <p className="movie-title" onClick={onMovieClick}>
              {movie_object.primaryTitle}{" "}
            </p>
            {/* Rank badge and optional controls */}
            {(rankNumber || showRankControls) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginLeft: 8,
                }}
              >
                {!rankLeft && (
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
                )}
                {showRankControls && (
                  <div style={{ display: "flex", gap: 3 }}>
                    <button
                      onClick={onSendTop}
                      title="Send to top"
                      style={{
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
                      }}
                    >
                      <img
                        src="/doublepromote.png"
                        alt="Top"
                        style={{ width: 12, height: 12 }}
                      />
                    </button>
                    <button
                      onClick={onMoveUp}
                      title="Move up"
                      style={{
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
                      }}
                    >
                      <img
                        src="/promote.png"
                        alt="Up"
                        style={{ width: 10, height: 10 }}
                      />
                    </button>
                    <button
                      onClick={onSendBottom}
                      title="Send to bottom"
                      style={{
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
                      }}
                    >
                      <img
                        src="/doubledemote.png"
                        alt="Bottom"
                        style={{ width: 12, height: 12 }}
                      />
                    </button>
                    <button
                      onClick={onMoveDown}
                      title="Move down"
                      style={{
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
                      }}
                    >
                      <img
                        src="/demote.png"
                        alt="Down"
                        style={{ width: 10, height: 10 }}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex" }}>
              <div className="rating-star-div">
                <MovieRatingStar movie={movie_object}></MovieRatingStar>
              </div>
              <div style={{ margin: "5px" }}></div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <AddWatchlist movie={movie_object}></AddWatchlist>
                <AddLog movie={movie_object}></AddLog>
                {actionSlot}
              </div>
            </div>
          </div>

          <div
            className="rating-page-subtitle"
            style={{ display: "flex", alignItems: "baseline", gap: "24px" }}
          >
            <ReleaseAndRunTime
              style={{ textWrap: "wrap" }}
              movie={movie_object}
            ></ReleaseAndRunTime>
            {addedToWatchlistDate ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
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
                style={{
                  color: "#888",
                  fontSize: "0.93em",
                  whiteSpace: "nowrap",
                }}
              >
                {ratingDateInfo.dateInaccurate ? (
                  <span style={{ fontWeight: 600 }}>
                    Last updated: {ratingDateInfo.lastUpdatedFormatted}
                    {ratingDateInfo.previousRating != null
                      ? `, was ${ratingDateInfo.previousRating}`
                      : ""}
                  </span>
                ) : (
                  <>
                    Rated: {ratingDateInfo.ratedFormatted}
                    {ratingDateInfo.changed ? (
                      <span style={{ fontWeight: 600 }}>
                        {" "}
                        (Last updated: {ratingDateInfo.updatedFormatted}
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
                {movie_object.type === "movie" &&
                  movie_object.directors &&
                  movie_object.directors.length > 0 && (
                    <p className="director-p">
                      <span className="bold-span">Directed by</span>{" "}
                      {movie_object.directors
                        .map((director) => director.fullName)
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
      </div>
    </div>
  );
}

export default Rating;

import "../styles/Rating.css";
import "../styles/MovieRatingStar.css";
import { useState } from "react";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import RatingModal from "./RatingModal.jsx";

function BookRating({
  bookLog,
  rankNumber = null,
  showRankControls = false,
  onMoveUp,
  onMoveDown,
  onSendTop,
  onSendBottom,
}) {
  const { updateBookLog } = useBookLogs();
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleGoodreadsSearch = () => {
    const formattedTitle = (bookLog.title || "").replace(/\s+/g, "+");
    window.open(
      `https://www.goodreads.com/search?q=${formattedTitle}`,
      "_blank",
    );
  };

  const handleAuthorSearch = () => {
    const formattedAuthor = (bookLog.author || "").replace(/\s+/g, "+");
    window.open(
      `https://www.google.com/search?q=${formattedAuthor}+books`,
      "_blank",
    );
  };

  const handleRatingChange = async (newRating) => {
    try {
      await updateBookLog(bookLog.id, { book_rating: newRating });
    } catch (error) {
      console.error("Error updating book rating:", error);
    }
  };

  const handleClearRating = async () => {
    try {
      await updateBookLog(bookLog.id, { book_rating: null });
    } catch (error) {
      console.error("Error clearing book rating:", error);
    }
  };

  const ratingDate =
    bookLog.end_date || bookLog.start_date || bookLog.created_at;
  const formattedDate = ratingDate
    ? new Date(ratingDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  const dateLabel = bookLog.end_date
    ? "Read"
    : bookLog.start_date
      ? "Started"
      : "Added";

  return (
    <div className="container">
      <div className="top-stuff">
        <div className="poster-wrapper">
          <img
            src={bookLog.cover_image || "/placeholderimage.jpg"}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholderimage.jpg";
            }}
            className="rating-poster"
            onClick={handleGoodreadsSearch}
            alt={`${bookLog.title} cover`}
          />
        </div>
        <div className="right-stuff">
          <div className="title-and-star">
            <p className="movie-title" onClick={handleGoodreadsSearch}>
              {bookLog.title}{" "}
            </p>
            {(rankNumber || showRankControls) && (
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
                <span className="user-rating-movie-card">
                  {!bookLog.book_rating || bookLog.book_rating === 0 ? (
                    <>
                      <img
                        className="user-rating-star"
                        src="/user-rating-star.png"
                        onClick={() => setShowRatingModal(true)}
                        style={{ cursor: "pointer" }}
                      />
                      <p
                        className="user-rating-number"
                        onClick={() => setShowRatingModal(true)}
                        style={{ cursor: "pointer" }}
                      ></p>
                    </>
                  ) : (
                    <>
                      <img
                        className="user-rating-star"
                        src="/user-rating-star2.png"
                        onClick={() => setShowRatingModal(true)}
                        style={{ cursor: "pointer" }}
                      />
                      <p
                        className="user-rating-number"
                        onClick={() => setShowRatingModal(true)}
                        style={{ cursor: "pointer" }}
                      >
                        {bookLog.book_rating}
                      </p>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div
            className="rating-page-subtitle"
            style={{ display: "flex", alignItems: "baseline", gap: "24px" }}
          >
            <span style={{ fontSize: "0.95em" }}>
              by{" "}
              <span
                onClick={handleAuthorSearch}
                style={{ cursor: "pointer", textDecoration: "underline" }}
              >
                {bookLog.author}
              </span>
              {bookLog.release_year ? ` (${bookLog.release_year})` : ""}
            </span>
            {formattedDate ? (
              <span
                style={{
                  color: "#888",
                  fontSize: "0.93em",
                  whiteSpace: "nowrap",
                }}
              >
                {dateLabel}: {formattedDate}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onRate={handleRatingChange}
        onRemove={handleClearRating}
        currentRating={bookLog.book_rating || 0}
        movieTitle={bookLog.title}
        isRated={bookLog.book_rating && bookLog.book_rating > 0}
      />
    </div>
  );
}

export default BookRating;

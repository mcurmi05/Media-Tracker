import "../../styles/pages/Rating.css";
import "../../styles/media/MovieRatingStar.css";
import { useState } from "react";
import { useBookRatings } from "../../contexts/UserBookRatingsContext";
import RatingModal from "../common/RatingModal";
import AddToList from "../common/AddToList";
import AddBookWatchlist from "./AddBookWatchlist";
import AddBookLogButton from "./AddBookLogButton";
import GoodreadsInfo from "./GoodreadsInfo";
import StorygraphInfo from "../../features/ratings/storygraph/StorygraphInfo";
import { getBookInfo } from "../../utils/bookInfo";
import { getRatingDateInfo } from "../../utils/ratingDate";
import { useNavigate } from "react-router-dom";
import { bookDetailsRouteForBook } from "../../utils/goodreads";
import { makeNavHandlers } from "../../utils/navClick";

// Borderless glyph buttons, matching the watchlist/TBR queue reorder controls.
const queueBtnStyle = {
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

function BookRating({
  bookLog,
  rankNumber = null,
  showRankControls = false,
  onMoveUp,
  onMoveDown,
  onSendTop,
  onSendBottom,
}) {
  const { rateBook } = useBookRatings();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const navigate = useNavigate();
  const book = getBookInfo(bookLog);

  const detailHandlers = makeNavHandlers(
    navigate,
    bookDetailsRouteForBook(book),
    { state: { book: bookLog.book_entries || book } },
  );

  const handleAuthorSearch = () => {
    const formattedAuthor = (book.author || "").replace(/\s+/g, "+");
    window.open(
      `https://www.google.com/search?q=${formattedAuthor}+books`,
      "_blank",
    );
  };

  const handleRatingChange = async (newRating) => {
    try {
      await rateBook(bookLog, newRating);
    } catch (error) {
      console.error("Error updating book rating:", error);
    }
  };

  const handleClearRating = async () => {
    try {
      await rateBook(bookLog, null);
    } catch (error) {
      console.error("Error clearing book rating:", error);
    }
  };

  const ratingDateInfo = getRatingDateInfo(
    bookLog.created_at,
    bookLog.updated_at,
    bookLog.previous_rating,
    bookLog.accurate,
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
  const showRankBadge = rankNumber || showRankControls;

  return (
    <div className="container">
      <div className="top-stuff">
        <div className="poster-wrapper">
          <img
            src={book.cover_image || "/images/placeholderimage.jpg"}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/placeholderimage.jpg";
            }}
            className="rating-poster"
            {...detailHandlers}
            style={{ cursor: book.goodreads_link ? "pointer" : "default" }}
            alt={`${book.title} cover`}
          />
        </div>
        <div className="right-stuff book-right-stuff">
          <div className="title-and-star">
            <p className="movie-title" {...detailHandlers} style={{ cursor: book.goodreads_link ? "pointer" : "default" }}>
              {book.title}{" "}
            </p>
            {/* Rank badge (desktop slot - in the title row) */}
            {showRankBadge && (
              <div className="rank-badge-slot rank-badge-slot-title">
                {rankBadge}
              </div>
            )}
            <div className="rating-actions" style={{ display: "flex" }}>
              <div className="rating-star-div">
                <span className="user-rating-movie-card">
                  {!bookLog.book_rating || bookLog.book_rating === 0 ? (
                    <>
                      <img
                        className="user-rating-star"
                        src="/images/user-rating-star.png"
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
                        src="/images/user-rating-star2.png"
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
              <div className="rating-action-spacer" style={{ margin: "5px" }}></div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <AddBookWatchlist book={bookLog} />
                <AddToList book={book} />
                <AddBookLogButton book={bookLog} />
              </div>
            </div>
          </div>

          <div className="rating-page-subtitle">
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.95em",
                }}
              >
                {book.release_year ? <span>{book.release_year}</span> : null}
                <GoodreadsInfo book={book} />
                <StorygraphInfo book={book} />
              </span>
              <span className="book-by-line" style={{ fontSize: "0.95em" }}>
                <span className="bold-span">By</span>{" "}
                <span
                  onClick={handleAuthorSearch}
                  style={{ cursor: "pointer" }}
                >
                  {book.author}
                </span>
              </span>
            </div>
            <div className="rating-date-row">
              {ratingDateInfo ? (
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
              {/* Rank badge (mobile slot - to the right of the date text) */}
              {showRankBadge && (
                <span className="rank-badge-slot rank-badge-slot-date">
                  {rankBadge}
                </span>
              )}
            </div>
          </div>
        </div>
        {showRankControls && (
          <div className="rank-controls-stack">
            <button className="rank-btn" onClick={onSendTop} title="Send to top" style={queueBtnStyle}>
              <img src="/images/doublepromote.png" alt="Top" />
            </button>
            <button className="rank-btn" onClick={onMoveUp} title="Move up" style={queueBtnStyle}>
              <img src="/images/promote.png" alt="Up" />
            </button>
            <button className="rank-btn" onClick={onMoveDown} title="Move down" style={queueBtnStyle}>
              <img src="/images/demote.png" alt="Down" />
            </button>
            <button className="rank-btn" onClick={onSendBottom} title="Send to bottom" style={queueBtnStyle}>
              <img src="/images/doubledemote.png" alt="Bottom" />
            </button>
          </div>
        )}
      </div>

      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onRate={handleRatingChange}
        onRemove={handleClearRating}
        currentRating={bookLog.book_rating || 0}
        movieTitle={book.title}
        isRated={bookLog.book_rating && bookLog.book_rating > 0}
      />
    </div>
  );
}

export default BookRating;

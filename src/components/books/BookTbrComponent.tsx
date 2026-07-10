import { useState } from "react";
import "../../styles/pages/Rating.css";
import "../../styles/media/MovieRatingStar.css";
import "../../styles/common/LogComponent.css";
import { useBookRatings } from "../../contexts/UserBookRatingsContext";
import { useWatchlist } from "../../contexts/UserWatchlistContext";
import AddBookWatchlist from "./AddBookWatchlist";
import AddBookLogButton from "./AddBookLogButton";
import AddToList from "../common/AddToList";
import RatingModal from "../common/RatingModal";
import EditableBookCover from "./EditableBookCover";
import { getBookInfo } from "../../utils/bookInfo";
import { useNavigate } from "react-router-dom";
import { bookDetailsRouteForBook } from "../../utils/goodreads";
import GoodreadsInfo from "./GoodreadsInfo";
import StorygraphInfo from "../../features/ratings/storygraph/StorygraphInfo";

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

export default function BookTbrComponent({
  tbrEntry,
  queueMode = false,
  rankNumber = null,
  onMoveUp,
  onMoveDown,
  onSendTop,
  onSendBottom,
}) {
  const { rateBook, findRatingForBook } = useBookRatings();
  const { watchlistQueue, addBookToQueue, removeFromQueue } = useWatchlist();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const navigate = useNavigate();
  const book = getBookInfo(tbrEntry);
  const currentRating = findRatingForBook(tbrEntry)?.book_rating ?? 0;

  const queueEntry = watchlistQueue.find(
    (q) => q.book_tbr_id === tbrEntry.id,
  );
  const inQueue = !!queueEntry;

  function handleQueueToggle() {
    if (inQueue) removeFromQueue(queueEntry.id);
    else addBookToQueue(tbrEntry.id);
  }

  const handleRatingChange = async (newRating) => {
    try {
      await rateBook(tbrEntry, newRating);
    } catch (err) {
      console.error("Error updating book TBR rating:", err);
    }
  };

  const handleClearRating = async () => {
    try {
      await rateBook(tbrEntry, null);
    } catch (err) {
      console.error("Error clearing book TBR rating:", err);
    }
  };

  const openBookDetails = () => {
    const route = bookDetailsRouteForBook(book);
    if (route) {
      navigate(route, { state: { book: tbrEntry.book_entries || book } });
    }
  };

  const handleAuthorSearch = () => {
    const formattedAuthor = (book.author || "").replace(/\s+/g, "+");
    window.open(
      `https://www.google.com/search?q=${formattedAuthor}+books`,
      "_blank",
    );
  };

  const formattedDate = tbrEntry.created_at
    ? new Date(tbrEntry.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div
      className={queueMode ? undefined : "div-wrapper-rating-testing"}
      style={queueMode ? { width: "100%" } : undefined}
    >
      <div className={`container${queueMode ? " container-queue" : ""}`}>
        <div className="top-stuff">
          {queueMode && rankNumber != null && (
            <div className="queue-rank">
              <span className="queue-rank-badge">{`#${rankNumber}`}</span>
              <button
                onClick={() => removeFromQueue(queueEntry.id)}
                title="Remove from queue (keep in TBR)"
                style={{
                  background: "none",
                  border: "none",
                  color: "#aaa",
                  cursor: "pointer",
                  fontSize: "12px",
                  lineHeight: 1,
                  padding: 0,
                  outline: "none",
                }}
              >
                {String.fromCharCode(0x2715)}
              </button>
            </div>
          )}
          <EditableBookCover
            entryId={tbrEntry.book_id ?? tbrEntry.book_entries?.id}
            hardcoverId={book.hardcover_id}
            title={book.title}
            coverImage={book.cover_image}
            alt={`${book.title} cover`}
            imgProps={{
              onClick: openBookDetails,
              style: { cursor: book.goodreads_link ? "pointer" : "default" },
            }}
          />
          <div className="right-stuff book-right-stuff">
            <div className="title-and-star">
              <p
                className="movie-title"
                onClick={openBookDetails}
                style={{
                  cursor: book.goodreads_link ? "pointer" : "default",
                }}
              >
                {book.title}{" "}
              </p>
              <div className="rating-actions" style={{ display: "flex" }}>
                <div className="rating-star-div">
                  <span className="user-rating-movie-card">
                    {!currentRating || currentRating === 0 ? (
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
                          data-len={Math.min(String(currentRating).length, 5)}
                          onClick={() => setShowRatingModal(true)}
                          style={{ cursor: "pointer" }}
                        >
                          {currentRating}
                        </p>
                      </>
                    )}
                  </span>
                </div>
                <div style={{ margin: "5px" }}></div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <AddBookWatchlist book={tbrEntry} />
                  <AddToList book={book} />
                  <AddBookLogButton book={tbrEntry} />
                  {!queueMode && (
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
                  )}
                </div>
              </div>
            </div>

            <div
              className="rating-page-subtitle"
              style={{ display: "flex", alignItems: "baseline", gap: "24px" }}
            >
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
              {formattedDate ? (
                <span
                  className="rating-date-line"
                  style={{
                    color: "#888",
                    fontSize: "0.93em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Added: {formattedDate}
                </span>
              ) : null}
            </div>
          </div>
          {queueMode && (
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
      </div>
      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onRate={handleRatingChange}
        onRemove={handleClearRating}
        currentRating={currentRating || 0}
        movieTitle={book.title}
        isRated={currentRating && currentRating > 0}
      />
    </div>
  );
}

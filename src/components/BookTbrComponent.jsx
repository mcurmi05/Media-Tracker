import { useState } from "react";
import "../styles/Rating.css";
import "../styles/MovieRatingStar.css";
import "../styles/LogComponent.css";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useBookTbr } from "../contexts/UserBookTbrContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import { useWatchlist } from "../contexts/UserWatchlistContext.jsx";
import { deleteBookTbr } from "../services/ratingsfromtable.js";
import AddBookWatchlist from "./AddBookWatchlist.jsx";
import AddBookLogButton from "./AddBookLogButton.jsx";
import RatingModal from "./RatingModal.jsx";
import { getBookInfo } from "../utils/bookInfo.js";
import { useNavigate } from "react-router-dom";
import { bookDetailsRoute } from "../utils/goodreads.js";

const queueBtnStyle = {
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

export default function BookTbrComponent({
  tbrEntry,
  queueMode = false,
  rankNumber = null,
  onMoveUp,
  onMoveDown,
  onSendTop,
  onSendBottom,
}) {
  const { removeBookTbr } = useBookTbr();
  const { rateBook, findRatingForBook } = useBookRatings();
  const { watchlistQueue, addBookToQueue, removeFromQueue } = useWatchlist();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [visible, setVisible] = useState(true);
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

  async function confirmDelete() {
    try {
      // Remove the queue entry first so the TBR delete isn't blocked by the
      // queue's foreign key reference.
      if (queueEntry) await removeFromQueue(queueEntry.id);
      await deleteBookTbr(tbrEntry.id);
      removeBookTbr(tbrEntry.id);
      setVisible(false);
    } catch (err) {
      console.error("Error deleting TBR entry:", err);
    }
    setShowDeleteModal(false);
  }

  if (!visible) return null;

  const openBookDetails = () => {
    const route = bookDetailsRoute(book.goodreads_link);
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
      className={queueMode ? undefined : "log-rating-wrapper"}
      style={queueMode ? { width: "100%" } : undefined}
    >
      <div className="container">
        <div className="top-stuff">
          {queueMode && rankNumber != null && (
            <div
              style={{
                alignSelf: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                flexShrink: 0,
                marginRight: "16px",
              }}
            >
              <span
                style={{
                  background: "#3a3a3a",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "4px 10px",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {`#${rankNumber}`}
              </span>
            </div>
          )}
          <div className="poster-wrapper">
            <img
              src={book.cover_image || "/placeholderimage.jpg"}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/placeholderimage.jpg";
              }}
              className="rating-poster"
              onClick={openBookDetails}
              style={{
                cursor: book.goodreads_link ? "pointer" : "default",
              }}
              alt={`${book.title} cover`}
            />
          </div>
          <div className="right-stuff" style={{ marginTop: "12px" }}>
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
              {queueMode && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    marginLeft: 8,
                  }}
                >
                  <button
                    onClick={onSendTop}
                    title="Send to top"
                    style={queueBtnStyle}
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
                    style={queueBtnStyle}
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
                    style={queueBtnStyle}
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
                    style={queueBtnStyle}
                  >
                    <img
                      src="/demote.png"
                      alt="Down"
                      style={{ width: 10, height: 10 }}
                    />
                  </button>
                </div>
              )}
              <div style={{ display: "flex" }}>
                <div className="rating-star-div">
                  <span className="user-rating-movie-card">
                    {!currentRating || currentRating === 0 ? (
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
                          {currentRating}
                        </p>
                      </>
                    )}
                  </span>
                </div>
                <div style={{ margin: "5px" }}></div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <AddBookWatchlist book={tbrEntry} />
                  <AddBookLogButton book={tbrEntry} />
                  {queueMode ? (
                    <button
                      onClick={() => removeFromQueue(queueEntry.id)}
                      title="Remove from queue (keep in TBR)"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#aaa",
                        cursor: "pointer",
                        fontSize: "18px",
                        lineHeight: 1,
                        padding: "0 2px",
                        marginLeft: "2px",
                        marginBottom: "1px",
                        outline: "none",
                      }}
                    >
                      {String.fromCharCode(0x2715)}
                    </button>
                  ) : (
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
                  )}
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
                  style={{ cursor: "pointer" }}
                >
                  {book.author}
                </span>
                {book.release_year ? ` (${book.release_year})` : ""}
              </span>
              {formattedDate ? (
                <span
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
        </div>
      </div>
      {!queueMode && (
        <img
          src="/logdelete.png"
          className="log-delete-icon"
          onClick={() => setShowDeleteModal(true)}
        />
      )}
      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onRate={handleRatingChange}
        onRemove={handleClearRating}
        currentRating={currentRating || 0}
        movieTitle={book.title}
        isRated={currentRating && currentRating > 0}
      />
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        aria-labelledby="delete-book-tbr-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Are you sure you want to remove this from your TBR?
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
              onClick={confirmDelete}
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

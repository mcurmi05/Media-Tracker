import { useState } from "react";
import "../styles/Rating.css";
import "../styles/MovieRatingStar.css";
import "../styles/LogComponent.css";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useBookTbr } from "../contexts/UserBookTbrContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import { deleteBookTbr } from "../services/ratingsfromtable.js";
import AddBookWatchlist from "./AddBookWatchlist.jsx";
import AddBookLogButton from "./AddBookLogButton.jsx";
import RatingModal from "./RatingModal.jsx";
import EditBookInfoModal from "./EditBookInfoModal.jsx";
import { getBookInfo } from "../utils/bookInfo.js";

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

export default function BookTbrComponent({ tbrEntry }) {
  const { removeBookTbr } = useBookTbr();
  const { rateBook, findRatingForBook } = useBookRatings();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [visible, setVisible] = useState(true);
  const book = getBookInfo(tbrEntry);
  const currentRating = findRatingForBook(tbrEntry)?.book_rating ?? 0;

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
      await deleteBookTbr(tbrEntry.id);
      removeBookTbr(tbrEntry.id);
      setVisible(false);
    } catch (err) {
      console.error("Error deleting TBR entry:", err);
    }
    setShowDeleteModal(false);
  }

  if (!visible) return null;

  const handleGoodreadsSearch = () => {
    if (book.goodreads_link) {
      window.open(book.goodreads_link, "_blank");
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
    <div className="log-rating-wrapper">
      <div className="container">
        <div className="top-stuff">
          <div className="poster-wrapper">
            <img
              src={book.cover_image || "/placeholderimage.jpg"}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/placeholderimage.jpg";
              }}
              className="rating-poster"
              onClick={handleGoodreadsSearch}
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
                onClick={handleGoodreadsSearch}
                style={{
                  cursor: book.goodreads_link ? "pointer" : "default",
                }}
              >
                {book.title}{" "}
              </p>
              <button
                onClick={() => setShowEditModal(true)}
                title="Edit book information"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  marginLeft: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/pencil.png"
                  alt="Edit"
                  style={{
                    width: "16px",
                    height: "16px",
                    filter: "saturate(1.5) brightness(1.3)",
                  }}
                />
              </button>
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
      <img
        src="/logdelete.png"
        className="log-delete-icon"
        onClick={() => setShowDeleteModal(true)}
      />
      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onRate={handleRatingChange}
        onRemove={handleClearRating}
        currentRating={currentRating || 0}
        movieTitle={book.title}
        isRated={currentRating && currentRating > 0}
      />
      <EditBookInfoModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        row={tbrEntry}
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

import { useState } from "react";
import "../styles/Rating.css";
import "../styles/MovieRatingStar.css";
import "../styles/LogComponent.css";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useBookTbr } from "../contexts/UserBookTbrContext.jsx";
import { deleteBookTbr, updateBookTbr } from "../services/ratingsfromtable.js";
import AddBookWatchlist from "./AddBookWatchlist.jsx";
import AddBookLogButton from "./AddBookLogButton.jsx";
import RatingModal from "./RatingModal.jsx";

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
  const { removeBookTbr, updateBookTbrEntry } = useBookTbr();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [visible, setVisible] = useState(true);

  const handleRatingChange = async (newRating) => {
    try {
      const updated = await updateBookTbr(tbrEntry.id, { book_rating: newRating });
      updateBookTbrEntry(tbrEntry.id, updated || { book_rating: newRating });
    } catch (err) {
      console.error("Error updating book TBR rating:", err);
    }
  };

  const handleClearRating = async () => {
    try {
      const updated = await updateBookTbr(tbrEntry.id, { book_rating: null });
      updateBookTbrEntry(tbrEntry.id, updated || { book_rating: null });
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
    if (tbrEntry.goodreads_link) {
      window.open(tbrEntry.goodreads_link, "_blank");
    }
  };

  const handleAuthorSearch = () => {
    const formattedAuthor = (tbrEntry.author || "").replace(/\s+/g, "+");
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
              src={tbrEntry.cover_image || "/placeholderimage.jpg"}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/placeholderimage.jpg";
              }}
              className="rating-poster"
              onClick={handleGoodreadsSearch}
              style={{
                cursor: tbrEntry.goodreads_link ? "pointer" : "default",
              }}
              alt={`${tbrEntry.title} cover`}
            />
          </div>
          <div className="right-stuff" style={{ marginTop: "12px" }}>
            <div className="title-and-star">
              <p
                className="movie-title"
                onClick={handleGoodreadsSearch}
                style={{
                  cursor: tbrEntry.goodreads_link ? "pointer" : "default",
                }}
              >
                {tbrEntry.title}{" "}
              </p>
              <div style={{ display: "flex" }}>
                <div className="rating-star-div">
                  <span className="user-rating-movie-card">
                    {!tbrEntry.book_rating || tbrEntry.book_rating === 0 ? (
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
                          {tbrEntry.book_rating}
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
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                >
                  {tbrEntry.author}
                </span>
                {tbrEntry.release_year ? ` (${tbrEntry.release_year})` : ""}
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
        currentRating={tbrEntry.book_rating || 0}
        movieTitle={tbrEntry.title}
        isRated={tbrEntry.book_rating && tbrEntry.book_rating > 0}
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

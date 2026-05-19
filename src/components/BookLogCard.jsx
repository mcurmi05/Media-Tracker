import { useState, useRef, useEffect } from "react";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import { format } from "date-fns";
import { Dialog } from "./ReactDayPicker.jsx";
import "../styles/LogComponent.css";
import "../styles/MovieRatingStar.css";
import RatingModal from "./RatingModal.jsx";
import AddBookWatchlist from "./AddBookWatchlist.jsx";
import AddBookLogButton from "./AddBookLogButton.jsx";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { getBookInfo } from "../utils/bookInfo.js";
import { useNavigate } from "react-router-dom";
import { bookDetailsRoute } from "../utils/goodreads.js";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 520,
  bgcolor: "#1a1a1a",
  color: "white",
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  fontWeight: "bold",
};

const BookLogCard = ({ bookLog }) => {
  const { deleteBookLog, updateBookLog } = useBookLogs();
  const { rateBook, findRatingForBook } = useBookRatings();
  const navigate = useNavigate();
  const book = getBookInfo(bookLog);
  const currentRating = findRatingForBook(bookLog)?.book_rating ?? 0;

  // Editable state
  const [text, setText] = useState(bookLog.log || "");
  const [saving, setSaving] = useState(false);
  const [buttonSaving, setButtonSaving] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [textEdited, setTextEdited] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const debounceTimeout = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [text]);

  // Debounced text saving
  useEffect(() => {
    if (!textEdited) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    setSaving(true);
    debounceTimeout.current = setTimeout(async () => {
      try {
        await updateBookLog(bookLog.id, { log: text });
        setSaving(false);
        setTextEdited(false);
        console.log("Updated book log text");
      } catch (error) {
        setSaving(false);
        console.error("Error updating book log:", error);
      }
    }, 2000);

    return () => clearTimeout(debounceTimeout.current);
  }, [text, textEdited, updateBookLog, bookLog.id]);

  const handleStartDateChange = async (newDate) => {
    try {
      setButtonSaving(true);
      // Use local timezone to avoid date shifting
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, "0");
      const day = String(newDate.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      await updateBookLog(bookLog.id, { start_date: dateString });
      setTimeout(() => setButtonSaving(false), 1200);
    } catch (error) {
      setButtonSaving(false);
      console.error("Error updating start date:", error);
      alert("Failed to save start date. Please try again.");
    }
  };

  const handleEndDateChange = async (newDate) => {
    try {
      setButtonSaving(true);
      // Use local timezone to avoid date shifting
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, "0");
      const day = String(newDate.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      await updateBookLog(bookLog.id, { end_date: dateString });
      setTimeout(() => setButtonSaving(false), 1200);
    } catch (error) {
      setButtonSaving(false);
      console.error("Error updating end date:", error);
      alert("Failed to save end date. Please try again.");
    }
  };

  const handleRatingChange = async (newRating) => {
    try {
      setRatingSaving(true);
      await rateBook(bookLog, newRating);
      setTimeout(() => setRatingSaving(false), 1200);
    } catch (error) {
      setRatingSaving(false);
      console.error("Error updating rating:", error);
      alert("Failed to save rating. Please try again.");
    }
  };

  const handleClearRating = async () => {
    try {
      setRatingSaving(true);
      await rateBook(bookLog, null);
      setTimeout(() => setRatingSaving(false), 1200);
    } catch (error) {
      setRatingSaving(false);
      console.error("Error clearing rating:", error);
      alert("Failed to clear rating. Please try again.");
    }
  };

  const handleMarkRead = async () => {
    try {
      setButtonSaving(true);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      await updateBookLog(bookLog.id, { end_date: dateString, dnf: false });
      setTimeout(() => setButtonSaving(false), 1200);
    } catch (error) {
      setButtonSaving(false);
      console.error("Error marking as read:", error);
      alert("Failed to mark as read. Please try again.");
    }
  };

  const handleMarkUnread = async () => {
    try {
      setButtonSaving(true);
      await updateBookLog(bookLog.id, { end_date: null });
      setTimeout(() => setButtonSaving(false), 1200);
    } catch (error) {
      setButtonSaving(false);
      console.error("Error marking as unread:", error);
      alert("Failed to mark as unread. Please try again.");
    }
  };

  // Mark this book as DNF (did not finish), or undo it.
  const handleDnf = async (value) => {
    try {
      setButtonSaving(true);
      await updateBookLog(
        bookLog.id,
        value ? { dnf: true, end_date: null } : { dnf: false },
      );
      setTimeout(() => setButtonSaving(false), 1200);
    } catch (error) {
      setButtonSaving(false);
      console.error("Error updating DNF:", error);
      alert("Failed to update DNF. Please try again.");
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteBookLog(bookLog.id);
    } catch (error) {
      console.error("Error deleting book log:", error);
    }
    setShowDeleteModal(false);
  };

  const handleGoodreadsSearch = () => {
    if (book.goodreads_link) {
      window.open(book.goodreads_link, "_blank");
    }
  };

  const openBookDetails = () => {
    const route = bookDetailsRoute(book.goodreads_link);
    if (route) {
      navigate(route, { state: { book: bookLog.book_entries || book } });
    }
  };

  const handleAuthorSearch = () => {
    const formattedAuthor = (book.author || "").replace(/\s+/g, "+");
    const googleAuthorUrl = `https://www.google.com/search?q=${formattedAuthor}+books`;
    window.open(googleAuthorUrl, "_blank");
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return null;
    }
  };

  return (
    <div className="book-log-card">
      <img
        src="/logdelete.png"
        className="log-delete-icon"
        onClick={handleDelete}
        title="Delete log"
        style={{ top: "10px" }}
      />
      <div className="book-log-content">
        <div className="book-info-section" style={{ position: "relative" }}>
          <div className="book-cover-section">
            {book.cover_image ? (
              <img
                src={book.cover_image}
                alt={`${book.title} cover`}
                className="book-cover"
                onClick={openBookDetails}
                style={{ cursor: book.goodreads_link ? "pointer" : "default" }}
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`book-cover-placeholder ${!book.cover_image ? "show" : ""}`}
            >
              📚
            </div>
          </div>

          <div className="book-details">
            <div className="book-info">
              <div style={{ marginTop: "50px" }}>
                <div className="book-header">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "15px",
                    }}
                  >
                    <div>
                      <h3
                        className="book-title"
                        style={{ margin: 0, cursor: book.goodreads_link ? "pointer" : "default" }}
                        onClick={openBookDetails}
                      >
                        {book.title}
                      </h3>
                      <p
                        className="book-author"
                        style={{
                          margin: 0,
                          marginTop: "10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>
                          by{" "}
                          <span
                            onClick={handleAuthorSearch}
                            style={{ cursor: "pointer" }}
                          >
                            {book.author}
                          </span>
                          {book.release_year
                            ? ` (${book.release_year})`
                            : ""}
                        </span>
                        <img
                          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVWGYFkKfh28rOYSP6XPkZgf3Cya8tsWasxA&s"
                          alt="Goodreads"
                          onClick={handleGoodreadsSearch}
                          style={{
                            width: "20px",
                            height: "20px",
                            cursor: "pointer",
                            borderRadius: "4px",
                            transition: "opacity 0.2s",
                          }}
                          onMouseOver={(e) => (e.target.style.opacity = "0.8")}
                          onMouseOut={(e) => (e.target.style.opacity = "1")}
                        />
                      </p>
                    </div>
                    <span
                      className="user-rating-movie-card"
                      style={{ position: "relative", top: "30px" }}
                    >
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        position: "relative",
                        top: "16px",
                        marginLeft: "-13px",
                      }}
                    >
                      <AddBookWatchlist book={bookLog} />
                      <AddBookLogButton book={bookLog} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="book-dates"
            style={{
              position: "absolute",
              bottom: "0px",
              left: "155px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              className="book-date-field"
              style={{ display: "flex", alignItems: "center" }}
            >
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "#ccc",
                  marginRight: "-2px",
                }}
              >
                Started:
              </span>
              <Dialog
                initialDate={
                  bookLog.start_date ? new Date(bookLog.start_date) : null
                }
                onDateChange={handleStartDateChange}
                showWeekday={false}
                dateColor="#ffffff"
                minWidth="120px"
                extraActions={
                  !bookLog.end_date && !bookLog.dnf
                    ? [
                        {
                          label: "DNF",
                          onClick: () => handleDnf(true),
                          danger: true,
                        },
                      ]
                    : []
                }
              />
            </div>

            {bookLog.end_date ? (
              <div
                className="book-date-field"
                style={{ display: "flex", alignItems: "center" }}
              >
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#ccc",
                    marginRight: "4px",
                  }}
                >
                  Read:
                </span>
                <Dialog
                  initialDate={new Date(bookLog.end_date)}
                  onDateChange={handleEndDateChange}
                  showWeekday={false}
                  dateColor="#ffffff"
                  minWidth="120px"
                />
                <img
                  src="/logdelete.png"
                  alt="Mark as unread"
                  title="Mark as unread"
                  onClick={buttonSaving ? undefined : handleMarkUnread}
                  style={{
                    width: 12,
                    height: 12,
                    marginLeft: "11px",
                    marginTop: "4px",
                    cursor: buttonSaving ? "default" : "pointer",
                    transform: "translateY(-2px)",
                  }}
                />
              </div>
            ) : bookLog.dnf ? (
              <span
                className="dnf-badge"
                onClick={buttonSaving ? undefined : () => handleDnf(false)}
                title="Undo did not finish"
                style={{
                  transform: "translateY(-4px)",
                  cursor: buttonSaving ? "default" : "pointer",
                }}
              >
                DNF
              </span>
            ) : (
              <button
                onClick={handleMarkRead}
                disabled={buttonSaving}
                style={{
                  background: "transparent",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  padding: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Mark as read"
              >
                <img
                  src="/watched.png"
                  alt="Mark as read"
                  style={{
                    width: 20,
                    height: 20,
                    transform: "translateY(-4px)",
                  }}
                />
              </button>
            )}
          </div>
        </div>

        <div className="book-log-text" style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            className="log-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTextEdited(true);
            }}
            placeholder="Add notes about this book..."
          />
          {saving && (
            <div
              style={{
                position: "absolute",
                bottom: "-12px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "0.8em",
                color: "#888",
                whiteSpace: "nowrap",
              }}
            >
              <p style={{ margin: 0, color: "#888" }}>
                Saving, please don't refresh or click away...
              </p>
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

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        aria-labelledby="delete-book-log-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Are you sure you want to delete this log?
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
              Delete
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default BookLogCard;

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import "../styles/AddLog.css";

const emptyForm = {
  title: "",
  author: "",
  cover_image: "",
  release_year: "",
  goodreads_link: "",
};

const AddBookLog = ({
  isOpen,
  onClose,
  title = "Add Book Log",
  submitLabel = "Add Book Log",
  onCreate,
  requireRating = false,
}) => {
  const { user } = useAuth();
  const { createBookLog } = useBookLogs();

  const [mode, setMode] = useState("goodreads"); // "goodreads" | "custom"
  const [formData, setFormData] = useState(emptyForm);
  const [bookRating, setBookRating] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const resetAll = () => {
    setFormData(emptyForm);
    setBookRating("");
    setMode("goodreads");
    setHasFetched(false);
    setFetchError("");
    setIsFetching(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFetchGoodreads = async () => {
    const link = formData.goodreads_link.trim();
    if (!link) {
      setFetchError("Paste a Goodreads link first.");
      return;
    }
    setFetchError("");
    setIsFetching(true);
    try {
      const response = await fetch(
        `/api/goodreads?url=${encodeURIComponent(link)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        author: data.author || prev.author,
        cover_image: data.cover_image || prev.cover_image,
        release_year:
          data.release_year != null ? String(data.release_year) : prev.release_year,
      }));
      setHasFetched(true);
    } catch (err) {
      setFetchError(err.message || "Failed to fetch from Goodreads.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const payload = { ...formData, user_id: user.id };
      if (requireRating) {
        payload.book_rating = Number(bookRating);
      }
      if (onCreate) {
        await onCreate(payload);
      } else {
        await createBookLog(payload);
      }
      resetAll();
      onClose();
    } catch (error) {
      console.error("Error creating book:", error);
      alert("Failed to add book: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showDetails = mode === "custom" || hasFetched;
  const ratingValid =
    !requireRating ||
    (bookRating !== "" &&
      Number(bookRating) >= 1 &&
      Number(bookRating) <= 10);
  const canSubmit =
    !isSubmitting && formData.title && formData.author && ratingValid;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="book-log-form">
          {mode === "goodreads" && (
            <>
              <div className="form-field">
                <label htmlFor="goodreads_link">Goodreads Link</label>
                <input
                  id="goodreads_link"
                  type="url"
                  value={formData.goodreads_link}
                  onChange={(e) =>
                    handleInputChange("goodreads_link", e.target.value)
                  }
                  placeholder="https://www.goodreads.com/book/show/..."
                  autoFocus
                />
              </div>

              <div className="goodreads-actions">
                <button
                  type="button"
                  className="fetch-btn"
                  onClick={handleFetchGoodreads}
                  disabled={isFetching || !formData.goodreads_link.trim()}
                >
                  {isFetching ? "Fetching..." : "Fetch from Goodreads"}
                </button>
                <button
                  type="button"
                  className="custom-btn"
                  onClick={() => {
                    setMode("custom");
                    setFetchError("");
                  }}
                >
                  Custom
                </button>
              </div>

              {fetchError && <p className="fetch-error">{fetchError}</p>}
            </>
          )}

          {mode === "custom" && (
            <div className="mode-switch-row">
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode("goodreads");
                  setHasFetched(false);
                }}
              >
                {"<- Use Goodreads link instead"}
              </button>
            </div>
          )}

          {showDetails && (
            <>
              {mode === "goodreads" && formData.cover_image && (
                <div className="fetched-preview">
                  <img
                    src={formData.cover_image}
                    alt="Book cover"
                    className="fetched-cover"
                  />
                </div>
              )}

              <div className="form-field">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="author">Author *</label>
                <input
                  id="author"
                  type="text"
                  value={formData.author}
                  onChange={(e) => handleInputChange("author", e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="cover_image">Cover Image URL</label>
                <input
                  id="cover_image"
                  type="url"
                  value={formData.cover_image}
                  onChange={(e) =>
                    handleInputChange("cover_image", e.target.value)
                  }
                  placeholder="https://example.com/book-cover.jpg"
                />
              </div>

              <div className="form-field">
                <label htmlFor="release_year">Release Year</label>
                <input
                  id="release_year"
                  type="number"
                  value={formData.release_year}
                  onChange={(e) =>
                    handleInputChange("release_year", e.target.value)
                  }
                  placeholder="e.g. 1984"
                  min="1000"
                  max={new Date().getFullYear()}
                />
              </div>

              {mode === "custom" && (
                <div className="form-field">
                  <label htmlFor="goodreads_link">Goodreads Link</label>
                  <input
                    id="goodreads_link"
                    type="url"
                    value={formData.goodreads_link}
                    onChange={(e) =>
                      handleInputChange("goodreads_link", e.target.value)
                    }
                    placeholder="https://www.goodreads.com/book/show/..."
                  />
                </div>
              )}

              {requireRating && (
                <div className="form-field">
                  <label htmlFor="book_rating">Rating (1-10) *</label>
                  <input
                    id="book_rating"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={bookRating}
                    onChange={(e) => setBookRating(e.target.value)}
                    placeholder="e.g. 8"
                    required
                  />
                </div>
              )}
            </>
          )}

          <div className="modal-actions">
            <button type="button" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Adding..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBookLog;

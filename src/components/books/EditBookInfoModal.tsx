import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../../styles/media/AddLog.css";
import { updateBookEntry } from "../../services/ratingsfromtable";
import { useBookLogs } from "../../contexts/UserBookLogsContext";
import { useBookTbr } from "../../contexts/UserBookTbrContext";
import { useBookRatings } from "../../contexts/UserBookRatingsContext";
import { getBookInfo } from "../../utils/bookInfo";

const EditBookInfoModal = ({ isOpen, onClose, row, onUpdated }) => {
  const { syncBookEntry: syncLogs } = useBookLogs();
  const { syncBookEntry: syncTbr } = useBookTbr();
  const { syncBookEntry: syncRatings } = useBookRatings();

  const book = getBookInfo(row);

  const buildInitial = () => ({
    title: book.title || "",
    author: book.author || "",
    cover_image: book.cover_image || "",
    release_year: book.release_year || "",
    goodreads_link: book.goodreads_link || "",
    book_description: book.book_description || "",
  });

  const [formData, setFormData] = useState(buildInitial());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitial());
      setFetchError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, row]);

  const handleRefetchGoodreads = async () => {
    const link = (formData.goodreads_link || "").trim();
    if (!link) {
      setFetchError("Add a Goodreads link first.");
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
          data.release_year != null
            ? String(data.release_year)
            : prev.release_year,
        book_description: data.description || prev.book_description,
      }));
    } catch (err) {
      setFetchError(err.message || "Failed to fetch from Goodreads.");
    } finally {
      setIsFetching(false);
    }
  };

  const bookEntryId =
    row?.book_entries?.id ||
    row?.book_id ||
    (row?.id && row?.title && !row?.user_id ? row.id : null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bookEntryId) {
      alert(
        "Cannot edit: this row is not yet linked to a book_entries record. Backfill book_id first.",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const updates = {
        title: (formData.title || "").trim(),
        author: (formData.author || "").trim(),
        cover_image: formData.cover_image || null,
        release_year: formData.release_year
          ? Number(formData.release_year) || null
          : null,
        goodreads_link: formData.goodreads_link || null,
        book_description: formData.book_description || null,
      };
      const updated = await updateBookEntry(bookEntryId, updates);
      const merged = updated || { id: bookEntryId, ...updates };
      // Propagate to every context so the change is reflected everywhere.
      syncLogs(bookEntryId, merged);
      syncTbr(bookEntryId, merged);
      syncRatings(bookEntryId, merged);
      if (onUpdated) onUpdated(merged);
      onClose();
    } catch (error) {
      console.error("Error updating book info:", error);
      alert("Failed to update book information: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(buildInitial());
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Book Information</h2>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="book-log-form">
          <div className="form-field">
            <label htmlFor="edit-title">Title *</label>
            <input
              id="edit-title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-author">Author *</label>
            <input
              id="edit-author"
              type="text"
              value={formData.author}
              onChange={(e) => handleInputChange("author", e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-cover_image">Cover Image URL</label>
            <input
              id="edit-cover_image"
              type="url"
              value={formData.cover_image}
              onChange={(e) => handleInputChange("cover_image", e.target.value)}
              placeholder="https://example.com/book-cover.jpg"
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-release_year">Release Year</label>
            <input
              id="edit-release_year"
              type="number"
              value={formData.release_year}
              onChange={(e) =>
                handleInputChange("release_year", e.target.value)
              }
              placeholder="e.g. 1984"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-goodreads_link">Goodreads Link</label>
            <input
              id="edit-goodreads_link"
              type="url"
              value={formData.goodreads_link}
              onChange={(e) =>
                handleInputChange("goodreads_link", e.target.value)
              }
              placeholder="https://www.goodreads.com/book/show/..."
            />
          </div>

          <div className="goodreads-actions" style={{ marginBottom: 4 }}>
            <button
              type="button"
              className="fetch-btn"
              onClick={handleRefetchGoodreads}
              disabled={isFetching || !formData.goodreads_link.trim()}
            >
              {isFetching ? "Fetching..." : "Refetch from Goodreads"}
            </button>
          </div>
          {fetchError && <p className="fetch-error">{fetchError}</p>}

          <div className="modal-actions">
            <button type="button" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.author}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default EditBookInfoModal;

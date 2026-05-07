import { useState } from "react";
import "../styles/AddLog.css";

const EditBookInfoModal = ({ isOpen, onClose, bookLog, onSave }) => {
  const [formData, setFormData] = useState({
    title: bookLog?.title || "",
    author: bookLog?.author || "",
    cover_image: bookLog?.cover_image || "",
    release_year: bookLog?.release_year || "",
    goodreads_link: bookLog?.goodreads_link || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bookLog) return;

    setIsSubmitting(true);
    try {
      await onSave(bookLog.id, formData);
      onClose();
    } catch (error) {
      console.error("Error updating book info:", error);
      alert("Failed to update book information: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form to original values when closing
    setFormData({
      title: bookLog?.title || "",
      author: bookLog?.author || "",
      cover_image: bookLog?.cover_image || "",
      release_year: bookLog?.release_year || "",
      goodreads_link: bookLog?.goodreads_link || "",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
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
              min="1000"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-goodreads_link">Goodreads Link</label>
            <input
              id="edit-goodreads_link"
              type="url"
              value={formData.goodreads_link}
              onChange={(e) => handleInputChange("goodreads_link", e.target.value)}
              placeholder="https://www.goodreads.com/book/show/..."
            />
          </div>

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
    </div>
  );
};

export default EditBookInfoModal;

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import "../styles/AddLog.css";

const AddBookLog = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { createBookLog } = useBookLogs();

  const [formData, setFormData] = useState({
    title: "",
    author: "",
    cover_image: "",
    release_year: "",
    goodreads_link: "",
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
    if (!user) return;

    console.log("Form submitted with data:", formData);
    setIsSubmitting(true);
    try {
      const bookLogData = {
        ...formData,
        user_id: user.id,
      };

      console.log("Sending to createBookLog:", bookLogData);
      const result = await createBookLog(bookLogData);
      console.log("Book log created successfully:", result);

      // Reset form
      setFormData({
        title: "",
        author: "",
        cover_image: "",
        release_year: "",
        goodreads_link: "",
      });

      console.log("Closing modal");
      onClose();
    } catch (error) {
      console.error("Error creating book log:", error);
      alert("Failed to create book log: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Book Log</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="book-log-form">
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
              onChange={(e) => handleInputChange("cover_image", e.target.value)}
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

          <div className="form-field">
            <label htmlFor="goodreads_link">Goodreads Link</label>
            <input
              id="goodreads_link"
              type="url"
              value={formData.goodreads_link}
              onChange={(e) => handleInputChange("goodreads_link", e.target.value)}
              placeholder="https://www.goodreads.com/book/show/..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.author}
            >
              {isSubmitting ? "Adding..." : "Add Book Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBookLog;

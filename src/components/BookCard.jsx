import { useEffect, useState } from "react";
import "../styles/MovieCard.css";
import "../styles/MovieRatingStar.css";
import AddBookLogButton from "./AddBookLogButton.jsx";
import AddBookWatchlist from "./AddBookWatchlist.jsx";
import BookRatingStar from "./BookRatingStar.jsx";
import EditBookInfoModal from "./EditBookInfoModal.jsx";

function parseTitle(rawTitle) {
  const match = (rawTitle || "").match(
    /^(.*?)\s*\(([^()]+?)[,\s]*#([^()]+?)\)\s*$/,
  );
  if (!match) {
    return { mainTitle: rawTitle || "", seriesName: null, seriesIndex: null };
  }
  return {
    mainTitle: match[1].trim(),
    seriesName: match[2].trim(),
    seriesIndex: match[3].trim(),
  };
}

function BookCard({ book: bookProp }) {
  const [book, setBook] = useState(bookProp);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    setBook(bookProp);
  }, [bookProp]);

  const goodreadsLink = book?.goodreads_link || null;
  const { mainTitle, seriesName, seriesIndex } = parseTitle(book?.title);

  const openGoodreads = () => {
    if (goodreadsLink) {
      window.open(goodreadsLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleUpdated = (updated) => {
    setBook((prev) => ({ ...(prev || {}), ...updated }));
  };

  const handleAuthorSearch = () => {
    const formattedAuthor = (book.author || "").replace(/\s+/g, "+");
    if (!formattedAuthor) return;
    window.open(
      `https://www.google.com/search?q=${formattedAuthor}+books`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="movie-card">
      <div
        className="movie-poster"
        onClick={openGoodreads}
        style={{ cursor: goodreadsLink ? "pointer" : "default" }}
      >
        <img
          className="movie-poster-img"
          src={book.cover_image ? book.cover_image : "/placeholderimage.jpg"}
          alt={book.title}
          style={{ objectFit: "contain" }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/placeholderimage.jpg";
          }}
        />
      </div>

      <div className="movie-info" style={{ justifyContent: "center" }}>
        <div className="title-and-addlog" style={{ marginTop: "4px" }}>
          <h3
            onClick={openGoodreads}
            style={{ cursor: goodreadsLink ? "pointer" : "default" }}
          >
            {mainTitle}
          </h3>
          <div className="add-log-container-moviecard">
            <AddBookWatchlist book={book} />
            <AddBookLogButton book={book} />
            <div
              className="white-highlight"
              onClick={() => setShowEditModal(true)}
              title="Edit book information"
              style={{
                marginLeft: "4px",
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
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            marginTop: seriesName ? 0 : "10px",
          }}
        >
          {seriesName && (
            <p
              style={{
                margin: 0,
                marginBottom: "6px",
                fontWeight: 700,
                color: "#e8e4dc",
              }}
            >
              {seriesName} #{seriesIndex}
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <p style={{ margin: 0 }}>
              {book.author ? (
                <span
                  onClick={handleAuthorSearch}
                  style={{ cursor: "pointer" }}
                >
                  {book.author}
                </span>
              ) : null}
              {book.author && book.release_year ? " · " : ""}
              {book.release_year ? `${book.release_year}` : ""}
            </p>
            {goodreadsLink ? (
              <a
                href={goodreadsLink}
                target="_blank"
                rel="noopener noreferrer"
                title="View on Goodreads"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVWGYFkKfh28rOYSP6XPkZgf3Cya8tsWasxA&s"
                  alt="Goodreads"
                  style={{ width: 20, height: 20, borderRadius: 4 }}
                />
              </a>
            ) : null}
            <div
              style={{
                marginLeft: "auto",
                position: "relative",
                top: "15px",
              }}
            >
              <BookRatingStar book={book} />
            </div>
          </div>
        </div>
      </div>

      <EditBookInfoModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        row={book}
        onUpdated={handleUpdated}
      />
    </div>
  );
}

export default BookCard;

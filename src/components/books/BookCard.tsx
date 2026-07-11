import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/media/MovieCard.css";
import "../../styles/media/MovieRatingStar.css";
import AddBookLogButton from "./AddBookLogButton";
import AddBookWatchlist from "./AddBookWatchlist";
import BookRatingStar from "./BookRatingStar";
import EditBookInfoModal from "./EditBookInfoModal";
import GoodreadsInfo from "./GoodreadsInfo";
import StorygraphInfo from "../../features/ratings/storygraph/StorygraphInfo";
import { bookDetailsRouteForBook } from "../../utils/goodreads";
import { makeNavHandlers } from "../../utils/navClick";
import { useCovers } from "../../contexts/UserCoversContext";

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

function BookCard({ book: bookProp, posterOnly = false, logged = false }) {
  const [book, setBook] = useState(bookProp);
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();
  const { coverForHardcover } = useCovers();
  const cover = coverForHardcover(book.hardcover_id) || book.cover_image;

  useEffect(() => {
    setBook(bookProp);
  }, [bookProp]);

  const { mainTitle, seriesName, seriesIndex } = parseTitle(book?.title);

  const detailsRoute = bookDetailsRouteForBook(book);
  const detailHandlers = makeNavHandlers(navigate, detailsRoute, {
    state: { book },
  });

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

  // Search results: cover only, no title/buttons. The shared .movie-poster box
  // (aspect-ratio 2/3 + object-fit cover) makes every cover the same size.
  if (posterOnly) {
    return (
      <div className="movie-card movie-card--poster">
        <div
          className="movie-poster"
          {...detailHandlers}
          style={{ cursor: detailsRoute ? "pointer" : "default" }}
        >
          <img
            className="movie-poster-img"
            src={cover ? cover : "/images/placeholderimage.jpg"}
            alt={book.title}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/placeholderimage.jpg";
            }}
          />
          {logged && (
            <span
              className="poster-logged-tick"
              title="Logged — view in log"
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/log", { state: { searchTerm: mainTitle || "" } });
              }}
              onAuxClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="movie-card">
      <div
        className="movie-poster"
        {...detailHandlers}
        style={{ cursor: detailsRoute ? "pointer" : "default" }}
      >
        <img
          className="movie-poster-img"
          src={cover ? cover : "/images/placeholderimage.jpg"}
          alt={book.title}
          style={{ objectFit: "contain" }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/images/placeholderimage.jpg";
          }}
        />
      </div>

      <div className="movie-info" style={{ justifyContent: "center" }}>
        <div className="title-and-addlog" style={{ marginTop: "4px" }}>
          <h3
            {...detailHandlers}
            style={{ cursor: detailsRoute ? "pointer" : "default" }}
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
                src="/images/pencil.png"
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
            <GoodreadsInfo book={book} />
            <StorygraphInfo book={book} />
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

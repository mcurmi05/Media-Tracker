import "../styles/MovieRatingStar.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import RatingModal from "./RatingModal";

function BookRatingStar({ book }) {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { rateBook, findRatingForBook } = useBookRatings();

  const existing = findRatingForBook(book);
  const rating = existing?.book_rating ?? 0;
  const rated = rating > 0;

  function handleClick() {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    setShowRatingModal(true);
  }

  async function handleRating(newRating) {
    await rateBook(book, newRating);
  }

  async function handleRemoveRating() {
    await rateBook(book, null);
  }

  return (
    <>
      <div className="user-rating-movie-card">
        {!rated ? (
          <>
            <img
              className="user-rating-star"
              src="/user-rating-star.png"
              onClick={handleClick}
            />
            <p className="user-rating-number" onClick={handleClick}></p>
          </>
        ) : (
          <>
            <img
              className="user-rating-star"
              src="/user-rating-star2.png"
              onClick={handleClick}
            />
            <p className="user-rating-number" onClick={handleClick}>
              {rating}
            </p>
          </>
        )}
      </div>
      <RatingModal
        open={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onRate={handleRating}
        onRemove={handleRemoveRating}
        currentRating={rating}
        movieTitle={book?.title || ""}
        isRated={rated}
      />
    </>
  );
}

export default BookRatingStar;

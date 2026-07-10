import "../../styles/media/MovieRatingStar.css";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import RatingModal from "../common/RatingModal";
import { useRatings } from "../../contexts/UserRatingsContext";
import { supabase } from "../../services/supabase-client";
import { getRatingForMovie } from "../../services/ratingsfromtable";
import { upsertMovie, resolveFullMovie } from "../../services/movieMetadata";

function MovieRatingStar({movie}) {

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  // movie_entry_id of the existing rating, needed to update/remove it.
  const [ratingEntryId, setRatingEntryId] = useState(null);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {userRatings, userRatingsLoaded, addRating, updateRating, removeRating} = useRatings();

  useEffect( () => {
      if (isAuthenticated && userRatingsLoaded){
        const ratingRow = getRatingForMovie(userRatings, movie);

        if (ratingRow){
          setRating(ratingRow.rating);
          setRated(true);
          setRatingEntryId(ratingRow.movie_entry_id ?? null);
        } else{
          setRating(0);
          setRated(false);
          setRatingEntryId(null);
        }

      } else {
        setRating(0);
        setRated(false);
        setRatingEntryId(null);
      }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[isAuthenticated, userRatings, userRatingsLoaded, movie.tmdb_id, movie.media_type, movie.id]);

  async function handleNewRatingClick() {
    if (!isAuthenticated) {
      navigate("/signin");
    } else {
      setShowRatingModal(true);
    }
  }

  async function handleReRatingClick() {
    if (!isAuthenticated) {
      navigate("/signin");
    } else {
      setShowRatingModal(true);
    }
  }

  async function handleRating(newRating) {
      // No-op if the rating value hasn't actually changed, so updated_at
      // keeps pointing at the last real change.
      if (rated && Number(rating) === Number(newRating)) {
        return;
      }
      setRating(newRating);
      // Ensure full metadata (browse cards only carry tmdb_id), cache it in the
      // shared movies table, and reference it by uuid.
      const full =
        movie.tmdb_id != null && movie.id
          ? movie
          : await resolveFullMovie(movie);
      const movieEntryId = await upsertMovie(full);

      try {
        let error;

        if (rated) {
          const result = await supabase
            .from('user_ratings')
            .update({rating: newRating})
            .eq('entry_id', movieEntryId)
            .eq('user_id', user.id);
          error = result.error;
        } else {

          const result = await supabase
            .from('user_ratings')
            .insert({
              user_id: user.id,
              rating: newRating,
              entry_id: movieEntryId,
              rating_history: [{ rating: newRating, at: new Date().toISOString() }],
            });
          error = result.error;
        }

        if (error) {
          console.error(error);
        } else {
          setRated(true);
          setRatingEntryId(movieEntryId);
          if (rated) {
            updateRating(movieEntryId, newRating, full);
          } else {
            addRating(movieEntryId, newRating, full);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function handleRemoveRating() {
      // Resolve the rating's movie_entry_id (cached from the lookup, or
      // recomputed from the title's metadata as a fallback).
      let entryId = ratingEntryId;
      if (!entryId) {
        const ratingRow = getRatingForMovie(userRatings, movie);
        entryId = ratingRow?.movie_entry_id ?? null;
      }
      if (!entryId) return;
      try {
        const { error } = await supabase
          .from('user_ratings')
          .delete()
          .eq('entry_id', entryId)
          .eq('user_id', user.id);

        if (error) {
          console.error(error);
        } else {
          setRating(0);
          setRated(false);
          setRatingEntryId(null);
          removeRating(entryId);
        }
      } catch (err) {
        console.error(err);
      }
    }

  return (
    <>
        <div className="user-rating-movie-card">
        {!rating ? (
            <>
            <img
                className="user-rating-star"
                src="/images/user-rating-star.png"
                onClick={handleNewRatingClick}
            />
            <p className="user-rating-number" onClick={handleNewRatingClick}></p>
            </>
        ) : (
            <>
            <img
                className="user-rating-star"
                src="/images/user-rating-star2.png"
                onClick={handleReRatingClick}
            />
            <p
                className="user-rating-number"
                data-len={Math.min(String(rating).length, 5)}
                onClick={handleReRatingClick}
            >
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
                movieTitle={movie.primaryTitle}
                isRated={rated}
            />
    </>
  );
}

export default MovieRatingStar;

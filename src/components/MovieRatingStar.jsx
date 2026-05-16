import "../styles/MovieRatingStar.css";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import RatingModal from "./RatingModal";
import { useRatings } from "../contexts/UserRatingsContext";
import { supabase } from "../services/supabase-client";
import { getRatingFromArray } from "../services/ratingsfromtable";
import { getMovieById } from "../services/api";

function MovieRatingStar({movie}) {

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {userRatings, userRatingsLoaded, addRating, updateRating, removeRating} = useRatings();
  
  useEffect( () => {
      if (isAuthenticated && userRatingsLoaded){
        const movieRating = getRatingFromArray(userRatings, movie.id);
  
        if (movieRating){
          setRating(movieRating);
          setRated(true);
        } else{
          setRating(0);
          setRated(false);
        }
  
      } else {
        setRating(0);
        setRated(false);
      }
  
    },[isAuthenticated, userRatings, userRatingsLoaded, movie.id]);

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
      console.log("calling api to get more information about movie for database entry")
      const movie_object = await getMovieById(movie.id)

      try {
        let error;
        
        if (rated) {
          const result = await supabase
            .from('ratings')
            .update({rating: newRating})
            .eq('imdb_movie_id', movie.id)
            .eq('user_id', user.id);
          error = result.error;
        } else {
          
          const result = await supabase
            .from('ratings')
            .insert({imdb_movie_id: movie.id, user_id: user.id, rating: newRating, movie_object:movie_object });
          error = result.error;
        }
  
        if (error) {
          console.error(error);
        } else {
          setRated(true);
          if (rated) {
            updateRating(movie.id, newRating, movie_object);
          } else {
            addRating(movie.id, newRating, movie_object);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  
    async function handleRemoveRating() {
      try {
        const { error } = await supabase
          .from('ratings')
          .delete()
          .eq('imdb_movie_id', movie.id)
          .eq('user_id', user.id);
  
        if (error) {
          console.error(error);
        } else {
          setRating(0);
          setRated(false);
          removeRating(movie.id);
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
                src="/user-rating-star.png"
                onClick={handleNewRatingClick}
            />
            <p className="user-rating-number" onClick={handleNewRatingClick}></p>
            </>
        ) : (
            <>
            <img
                className="user-rating-star"
                src="/user-rating-star2.png"
                onClick={handleReRatingClick}
            />
            <p className="user-rating-number" onClick={handleReRatingClick}>
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

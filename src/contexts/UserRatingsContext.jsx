import { createContext, useContext, useState } from "react";
import {
  getUserRatings,
  updateUserRating,
  updateUserRanking,
} from "../services/ratingsfromtable.js";
import { useAuth } from "./AuthContext.jsx";
import { useEffect, useRef } from "react";

/* eslint-disable react-refresh/only-export-components */

const UserRatingsContext = createContext();

export const useRatings = () => {
  const context = useContext(UserRatingsContext);
  if (!context) {
    throw new Error("useRatings must be used within a UserRatingsProvider");
  }
  return context;
};

export const UserRatingsProvider = ({ children }) => {
  const [userRatings, setUserRatings] = useState([]);
  const [userRatingsLoaded, setUserRatingsLoaded] = useState(false);
  const { user } = useAuth();
  const hasFetched = useRef(false);

  const addRating = (movieId, rating, movie) => {
    const newRating = {
      imdb_movie_id: movieId,
      user_id: user.id,
      rating: rating,
      movie_object: movie,
      created_at: new Date().toISOString(),
    };
    setUserRatings((prev) => [...prev, newRating]);
  };

  const updateRating = async (movieId, newRating, movie) => {
    setUserRatings((prev) => {
      // compute next rank if moving to 10 and currently unranked
      const isBecomingTen = Number(newRating) === 10;
      const maxRank = prev.reduce((max, r) => {
        return Number(r.rating) === 10 && Number.isInteger(r.ranking)
          ? Math.max(max, r.ranking)
          : max;
      }, 0);
      return prev.map((rating) => {
        if (rating.imdb_movie_id !== movieId) return rating;
        const next = {
          ...rating,
          rating: newRating,
          movie_object: movie,
          updated_at: new Date().toISOString(),
        };
        if (isBecomingTen && !Number.isInteger(rating.ranking)) {
          next.ranking = maxRank + 1; // default to bottom
        }
        return next;
      });
    });
    if (user && movieId) {
      try {
        await updateUserRating(user.id, movieId, newRating);
        // If becoming 10 and was unranked, persist bottom rank as well
        if (Number(newRating) === 10) {
          const current = userRatings.find((r) => r.imdb_movie_id === movieId);
          if (!current?.ranking) {
            // recompute max on latest state
            const latestMax = Math.max(
              0,
              ...userRatings
                .filter(
                  (r) => Number(r.rating) === 10 && Number.isInteger(r.ranking)
                )
                .map((r) => r.ranking)
            );
            await updateUserRanking(user.id, movieId, latestMax + 1);
          }
        }
      } catch (err) {
        console.error("Failed to update rating in Supabase:", err);
      }
    }
  };

  const removeRating = (movieId) => {
    setUserRatings((prev) =>
      prev.filter((rating) => rating.imdb_movie_id !== movieId)
    );
  };

  const updateRanking = async (movieId, newRanking) => {
    // optimistic update in memory
    setUserRatings((prev) =>
      prev.map((r) =>
        r.imdb_movie_id === movieId ? { ...r, ranking: newRanking } : r
      )
    );
    if (user && movieId) {
      try {
        await updateUserRanking(user.id, movieId, newRanking);
      } catch (err) {
        console.error("Failed to update ranking in Supabase:", err);
      }
    }
  };

  useEffect(() => {
    const loadRatings = async () => {
      if (user && !hasFetched.current) {
        hasFetched.current = true;
        try {
          const ratings = await getUserRatings(user);
          console.log(ratings);
          setUserRatings(ratings);
          setUserRatingsLoaded(true);
        } catch (err) {
          setUserRatingsLoaded(false);
          console.log(err);
        }
      }
    };
    loadRatings();
  }, [user]);

  return (
    <UserRatingsContext.Provider
      value={{
        userRatings,
        userRatingsLoaded,
        setUserRatings,
        addRating,
        removeRating,
        updateRating,
        updateRanking,
      }}
    >
      {children}
    </UserRatingsContext.Provider>
  );
};

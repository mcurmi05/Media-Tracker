import { createContext, useContext, useState } from "react";
import {
  getUserRatings,
  updateUserRating,
  updateUserRanking,
} from "../services/ratingsfromtable";
import { useAuth } from "./AuthContext";
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

  // Ratings are identified in memory by movie_entry_id (the movies_and_tv_entries
  // uuid), matching how they're stored and referenced in the DB.
  const addRating = (movieEntryId, rating, movie) => {
    const newRating = {
      movie_entry_id: movieEntryId,
      user_id: user.id,
      rating: rating,
      movie_object: movie,
      created_at: new Date().toISOString(),
      // Ratings created from now on have a trustworthy created_at.
      accurate: true,
    };
    setUserRatings((prev) => [...prev, newRating]);
  };

  const updateRating = async (movieEntryId, newRating, movie) => {
    // The value the rating had before this change, recorded so the UI can
    // show what it was updated from.
    const previousRating =
      userRatings.find((r) => r.movie_entry_id === movieEntryId)?.rating ?? null;
    setUserRatings((prev) => {
      // compute next rank if moving to 10 and currently unranked
      const isBecomingTen = Number(newRating) === 10;
      const maxRank = prev.reduce((max, r) => {
        return Number(r.rating) === 10 && Number.isInteger(r.ranking)
          ? Math.max(max, r.ranking)
          : max;
      }, 0);
      return prev.map((rating) => {
        if (rating.movie_entry_id !== movieEntryId) return rating;
        const next = {
          ...rating,
          rating: newRating,
          previous_rating: previousRating,
          movie_object: movie,
          updated_at: new Date().toISOString(),
        };
        if (isBecomingTen && !Number.isInteger(rating.ranking)) {
          next.ranking = maxRank + 1; // default to bottom
        }
        return next;
      });
    });
    if (user && movieEntryId) {
      try {
        await updateUserRating(user.id, movieEntryId, newRating, previousRating);
        // If becoming 10 and was unranked, persist bottom rank as well
        if (Number(newRating) === 10) {
          const current = userRatings.find(
            (r) => r.movie_entry_id === movieEntryId
          );
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
            await updateUserRanking(user.id, movieEntryId, latestMax + 1);
          }
        }
      } catch (err) {
        console.error("Failed to update rating in Supabase:", err);
      }
    }
  };

  const removeRating = (movieEntryId) => {
    setUserRatings((prev) =>
      prev.filter((rating) => rating.movie_entry_id !== movieEntryId)
    );
  };

  const updateRanking = async (movieEntryId, newRanking) => {
    // optimistic update in memory
    setUserRatings((prev) =>
      prev.map((r) =>
        r.movie_entry_id === movieEntryId ? { ...r, ranking: newRanking } : r
      )
    );
    if (user && movieEntryId) {
      try {
        await updateUserRanking(user.id, movieEntryId, newRanking);
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

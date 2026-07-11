import { createContext, useContext, useState } from "react";
import {
  getUserRatings,
  updateUserRating,
  updateUserRanking,
  updateUserRatingHistory,
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
      rating_history: [{ rating, at: new Date().toISOString() }],
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
          rating_history: [
            ...(rating.rating_history ?? []),
            { rating: newRating, at: new Date().toISOString() },
          ],
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

  // Remove one event (by index in the history array) from a rating's history.
  const deleteRatingHistoryEvent = async (movieEntryId, index) => {
    const row = userRatings.find((r) => r.movie_entry_id === movieEntryId);
    if (!row) return;
    const history = (row.rating_history ?? []).filter((_, i) => i !== index);
    setUserRatings((prev) =>
      prev.map((r) =>
        r.movie_entry_id === movieEntryId
          ? { ...r, rating_history: history }
          : r,
      ),
    );
    if (user) {
      try {
        await updateUserRatingHistory(user.id, movieEntryId, history);
      } catch (err) {
        console.error("Failed to delete rating history event:", err);
      }
    }
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
          // Mark loaded even on failure so pages gated on this flag (home,
          // magic lists) don't hang forever on one bad fetch.
          setUserRatingsLoaded(true);
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
        deleteRatingHistoryEvent,
      }}
    >
      {children}
    </UserRatingsContext.Provider>
  );
};

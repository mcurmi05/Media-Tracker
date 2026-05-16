import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  getUserBookRatings,
  createBookRating as createBookRatingService,
  updateBookRating as updateBookRatingService,
  deleteBookRating as deleteBookRatingService,
  findOrCreateBookEntry,
} from "../services/ratingsfromtable.js";
import { useAuth } from "./AuthContext.jsx";
import { isSameBook } from "./UserBookTbrContext.jsx";

/* eslint-disable react-refresh/only-export-components */

const UserBookRatingsContext = createContext();

export const useBookRatings = () => {
  const context = useContext(UserBookRatingsContext);
  if (!context) {
    throw new Error(
      "useBookRatings must be used within a UserBookRatingsProvider",
    );
  }
  return context;
};

export const UserBookRatingsProvider = ({ children }) => {
  const [bookRatings, setBookRatings] = useState([]);
  const [bookRatingsLoaded, setBookRatingsLoaded] = useState(false);
  const { user } = useAuth();
  const hasFetched = useRef(false);

  // Resolve a "book" argument (which can be a row from any table or loose form data)
  // into a book_entries id. Find-or-create the entry when only loose data is provided.
  const resolveBookId = async (book) => {
    if (!book) return null;
    if (book.book_id) return book.book_id;
    // book_entries row passed directly?
    if (book.id && !book.user_id && book.title) return book.id;
    const source = book.book_entries || book;
    const entry = await findOrCreateBookEntry(source);
    return entry?.id || null;
  };

  // Try book_id first (post-migration), otherwise fall back to title/author/
  // goodreads_link matching (handles legacy rows without book_id, or rows
  // created separately that haven't been linked yet).
  const matchesBook = (row, book) => {
    if (!row || !book) return false;
    const rId = row.book_id || row.book_entries?.id;
    const bId =
      book.book_id ||
      book.book_entries?.id ||
      (book.id && !book.user_id && book.title ? book.id : null);
    if (rId && bId && rId === bId) return true;
    return isSameBook(row.book_entries || row, book.book_entries || book);
  };

  const findRatingForBook = (book) =>
    bookRatings.find((r) => r.user_id === user?.id && matchesBook(r, book));

  const rateBook = async (book, newRating) => {
    if (!user) return;
    const isClear = newRating == null || Number(newRating) === 0;
    const existing = findRatingForBook(book);
    const bookId = existing?.book_id || (await resolveBookId(book));

    if (isClear) {
      if (existing) {
        try {
          await deleteBookRatingService(existing.id);
          setBookRatings((prev) => prev.filter((r) => r.id !== existing.id));
        } catch (err) {
          console.error("Error deleting book rating:", err);
        }
      }
      return;
    }

    if (existing) {
      // No-op if the rating value hasn't actually changed, so updated_at
      // keeps pointing at the last real change.
      if (Number(existing.book_rating) === Number(newRating)) {
        return;
      }
      try {
        const updated = await updateBookRatingService(existing.id, {
          book_rating: newRating,
          previous_rating: existing.book_rating ?? null,
          updated_at: new Date().toISOString(),
        });
        setBookRatings((prev) =>
          prev.map((r) =>
            r.id === existing.id ? { ...r, ...(updated || {}) } : r,
          ),
        );
      } catch (err) {
        console.error("Error updating book rating:", err);
      }
    } else {
      const maxRanking = bookRatings.reduce(
        (m, r) => (Number.isInteger(r.ranking) ? Math.max(m, r.ranking) : m),
        0,
      );
      try {
        const newRow = await createBookRatingService({
          user_id: user.id,
          book_id: bookId,
          book_rating: newRating,
          ranking: maxRanking + 1,
          // Ratings created from now on have a trustworthy created_at.
          accurate: true,
        });
        setBookRatings((prev) => [newRow, ...prev]);
      } catch (err) {
        console.error("Error creating book rating:", err);
      }
    }
  };

  const syncBookEntry = (bookId, updatedEntry) => {
    if (!bookId) return;
    setBookRatings((prev) =>
      prev.map((r) =>
        r.book_id === bookId
          ? { ...r, book_entries: { ...(r.book_entries || {}), ...updatedEntry } }
          : r,
      ),
    );
  };

  const updateBookRankingValue = async (ratingId, newRanking) => {
    setBookRatings((prev) =>
      prev.map((r) =>
        r.id === ratingId ? { ...r, ranking: newRanking } : r,
      ),
    );
    try {
      await updateBookRatingService(ratingId, { ranking: newRanking });
    } catch (err) {
      console.error("Error updating book ranking:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!user || hasFetched.current) return;
      try {
        hasFetched.current = true;
        const rows = await getUserBookRatings(user);

        // Backfill rankings for ratings missing a ranking
        const unranked = rows.filter((r) => r.ranking == null);
        let finalRows = rows;
        if (unranked.length > 0) {
          const maxRank = rows.reduce(
            (m, r) =>
              Number.isInteger(r.ranking) ? Math.max(m, r.ranking) : m,
            0,
          );
          const sorted = [...unranked].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
          for (let i = 0; i < sorted.length; i++) {
            const newRank = maxRank + i + 1;
            try {
              await updateBookRatingService(sorted[i].id, { ranking: newRank });
              finalRows = finalRows.map((r) =>
                r.id === sorted[i].id ? { ...r, ranking: newRank } : r,
              );
            } catch (err) {
              console.error("Error backfilling book rating ranking:", err);
            }
          }
        }

        setBookRatings(finalRows);
        setBookRatingsLoaded(true);
      } catch (err) {
        console.error("Error fetching book ratings:", err);
        setBookRatingsLoaded(true);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBookRatings([]);
      setBookRatingsLoaded(false);
      hasFetched.current = false;
    }
  }, [user]);

  return (
    <UserBookRatingsContext.Provider
      value={{
        bookRatings,
        bookRatingsLoaded,
        rateBook,
        findRatingForBook,
        updateBookRanking: updateBookRankingValue,
        syncBookEntry,
      }}
    >
      {children}
    </UserBookRatingsContext.Provider>
  );
};

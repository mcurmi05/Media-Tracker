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
  updateBookLog as updateBookLogService,
  updateBookTbr as updateBookTbrService,
} from "../services/ratingsfromtable.js";
import { useAuth } from "./AuthContext.jsx";
import { useBookLogs } from "./UserBookLogsContext.jsx";
import { useBookTbr, isSameBook } from "./UserBookTbrContext.jsx";

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
  const { bookLogs, setBookLogs } = useBookLogs();
  const { userBookTbr, updateBookTbrEntry } = useBookTbr();
  const hasFetched = useRef(false);

  const findRatingForBook = (book) =>
    bookRatings.find(
      (r) => r.user_id === user?.id && isSameBook(r, book),
    );

  // Sync the denormalized book_rating column on matching book_logs / book_tbr rows.
  const syncDenormalized = async (book, newRating) => {
    const matchingLog = bookLogs.find(
      (l) => l.user_id === user?.id && isSameBook(l, book),
    );
    if (matchingLog && matchingLog.book_rating !== newRating) {
      try {
        await updateBookLogService(matchingLog.id, {
          book_rating: newRating,
        });
        if (setBookLogs) {
          setBookLogs((prev) =>
            prev.map((l) =>
              l.id === matchingLog.id ? { ...l, book_rating: newRating } : l,
            ),
          );
        }
      } catch (err) {
        console.error("Error syncing book_logs.book_rating:", err);
      }
    }

    const matchingTbr = userBookTbr.find(
      (t) => t.user_id === user?.id && isSameBook(t, book),
    );
    if (matchingTbr && matchingTbr.book_rating !== newRating) {
      try {
        await updateBookTbrService(matchingTbr.id, {
          book_rating: newRating,
        });
        updateBookTbrEntry(matchingTbr.id, { book_rating: newRating });
      } catch (err) {
        console.error("Error syncing book_tbr.book_rating:", err);
      }
    }
  };

  const rateBook = async (book, newRating) => {
    if (!user) return;
    const isClear = newRating == null || Number(newRating) === 0;
    const existing = findRatingForBook(book);

    if (isClear) {
      if (existing) {
        try {
          await deleteBookRatingService(existing.id);
          setBookRatings((prev) => prev.filter((r) => r.id !== existing.id));
        } catch (err) {
          console.error("Error deleting book rating:", err);
        }
      }
      await syncDenormalized(book, null);
      return;
    }

    if (existing) {
      try {
        const updated = await updateBookRatingService(existing.id, {
          book_rating: newRating,
          created_at: new Date().toISOString(),
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
          book_rating: newRating,
          title: book.title || "",
          author: book.author || "",
          cover_image: book.cover_image || null,
          release_year: book.release_year
            ? Number(book.release_year) || null
            : null,
          goodreads_link: book.goodreads_link || null,
          ranking: maxRanking + 1,
        });
        setBookRatings((prev) => [newRow, ...prev]);
      } catch (err) {
        console.error("Error creating book rating:", err);
      }
    }

    await syncDenormalized(book, newRating);
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
      }}
    >
      {children}
    </UserBookRatingsContext.Provider>
  );
};

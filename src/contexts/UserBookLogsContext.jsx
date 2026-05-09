import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  getUserBookLogs,
  createBookLog as createBookLogService,
  updateBookLog as updateBookLogService,
  deleteBookLog as deleteBookLogService,
} from "../services/ratingsfromtable.js";
import { useAuth } from "./AuthContext.jsx";

/* eslint-disable react-refresh/only-export-components */

const UserBookLogsContext = createContext();

export const useBookLogs = () => {
  const context = useContext(UserBookLogsContext);
  if (!context) {
    throw new Error("useBookLogs must be used within a UserBookLogsProvider");
  }
  return context;
};

export const UserBookLogsProvider = ({ children }) => {
  const [bookLogs, setBookLogs] = useState([]);
  const [bookLogsLoaded, setBookLogsLoaded] = useState(false);
  const { user } = useAuth();
  const hasFetched = useRef(false);

  const addBookLog = (newBookLog) => {
    console.log("Adding book log to state:", newBookLog);
    setBookLogs((prev) => [newBookLog, ...prev]);
  };

  const updateBookLog = async (logId, updates) => {
    try {
      let finalUpdates = { ...updates };

      // Ranking is tied to having a rating. Stamp book_rating_date and (un)rank when rating changes.
      if (Object.prototype.hasOwnProperty.call(updates, "book_rating")) {
        const newRating = updates.book_rating;
        if (newRating == null || Number(newRating) === 0) {
          finalUpdates.book_rating_date = null;
          finalUpdates.ranking = null;
        } else {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, "0");
          const day = String(today.getDate()).padStart(2, "0");
          finalUpdates.book_rating_date = `${year}-${month}-${day}`;

          const target = bookLogs.find((b) => b.id === logId);
          if (target && target.ranking == null) {
            const maxRank = bookLogs.reduce(
              (max, b) =>
                Number.isInteger(b.ranking) ? Math.max(max, b.ranking) : max,
              0,
            );
            finalUpdates.ranking = maxRank + 1;
          }
        }
      }

      const updatedLog = await updateBookLogService(logId, finalUpdates);
      setBookLogs((prev) =>
        prev.map((log) => (log.id === logId ? { ...log, ...updatedLog } : log)),
      );
      return updatedLog;
    } catch (error) {
      console.error("Error updating book log:", error);
      throw error;
    }
  };

  const updateBookRanking = async (logId, newRanking) => {
    setBookLogs((prev) =>
      prev.map((log) =>
        log.id === logId ? { ...log, ranking: newRanking } : log,
      ),
    );
    try {
      await updateBookLogService(logId, { ranking: newRanking });
    } catch (error) {
      console.error("Error updating book ranking:", error);
    }
  };

  const createBookLog = async (bookLogData) => {
    console.log("UserBookLogsContext.createBookLog called with:", bookLogData);
    try {
      const newBookLog = await createBookLogService(bookLogData);
      console.log("Book log created, adding to state:", newBookLog);
      addBookLog(newBookLog);
      return newBookLog;
    } catch (error) {
      console.error("Error creating book log:", error);
      throw error;
    }
  };

  const deleteBookLog = async (logId) => {
    try {
      await deleteBookLogService(logId);
      setBookLogs((prev) => prev.filter((log) => log.id !== logId));
    } catch (error) {
      console.error("Error deleting book log:", error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchBookLogs = async () => {
      if (!user || hasFetched.current) return;

      try {
        hasFetched.current = true;
        const logs = await getUserBookLogs(user);

        // Ranking is tied to having a rating. Cleanup + backfill on load:
        //  - clear rankings on books without a rating
        //  - assign sequential rankings to rated books that have none
        const isRated = (b) => b.book_rating != null && Number(b.book_rating) > 0;
        const ratedBooks = logs.filter(isRated);
        const unratedRanked = logs.filter(
          (b) => !isRated(b) && b.ranking != null,
        );
        const unrankedRated = ratedBooks.filter((b) => b.ranking == null);

        let finalLogs = logs;

        for (const book of unratedRanked) {
          try {
            await updateBookLogService(book.id, { ranking: null });
            finalLogs = finalLogs.map((b) =>
              b.id === book.id ? { ...b, ranking: null } : b,
            );
          } catch (err) {
            console.error("Error clearing book ranking:", err);
          }
        }

        if (unrankedRated.length > 0) {
          const maxRank = ratedBooks.reduce(
            (max, b) =>
              Number.isInteger(b.ranking) ? Math.max(max, b.ranking) : max,
            0,
          );
          const sortedUnranked = [...unrankedRated].sort(
            (a, b) =>
              new Date(b.book_rating_date) - new Date(a.book_rating_date),
          );
          for (let i = 0; i < sortedUnranked.length; i++) {
            const newRank = maxRank + i + 1;
            try {
              await updateBookLogService(sortedUnranked[i].id, {
                ranking: newRank,
              });
              finalLogs = finalLogs.map((b) =>
                b.id === sortedUnranked[i].id ? { ...b, ranking: newRank } : b,
              );
            } catch (err) {
              console.error("Error backfilling book ranking:", err);
            }
          }
        }

        setBookLogs(finalLogs);
        setBookLogsLoaded(true);
      } catch (error) {
        console.error("Error fetching book logs:", error);
        setBookLogsLoaded(true);
      }
    };

    fetchBookLogs();
  }, [user]);

  // Reset state when user changes
  useEffect(() => {
    if (!user) {
      setBookLogs([]);
      setBookLogsLoaded(false);
      hasFetched.current = false;
    }
  }, [user]);

  return (
    <UserBookLogsContext.Provider
      value={{
        bookLogs,
        bookLogsLoaded,
        addBookLog,
        updateBookLog,
        updateBookRanking,
        createBookLog,
        deleteBookLog,
      }}
    >
      {children}
    </UserBookLogsContext.Provider>
  );
};

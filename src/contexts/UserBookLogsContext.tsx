import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  getUserBookLogs,
  createBookLog as createBookLogService,
  updateBookLog as updateBookLogService,
  deleteBookLog as deleteBookLogService,
} from "../services/ratingsfromtable";
import { useAuth } from "./AuthContext";

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
    setBookLogs((prev) => [newBookLog, ...prev]);
  };

  const updateBookLog = async (logId, updates) => {
    try {
      const updatedLog = await updateBookLogService(logId, updates);
      setBookLogs((prev) =>
        prev.map((log) => (log.id === logId ? { ...log, ...updatedLog } : log)),
      );
      return updatedLog;
    } catch (error) {
      console.error("Error updating book log:", error);
      throw error;
    }
  };

  const createBookLog = async (bookLogData) => {
    try {
      const newBookLog = await createBookLogService(bookLogData);
      addBookLog(newBookLog);
      return newBookLog;
    } catch (error) {
      console.error("Error creating book log:", error);
      throw error;
    }
  };

  const syncBookEntry = (bookId, updatedEntry) => {
    if (!bookId) return;
    setBookLogs((prev) =>
      prev.map((log) =>
        log.book_id === bookId
          ? { ...log, book_entries: { ...(log.book_entries || {}), ...updatedEntry } }
          : log,
      ),
    );
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
        setBookLogs(logs);
        setBookLogsLoaded(true);
      } catch (error) {
        console.error("Error fetching book logs:", error);
        setBookLogsLoaded(true);
      }
    };
    fetchBookLogs();
  }, [user]);

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
        setBookLogs,
        addBookLog,
        updateBookLog,
        createBookLog,
        deleteBookLog,
        syncBookEntry,
      }}
    >
      {children}
    </UserBookLogsContext.Provider>
  );
};

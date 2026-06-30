import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getUserBookTbr } from "../services/ratingsfromtable.js";
import { useAuth } from "./AuthContext.jsx";

/* eslint-disable react-refresh/only-export-components */

const UserBookTbrContext = createContext();

export const useBookTbr = () => {
  const context = useContext(UserBookTbrContext);
  if (!context) {
    throw new Error("useBookTbr must be used within a UserBookTbrProvider");
  }
  return context;
};

export const isSameBook = (a, b) => {
  if (!a || !b) return false;
  const aHardcoverId = String(a.hardcover_id || "").trim();
  const bHardcoverId = String(b.hardcover_id || "").trim();
  if (aHardcoverId && bHardcoverId) return aHardcoverId === bHardcoverId;
  const aLink = (a.goodreads_link || "").trim();
  const bLink = (b.goodreads_link || "").trim();
  if (aLink && bLink) return aLink === bLink;
  const aTitle = (a.title || "").trim().toLowerCase();
  const bTitle = (b.title || "").trim().toLowerCase();
  const aAuthor = (a.author || "").trim().toLowerCase();
  const bAuthor = (b.author || "").trim().toLowerCase();
  return !!aTitle && aTitle === bTitle && aAuthor === bAuthor;
};

export const UserBookTbrProvider = ({ children }) => {
  const [userBookTbr, setUserBookTbr] = useState([]);
  const [userBookTbrLoaded, setUserBookTbrLoaded] = useState(false);
  const { user } = useAuth();
  const hasFetched = useRef(false);

  const addBookTbr = (newEntry) => {
    setUserBookTbr((prev) => [newEntry, ...prev]);
  };

  const removeBookTbr = (tbrId) => {
    setUserBookTbr((prev) => prev.filter((item) => item.id !== tbrId));
  };

  const updateBookTbrEntry = (tbrId, updates) => {
    setUserBookTbr((prev) =>
      prev.map((item) =>
        item.id === tbrId ? { ...item, ...updates } : item,
      ),
    );
  };

  const syncBookEntry = (bookId, updatedEntry) => {
    if (!bookId) return;
    setUserBookTbr((prev) =>
      prev.map((item) =>
        item.book_id === bookId
          ? { ...item, book_entries: { ...(item.book_entries || {}), ...updatedEntry } }
          : item,
      ),
    );
  };

  useEffect(() => {
    const loadTbr = async () => {
      if (user && !hasFetched.current) {
        hasFetched.current = true;
        try {
          setUserBookTbrLoaded(false);
          const tbr = await getUserBookTbr(user);
          setUserBookTbr(tbr);
          setUserBookTbrLoaded(true);
        } catch (err) {
          setUserBookTbrLoaded(false);
          console.error(err);
        }
      }
    };
    loadTbr();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUserBookTbr([]);
      setUserBookTbrLoaded(false);
      hasFetched.current = false;
    }
  }, [user]);

  return (
    <UserBookTbrContext.Provider
      value={{
        userBookTbr,
        userBookTbrLoaded,
        addBookTbr,
        removeBookTbr,
        updateBookTbrEntry,
        syncBookEntry,
      }}
    >
      {children}
    </UserBookTbrContext.Provider>
  );
};

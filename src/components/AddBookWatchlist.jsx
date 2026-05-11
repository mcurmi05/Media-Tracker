import "../styles/AddLog.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBookTbr, isSameBook } from "../contexts/UserBookTbrContext.jsx";
import {
  createBookTbr,
  deleteBookTbr,
  findOrCreateBookEntry,
} from "../services/ratingsfromtable.js";
import { getBookInfo } from "../utils/bookInfo.js";

export default function AddBookWatchlist({ book }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { userBookTbr, addBookTbr, removeBookTbr } = useBookTbr();

  const knownBookId =
    book?.book_id ||
    book?.book_entries?.id ||
    (book?.id && book?.title && !book?.user_id ? book.id : null);

  const existing = userBookTbr.find((item) => {
    if (item.user_id !== user?.id) return false;
    if (knownBookId && item.book_id === knownBookId) return true;
    return isSameBook(getBookInfo(item), getBookInfo(book));
  });
  const onWatchlist = !!existing;

  async function onClick() {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }

    if (!onWatchlist) {
      let bookId = knownBookId;
      let entry = book?.book_entries || null;
      if (!bookId) {
        try {
          entry = await findOrCreateBookEntry(getBookInfo(book));
          bookId = entry?.id;
        } catch (err) {
          console.error("AddBookWatchlist findOrCreate failed:", err);
          return;
        }
      }

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempEntry = {
        id: tempId,
        user_id: user.id,
        book_id: bookId,
        created_at: new Date().toISOString(),
        book_entries: entry,
      };
      addBookTbr(tempEntry);
      try {
        const newEntry = await createBookTbr({
          user_id: user.id,
          book_id: bookId,
        });
        removeBookTbr(tempId);
        addBookTbr(newEntry);
      } catch (err) {
        console.error("AddBookWatchlist error:", err?.message || err, err);
        removeBookTbr(tempId);
      }
    } else {
      const toRemove = existing;
      removeBookTbr(toRemove.id);
      try {
        await deleteBookTbr(toRemove.id);
      } catch (err) {
        console.error("AddBookWatchlist error:", err?.message || err, err);
        addBookTbr(toRemove);
      }
    }
  }

  return (
    <div className="white-highlight">
      <img
        src={onWatchlist ? "/on-watchlist.png" : "/noton-watchlist.png"}
        className="addlog-icon"
        onClick={onClick}
        title={onWatchlist ? "Remove from TBR" : "Add to TBR"}
      />
    </div>
  );
}

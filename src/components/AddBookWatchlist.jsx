import "../styles/AddLog.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  useBookTbr,
  isSameBook,
} from "../contexts/UserBookTbrContext.jsx";
import {
  createBookTbr,
  deleteBookTbr,
} from "../services/ratingsfromtable.js";

export default function AddBookWatchlist({ book }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { userBookTbr, addBookTbr, removeBookTbr } = useBookTbr();

  const existing = userBookTbr.find(
    (item) => item.user_id === user?.id && isSameBook(item, book),
  );
  const onWatchlist = !!existing;

  async function onClick() {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }

    if (!onWatchlist) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempEntry = {
        id: tempId,
        user_id: user.id,
        title: book.title || "",
        author: book.author || "",
        cover_image: book.cover_image || null,
        release_year: book.release_year
          ? Number(book.release_year) || null
          : null,
        goodreads_link: book.goodreads_link || null,
        book_rating: book.book_rating ?? null,
        created_at: new Date().toISOString(),
      };
      addBookTbr(tempEntry);
      try {
        const payload = { ...tempEntry };
        delete payload.id;
        delete payload.created_at;
        const newEntry = await createBookTbr(payload);
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

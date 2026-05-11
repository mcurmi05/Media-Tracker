import "../styles/AddLog.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import { findOrCreateBookEntry } from "../services/ratingsfromtable.js";
import { getBookInfo } from "../utils/bookInfo.js";

export default function AddBookLogButton({ book }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { bookLogs, createBookLog } = useBookLogs();

  // Match by book_id when available; otherwise fall back to title+author/goodreads_link.
  const knownBookId =
    book?.book_id || book?.book_entries?.id || (book?.id && book?.title && !book?.user_id ? book.id : null);
  const alreadyLogged = bookLogs.some((log) => {
    if (log.user_id !== user?.id) return false;
    if (knownBookId && log.book_id === knownBookId) return true;
    const a = getBookInfo(log);
    const b = getBookInfo(book);
    const link = (a.goodreads_link || "").trim();
    const bLink = (b.goodreads_link || "").trim();
    if (link && bLink) return link === bLink;
    return (
      a.title.trim().toLowerCase() === b.title.trim().toLowerCase() &&
      a.author.trim().toLowerCase() === b.author.trim().toLowerCase()
    );
  });

  async function onClick() {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    try {
      let bookId = knownBookId;
      if (!bookId) {
        const entry = await findOrCreateBookEntry(getBookInfo(book));
        bookId = entry?.id;
      }
      const payload = {
        user_id: user.id,
        book_id: bookId,
      };
      await createBookLog(payload);
      navigate("/log");
    } catch (err) {
      console.error("Error creating book log:", err);
    }
  }

  return (
    <div className="white-highlight">
      <img
        src="/addlog.png"
        className="addlog-icon"
        onClick={onClick}
        title={alreadyLogged ? "Already logged - add another" : "Add to log"}
        style={{ opacity: alreadyLogged ? 0.5 : 1 }}
      />
    </div>
  );
}

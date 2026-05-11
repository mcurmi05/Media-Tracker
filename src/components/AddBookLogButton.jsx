import "../styles/AddLog.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import { isSameBook } from "../contexts/UserBookTbrContext.jsx";

export default function AddBookLogButton({ book }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { bookLogs, createBookLog } = useBookLogs();

  const alreadyLogged = bookLogs.some(
    (log) => log.user_id === user?.id && isSameBook(log, book),
  );

  async function onClick() {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    try {
      const payload = {
        user_id: user.id,
        title: book.title || "",
        author: book.author || "",
        cover_image: book.cover_image || null,
        release_year: book.release_year
          ? Number(book.release_year) || null
          : null,
        goodreads_link: book.goodreads_link || null,
        book_rating: book.book_rating ?? null,
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

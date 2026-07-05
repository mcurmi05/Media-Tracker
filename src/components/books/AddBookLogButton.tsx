import "../../styles/media/AddLog.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBookLogs } from "../../contexts/UserBookLogsContext";
import { findOrCreateBookEntry } from "../../services/ratingsfromtable";
import { getBookInfo } from "../../utils/bookInfo";
import LogModal from "../media/LogModal";

export default function AddBookLogButton({ book }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { bookLogs, createBookLog, deleteBookLog } = useBookLogs();

  const [creating, setCreating] = useState(false);
  // The freshly created book log being edited: { logId, book }.
  const [editing, setEditing] = useState(null);

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
    if (creating) return;
    setCreating(true);
    try {
      let bookId = knownBookId;
      if (!bookId) {
        const entry = await findOrCreateBookEntry(getBookInfo(book));
        bookId = entry?.id;
      }
      const today = new Date();
      const startDate = `${today.getFullYear()}-${String(
        today.getMonth() + 1,
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const newLog = await createBookLog({
        user_id: user.id,
        book_id: bookId,
        start_date: startDate,
      });
      setEditing({ logId: newLog.id, book: newLog });
    } catch (err) {
      console.error("Error creating book log:", err);
    } finally {
      setCreating(false);
    }
  }

  // Confirm: keep the log, jump to the Log page scrolled to it.
  function onConfirm() {
    const logId = editing?.logId;
    setEditing(null);
    navigate("/log", { state: { scrollToLogId: logId } });
  }

  // Cancel / click away: discard the log that was created up-front.
  async function onCancel() {
    const logId = editing?.logId;
    setEditing(null);
    if (!logId) return;
    try {
      await deleteBookLog(logId);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <div className="white-highlight">
        <img
          src="/images/addlog.png"
          className="addlog-icon"
          onClick={onClick}
          title={alreadyLogged ? "Already logged - add another" : "Add to log"}
          style={{ opacity: alreadyLogged ? 0.5 : 1 }}
        />
      </div>

      {editing && (
        <LogModal
          open={!!editing}
          book={editing.book}
          logId={editing.logId}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </>
  );
}

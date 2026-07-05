import { Check, Eye, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useLogs } from "../../contexts/UserLogsContext";
import { useBookLogs } from "../../contexts/UserBookLogsContext";
import { isSameBook } from "../../contexts/UserBookTbrContext";
import { getBookInfo } from "../../utils/bookInfo";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";

const fmt = (d) => {
  if (!d) return null;
  try {
    return format(new Date(d), "MMM d, yyyy");
  } catch {
    return null;
  }
};

// Read-only "you've watched this" indicator. Shows only when the title has at
// least one log. Click opens a popover (on this same page) listing each watch
// as an interval; a header link jumps to the Log page filtered to this title.
// Pass `movie` for movie/tv, or `book` for a book.
export default function WatchedTick({ movie, book }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userLogs } = useLogs();
  const { bookLogs } = useBookLogs();

  const isBook = !!book;

  // Collect this title's logs and turn each into a display label.
  let items = [];
  let title = "";

  if (isBook) {
    title = getBookInfo(book)?.title || book?.title || "";
    items = (bookLogs || [])
      .filter((bl) => isSameBook(bl.book_entries || bl, book))
      .sort(
        (a, b) =>
          new Date(b.end_date || b.start_date || b.created_at) -
          new Date(a.end_date || a.start_date || a.created_at),
      )
      .map((bl) => ({ id: bl.id, label: bookLabel(bl) }));
  } else {
    title = movie?.primaryTitle || "";
    const matches = (log) =>
      log.user_id === user?.id &&
      ((movie?.tmdb_id != null &&
        log.movie_object?.tmdb_id === movie.tmdb_id &&
        log.movie_object?.media_type === movie.media_type) ||
        (movie?.id && log.imdb_movie_id === movie.id));
    items = (userLogs || [])
      .filter(matches)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((log) => ({ id: log.id, label: screenLabel(log) }));
  }

  if (items.length === 0) return null;

  // A finished book reads start -> end; in progress it's "still reading".
  function bookLabel(bl) {
    if (bl.dnf) return `DNF (${fmt(bl.start_date) || "date unknown"})`;
    if (bl.end_date) {
      const s = fmt(bl.start_date);
      const e = fmt(bl.end_date);
      return s && s !== e ? `Watched: ${s} – ${e}` : `Watched: ${e}`;
    }
    return bl.start_date
      ? `Still reading (since ${fmt(bl.start_date)})`
      : "Still reading";
  }

  // A movie is a single date (or a multi-day interval); a TV log spans its
  // seasons' start/end dates. In-progress and DNF are called out.
  function screenLabel(log) {
    const seasons = Array.isArray(log.season_info) ? log.season_info : [];
    if (seasons.length > 0) {
      const starts = seasons
        .map((s) => s.start_date)
        .filter(Boolean)
        .map((d) => new Date(d));
      const ends = seasons
        .map((s) => s.end_date)
        .filter(Boolean)
        .map((d) => new Date(d));
      const start = starts.length ? new Date(Math.min(...starts)) : null;
      const end = ends.length ? new Date(Math.max(...ends)) : null;
      if (log.dnf) return `DNF (${fmt(start) || "date unknown"})`;
      if (seasons.every((s) => s.finished) && end) {
        const s = fmt(start);
        const e = fmt(end);
        return s && s !== e ? `Watched: ${s} – ${e}` : `Watched: ${e}`;
      }
      return start
        ? `Still watching (since ${fmt(start)})`
        : "Still watching";
    }
    // Movie
    if (log.dnf) return `DNF (${fmt(log.created_at) || "date unknown"})`;
    if (log.multi_day) {
      if (log.movie_end_date)
        return `Watched: ${fmt(log.created_at)} – ${fmt(log.movie_end_date)}`;
      return log.created_at
        ? `Still watching (since ${fmt(log.created_at)})`
        : "Still watching";
    }
    const d = fmt(log.created_at);
    return d ? `Watched: ${d}` : "Watched: date unknown";
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Watched"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center size-7 shrink-0 p-0 rounded-full border-0 bg-green-500/15 text-green-500 hover:bg-green-500/25 transition-colors cursor-pointer"
        >
          <Check className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <button
          type="button"
          onClick={() =>
            navigate("/log", { state: { searchTerm: title } })
          }
          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent cursor-pointer"
        >
          Go to log page
          <ArrowRight className="size-4" />
        </button>
        <div className="my-1 h-px bg-border" />
        <ul className="flex flex-col">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground"
            >
              <Eye className="size-4 shrink-0" />
              <span>{it.label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

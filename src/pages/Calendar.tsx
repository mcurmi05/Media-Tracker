import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLogs } from "../contexts/UserLogsContext";
import { useBookLogs } from "../contexts/UserBookLogsContext";
import { useCovers } from "../contexts/UserCoversContext";
import { bookDetailsRouteForBook } from "../utils/goodreads";
import { SignIn } from "./SignIn";
import Loader from "../components/layout/Loader";
import "../styles/pages/Calendar.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isTV(mo) {
  if (!mo) return false;
  const t = (mo.type || "").toLowerCase();
  const tt = (mo.titleType || "").toLowerCase();
  return t.includes("tv") || tt.includes("tv") || !!mo.episodes;
}

function stripSeries(title) {
  const m = (title || "").match(/^(.*?)\s*\(([^()]+?)[,\s]*#([^()]+?)\)\s*$/);
  return m ? m[1].trim() : title || "";
}

// Local-date key so events land on the same calendar day the rest of the app
// shows them on (mirrors the app's plain `new Date(str)` handling).
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function Calendar() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { userLogs, userLogsLoaded } = useLogs();
  const { bookLogs, bookLogsLoaded } = useBookLogs();
  const { coverForTmdb, coverForHardcover } = useCovers();

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // One event per (title, activity date): finished/watched movies, finished TV
  // seasons, and finished/started books. Grouped by local calendar day.
  const eventsByDay = useMemo(() => {
    const map = new Map();
    const push = (dateVal, ev) => {
      if (!dateVal) return;
      const d = new Date(dateVal);
      if (Number.isNaN(d.getTime())) return;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    };

    userLogs.forEach((l) => {
      const mo = l.movie_object;
      if (isTV(mo)) {
        const tvEvent = (dateVal, tag) =>
          push(dateVal, {
            cover: coverForTmdb(mo?.media_type, mo?.tmdb_id) || mo?.primaryImage,
            title: mo?.primaryTitle || "Untitled",
            tag,
            media: "tv",
            onClick: () =>
              mo?.tmdb_id != null &&
              navigate(`/mediadetails/${mo.media_type}/${mo.tmdb_id}`),
          });
        (l.season_info || []).forEach((s) => {
          if (s.start_date) tvEvent(s.start_date, `S${s.season} Start`);
          if (s.finished && s.end_date) tvEvent(s.end_date, `S${s.season} End`);
        });
      } else if (!l.date_unknown) {
        push(l.movie_end_date || l.created_at, {
          cover: coverForTmdb(mo?.media_type, mo?.tmdb_id) || mo?.primaryImage,
          title: mo?.primaryTitle || "Untitled",
          media: "movie",
          onClick: () =>
            mo?.tmdb_id != null &&
            navigate(`/mediadetails/${mo.media_type}/${mo.tmdb_id}`),
        });
      }
    });

    bookLogs.forEach((l) => {
      const be = l.book_entries;
      const bookEvent = (dateVal, tag) =>
        push(dateVal, {
          cover: coverForHardcover(be?.hardcover_id) || be?.cover_image,
          title: stripSeries(be?.title) || "Untitled",
          tag,
          media: "book",
          onClick: () => {
            const route = bookDetailsRouteForBook(be);
            if (route) navigate(route, { state: { book: be } });
          },
        });
      if (l.start_date) bookEvent(l.start_date, "Start");
      if (l.end_date) bookEvent(l.end_date, "Finished");
    });

    return map;
  }, [userLogs, bookLogs, coverForTmdb, coverForHardcover, navigate]);

  // Grid cells: leading blanks to align the 1st under its weekday, then each day.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  if (!loading && !isAuthenticated) return <SignIn />;
  if (loading || !userLogsLoaded || !bookLogsLoaded) return <Loader />;

  const today = new Date();
  const todayKey = dayKey(today);
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  const shift = (n) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="cal-page">
      <div className="cal-head">
        <h1 className="cal-month">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h1>
        <div className="cal-nav">
          <button type="button" className="cal-today" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            className="cal-arrow"
            onClick={() => shift(-1)}
            aria-label="Previous month"
          >
            <img
              src="/images/promote.png"
              alt=""
              aria-hidden="true"
              className="cal-arrow-left"
            />
          </button>
          <button
            type="button"
            className="cal-arrow"
            onClick={() => shift(1)}
            aria-label="Next month"
          >
            <img
              src="/images/promote.png"
              alt=""
              aria-hidden="true"
              className="cal-arrow-right"
            />
          </button>
        </div>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="cal-cell cal-cell-empty" />;
          const events = eventsByDay.get(dayKey(date)) || [];
          const isToday = dayKey(date) === todayKey;
          return (
            <div
              key={i}
              className={`cal-cell${isToday ? " cal-cell-today" : ""}`}
            >
              <span className="cal-daynum">{date.getDate()}</span>
              <div className="cal-events">
                {events.map((ev, j) => (
                  <button
                    key={j}
                    type="button"
                    className="cal-event"
                    title={ev.title}
                    onClick={ev.onClick}
                  >
                    <img
                      src={ev.cover || "/images/placeholderimage.jpg"}
                      alt={ev.title}
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/images/placeholderimage.jpg";
                      }}
                    />
                    {ev.tag && <span className="cal-event-tag">{ev.tag}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

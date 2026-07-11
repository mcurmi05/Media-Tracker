import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLogs } from "../contexts/UserLogsContext";
import { useBookLogs } from "../contexts/UserBookLogsContext";
import { useCovers } from "../contexts/UserCoversContext";
import { bookDetailsRouteForBook } from "../utils/goodreads";
import { SignIn } from "./SignIn";
import Loader from "../components/layout/Loader";
import "../styles/search/Toolbar.css";
import "../styles/pages/Calendar.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const VIEWS = ["year", "month", "week"];
const MEDIA_LABEL = { movie: "Movie", tv: "TV", book: "Book" };

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

// Midnight-local copy of a date, used as the week/day cursor.
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// The Sunday starting the week containing d (weeks run Sun–Sat like WEEKDAYS).
function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

// Weekday-aligned month grid: leading nulls so the 1st sits under its weekday,
// trailing nulls to complete the final row.
function monthCells(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out = [];
  for (let i = 0; i < firstWeekday; i++) out.push(null);
  for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
  while (out.length % 7 !== 0) out.push(null);
  return out;
}

export default function Calendar() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { userLogs, userLogsLoaded } = useLogs();
  const { bookLogs, bookLogsLoaded } = useBookLogs();
  const { coverForTmdb, coverForHardcover } = useCovers();

  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

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
          tag: null,
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

  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  // The 7 days of the week containing the cursor, for the week view.
  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  if (!loading && !isAuthenticated) return <SignIn />;
  if (loading || !userLogsLoaded || !bookLogsLoaded) return <Loader />;

  const today = new Date();
  const todayKey = dayKey(today);
  const goToday = () => setCursor(startOfDay(today));
  const shift = (n) =>
    setCursor((c) => {
      if (view === "year") return new Date(c.getFullYear() + n, c.getMonth(), 1);
      if (view === "week") {
        const d = new Date(c);
        d.setDate(d.getDate() + n * 7);
        return d;
      }
      return new Date(c.getFullYear(), c.getMonth() + n, 1);
    });

  const heading = (() => {
    if (view === "year") return String(cursor.getFullYear());
    if (view === "week") {
      const [a, b] = [weekDays[0], weekDays[6]];
      const left = `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}`;
      const right =
        a.getMonth() === b.getMonth()
          ? `${b.getDate()}`
          : `${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
      return `${left} – ${right}, ${b.getFullYear()}`;
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  })();

  return (
    <div className="cal-page">
      <div className="cal-head">
        <h1 className="cal-month">{heading}</h1>
        <div className="cal-nav">
          <div className="cal-views">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className={`toolbar-btn${view === v ? " toolbar-btn--active" : ""}`}
                onClick={() => setView(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="cal-today" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            className="cal-arrow"
            onClick={() => shift(-1)}
            aria-label={`Previous ${view}`}
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
            aria-label={`Next ${view}`}
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

      {view === "month" && (
        <>
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
                  <button
                    type="button"
                    className="cal-daynum"
                    title="Open week view"
                    onClick={() => {
                      setCursor(date);
                      setView("week");
                    }}
                  >
                    {date.getDate()}
                  </button>
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
        </>
      )}

      {view === "week" && (
        <div className="cal-week">
          {weekDays.map((date) => {
            const events = eventsByDay.get(dayKey(date)) || [];
            const isToday = dayKey(date) === todayKey;
            return (
              <div
                key={dayKey(date)}
                className={`cal-week-day${isToday ? " cal-week-day-today" : ""}`}
              >
                <div className="cal-week-day-head">
                  <span className="cal-week-day-name">
                    {WEEKDAYS[date.getDay()]}
                  </span>
                  <span className="cal-week-day-date">
                    {MONTHS_SHORT[date.getMonth()]} {date.getDate()}
                  </span>
                  {isToday && <span className="cal-week-today-pill">Today</span>}
                </div>
                {events.length === 0 ? (
                  <div className="cal-week-empty">Nothing logged</div>
                ) : (
                  <div className="cal-week-events">
                    {events.map((ev, j) => (
                      <button
                        key={j}
                        type="button"
                        className="cal-week-event"
                        onClick={ev.onClick}
                      >
                        <img
                          src={ev.cover || "/images/placeholderimage.jpg"}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/images/placeholderimage.jpg";
                          }}
                        />
                        <span className="cal-week-event-info">
                          <span className="cal-week-event-title">{ev.title}</span>
                          <span className="cal-week-event-meta">
                            {MEDIA_LABEL[ev.media]}
                            {ev.tag ? ` · ${ev.tag}` : ""}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "year" && (
        <div className="cal-year">
          {MONTHS.map((name, m) => {
            const year = cursor.getFullYear();
            const mCells = monthCells(year, m);
            let monthTotal = 0;
            const dayEls = mCells.map((date, i) => {
              if (!date)
                return <div key={i} className="cal-mini-day cal-mini-day-blank" />;
              const count = (eventsByDay.get(dayKey(date)) || []).length;
              monthTotal += count;
              const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : 3;
              const isToday = dayKey(date) === todayKey;
              return (
                <div
                  key={i}
                  className={`cal-mini-day cal-mini-day-l${level}${
                    isToday ? " cal-mini-day-today" : ""
                  }`}
                  title={`${MONTHS_SHORT[m]} ${date.getDate()}: ${count} ${
                    count === 1 ? "log" : "logs"
                  }`}
                />
              );
            });
            return (
              <button
                key={name}
                type="button"
                className="cal-mini-month"
                title={`Open ${name}`}
                onClick={() => {
                  setCursor(new Date(year, m, 1));
                  setView("month");
                }}
              >
                <div className="cal-mini-month-head">
                  <span className="cal-mini-month-name">{name}</span>
                  {monthTotal > 0 && (
                    <span className="cal-mini-month-count">{monthTotal}</span>
                  )}
                </div>
                <div className="cal-mini-grid">{dayEls}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

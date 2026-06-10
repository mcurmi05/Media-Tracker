import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useRatings } from "../contexts/UserRatingsContext";
import { useLogs } from "../contexts/UserLogsContext";
import { useWatchlist } from "../contexts/UserWatchlistContext";
import { useBookRatings } from "../contexts/UserBookRatingsContext";
import { useBookLogs } from "../contexts/UserBookLogsContext";
import { useBookTbr } from "../contexts/UserBookTbrContext";
import { useCache } from "../contexts/PopularMoviesCacheContext";
import { getPopularMovies, getPopularTV } from "../services/api.js";
import { SignIn } from "./SignIn.jsx";
import { bookDetailsRoute } from "../utils/goodreads.js";
import "../styles/Home/Home.css";

/* ---------- helpers ---------- */

const CURRENT_YEAR = new Date().getFullYear();

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

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const day = 86400000;
  if (diff < 0) return "soon";
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const byDateDesc = (key) => (a, b) =>
  new Date(b[key] || 0).getTime() - new Date(a[key] || 0).getTime();

// Most-recent activity date for a movie/TV log - mirrors the Log page so the
// home strips list logs in the same order they appear there.
function mostRecentLogDate(log) {
  const seasons = log.season_info;
  if (Array.isArray(seasons) && seasons.length > 0) {
    const last = seasons[seasons.length - 1];
    if (last.end_date && last.finished) return new Date(last.end_date);
    if (last.start_date) return new Date(last.start_date);
  }
  return new Date(log.created_at);
}

// Most-recent activity date for a book log - also mirrors the Log page.
function mostRecentBookLogDate(bookLog) {
  if (bookLog.end_date) return new Date(bookLog.end_date);
  if (bookLog.start_date) return new Date(bookLog.start_date);
  return new Date(bookLog.created_at);
}

// Completion date of the most-recently-finished season of a TV log, or null
// if no season was finished. Used to order DNFed series by when the user
// last actually finished a season before abandoning the show.
function lastFinishedSeasonDate(log) {
  const seasons = log.season_info;
  if (!Array.isArray(seasons)) return null;
  let latest = null;
  seasons.forEach((s) => {
    if (!s.finished) return;
    const raw = s.end_date || s.finished_at;
    if (!raw) return;
    const d = new Date(raw);
    if (!latest || d > latest) latest = d;
  });
  return latest;
}

// rank ascending (1 is best); unranked sinks to the bottom
const byRank = (a, b) =>
  (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER);

/* ---------- small presentational pieces ---------- */

function Spinner({ className = "" }) {
  return <span className={`hp-spinner ${className}`.trim()} aria-hidden="true" />;
}

function Section({ label, hint, children, panel, className = "", action }) {
  return (
    <section
      className={`hp-section${panel ? " hp-section-panel" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="hp-section-head">
        <h2>{label}</h2>
        {hint && <span className="hp-section-hint">{hint}</span>}
        {action && <div className="hp-section-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function DecadeChart({ decades, counts, max, onBarClick }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="hp-chart">
      <div className="hp-chart-bars">
        {decades.map((d, i) => {
          const active = hover === i;
          const clickable = !!onBarClick && counts[i] > 0;
          return (
            <div
              className="hp-chart-col"
              key={d}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={clickable ? () => onBarClick(d) : undefined}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              <div className="hp-bar-pair">
                {active && (
                  <div className="hp-chart-tip">
                    <div className="hp-chart-tip-head">{`${d}s`}</div>
                    <div className="hp-chart-tip-row hp-chart-tip-total">
                      <span>Titles</span>
                      <b>{counts[i]}</b>
                    </div>
                  </div>
                )}
                <div
                  className="hp-bar hp-bar-decade"
                  style={{ height: `${(counts[i] / max) * 100}%` }}
                />
              </div>
              <div className="hp-chart-x">{`${d}s`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverStrip({ tiles, empty, loading }) {
  const stripRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    // Translate vertical wheel scrolling into horizontal movement of the strip.
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
      el.removeEventListener("wheel", onWheel);
    };
  }, [updateArrows, tiles.length]);

  const scrollByDir = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    const amount = Math.max(220, el.clientWidth * 0.8);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  if (!tiles.length) {
    if (loading)
      return (
        <div className="hp-strip-loading">
          <Spinner />
        </div>
      );
    return <p className="hp-empty">{empty}</p>;
  }
  return (
    <div className="hp-strip-wrap">
      {canLeft && (
        <button
          type="button"
          className="hp-strip-arrow hp-strip-arrow-left"
          onClick={() => scrollByDir(-1)}
          aria-label="Scroll left"
        >
          {String.fromCharCode(0x2039)}
        </button>
      )}
      <div className="hp-strip" ref={stripRef}>
        {tiles.map((t, i) => (
          <div
            key={`${t.key || "x"}-${i}`}
            className="cv-tile"
            onClick={t.onClick}
            style={{ cursor: t.onClick ? "pointer" : "default" }}
          >
            <div className="cv-poster">
              <img
                src={t.cover || "/placeholderimage.jpg"}
                alt=""
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                width="108"
                height="162"
                style={{ objectFit: t.fit || "cover" }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/placeholderimage.jpg";
                }}
              />
              {t.rank != null && (
                <span className={`cv-rank cv-rank-${t.rank}`}>{t.rank}</span>
              )}
              {t.badge != null && <span className="cv-badge">{t.badge}</span>}
            </div>
            <div className="cv-title">{t.title}</div>
            {t.sub && <div className="cv-sub">{t.sub}</div>}
          </div>
        ))}
      </div>
      {canRight && (
        <button
          type="button"
          className="hp-strip-arrow hp-strip-arrow-right"
          onClick={() => scrollByDir(1)}
          aria-label="Scroll right"
        >
          {String.fromCharCode(0x203a)}
        </button>
      )}
    </div>
  );
}

/* ---------- page ---------- */

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const { userRatings, userRatingsLoaded } = useRatings();
  const { userLogs, userLogsLoaded } = useLogs();
  const { userWatchlist, userWatchlistLoaded } = useWatchlist();
  const { bookRatings, bookRatingsLoaded } = useBookRatings();
  const { bookLogs, bookLogsLoaded } = useBookLogs();
  const { userBookTbr, userBookTbrLoaded } = useBookTbr();
  const {
    popularMovies,
    popularMoviesLoaded,
    cachePopularMovies,
    popularTV,
    popularTVLoaded,
    cachePopularTV,
  } = useCache();

  useEffect(() => {
    if (popularMoviesLoaded) return;
    let cancelled = false;
    getPopularMovies().then((m) => {
      if (!cancelled && m) cachePopularMovies(m);
    });
    return () => {
      cancelled = true;
    };
  }, [popularMoviesLoaded, cachePopularMovies]);

  useEffect(() => {
    if (popularTVLoaded) return;
    let cancelled = false;
    getPopularTV().then((t) => {
      if (!cancelled && t) cachePopularTV(t);
    });
    return () => {
      cancelled = true;
    };
  }, [popularTVLoaded, cachePopularTV]);

  const [hoverRating, setHoverRating] = useState(null);

  // Whether "added to watchlist / TBR" events show in the recent-activity feed.
  // Persisted so a user who hides them during a watchlisting spree keeps it off.
  const [showListAdds, setShowListAdds] = useState(() => {
    const v = localStorage.getItem("hp-show-list-adds");
    return v === null ? false : v === "true";
  });
  useEffect(() => {
    localStorage.setItem("hp-show-list-adds", String(showListAdds));
  }, [showListAdds]);

  /* ---------- tile builders ---------- */

  const movieTile = useCallback(
    (mo, { badge, rank } = {}) => ({
      key: mo?.id,
      cover: mo?.primaryImage,
      title: mo?.primaryTitle || "Untitled",
      sub: mo?.startYear ? String(mo.startYear) : "",
      badge,
      rank,
      fit: "cover",
      onClick: () => mo?.id && navigate(`/mediadetails/${mo.id}`),
    }),
    [navigate],
  );

  // Open the Logs page with its search bar pre-filled with this title.
  const goLog = useCallback(
    (title) => () => navigate("/log", { state: { searchTerm: title || "" } }),
    [navigate],
  );

  const bookTile = useCallback(
    (be, { badge, rank } = {}) => ({
      key: be?.id,
      cover: be?.cover_image,
      title: stripSeries(be?.title) || "Untitled",
      sub: be?.author || "",
      badge,
      rank,
      fit: "contain",
      onClick: () => {
        const route = bookDetailsRoute(be?.goodreads_link);
        if (route) navigate(route, { state: { book: be } });
      },
    }),
    [navigate],
  );

  /* ---------- stats ---------- */

  const stats = useMemo(() => {
    const ratingValues = userRatings
      .map((r) => Number(r.rating))
      .filter((v) => v >= 1 && v <= 10);
    const avg = ratingValues.length
      ? (ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length).toFixed(2)
      : "-";
    const thisYear = userLogs.filter(
      (l) => new Date(l.created_at).getFullYear() === CURRENT_YEAR,
    ).length;
    return [
      {
        num: userLogs.filter((l) => !isTV(l.movie_object)).length,
        label: "Movies logged",
        onClick: () =>
          navigate("/log", { state: { mediaTypeFilter: "movies" } }),
      },
      {
        num: userLogs.filter((l) => isTV(l.movie_object)).length,
        label: "TV logged",
        onClick: () => navigate("/log", { state: { mediaTypeFilter: "tv" } }),
      },
      {
        num: bookLogs.length,
        label: "Books logged",
        onClick: () =>
          navigate("/log", { state: { mediaTypeFilter: "books" } }),
      },
      {
        num: thisYear,
        label: "Logged this year",
        onClick: () => {
          const y = new Date().getFullYear();
          navigate("/log", {
            state: {
              addedFrom: `${y}-01-01`,
              addedTo: `${y}-12-31`,
            },
          });
        },
      },
      { num: avg, label: "Avg screen rating" },
    ];
  }, [userRatings, userLogs, bookLogs, navigate]);

  /* ---------- top 4 ranked per category ---------- */

  const topMovies = useMemo(
    () =>
      userRatings
        .filter((r) => r.ranking != null && !isTV(r.movie_object))
        .sort(byRank)
        .slice(0, 4)
        .map((r, i) => movieTile(r.movie_object, { rank: i + 1 })),
    [userRatings, movieTile],
  );
  const topTV = useMemo(
    () =>
      userRatings
        .filter((r) => r.ranking != null && isTV(r.movie_object))
        .sort(byRank)
        .slice(0, 4)
        .map((r, i) => movieTile(r.movie_object, { rank: i + 1 })),
    [userRatings, movieTile],
  );
  const topBooks = useMemo(
    () =>
      bookRatings
        .filter((r) => r.ranking != null)
        .sort(byRank)
        .slice(0, 4)
        .map((r, i) => bookTile(r.book_entries, { rank: i + 1 })),
    [bookRatings, bookTile],
  );

  /* ---------- ratings distribution: all categories combined, 5..10 ---------- */

  const dist = useMemo(() => {
    const film = Array(11).fill(0);
    const tv = Array(11).fill(0);
    const book = Array(11).fill(0);
    userRatings.forEach((r) => {
      const v = Math.round(Number(r.rating));
      if (v >= 1 && v <= 10) (isTV(r.movie_object) ? tv : film)[v]++;
    });
    bookRatings.forEach((r) => {
      const v = Math.round(Number(r.book_rating));
      if (v >= 1 && v <= 10) book[v]++;
    });
    const total = film.map((f, i) => f + tv[i] + book[i]);
    const max = Math.max(1, ...total.slice(5, 11));
    return { film, tv, book, total, max };
  }, [userRatings, bookRatings]);

  /* ---------- decade breakdown: by release year, rated vs logged ---------- */

  const decades = useMemo(() => {
    const movieYear = (mo) => {
      const n = Number(mo?.startYear);
      return Number.isFinite(n) && n > 1000 ? n : null;
    };
    const bookYearOf = (be) => {
      const n = Number(be?.release_year);
      return Number.isFinite(n) && n > 1000 ? n : null;
    };
    // Build one series: drops decades with zero items, averages contributing years.
    const series = (years) => {
      const valid = years.filter((y) => y != null);
      if (!valid.length) return null;
      const counts = new Map();
      valid.forEach((y) => {
        const d = Math.floor(y / 10) * 10;
        counts.set(d, (counts.get(d) || 0) + 1);
      });
      const decadeList = [...counts.keys()].sort((a, b) => a - b);
      const list = decadeList.map((d) => counts.get(d));
      return {
        decades: decadeList,
        counts: list,
        max: Math.max(1, ...list),
        avg: Math.round(valid.reduce((s, v) => s + v, 0) / valid.length),
      };
    };

    return {
      rated: series([
        ...userRatings.map((r) => movieYear(r.movie_object)),
        ...bookRatings.map((r) => bookYearOf(r.book_entries)),
      ]),
      logged: series([
        ...userLogs.map((l) => movieYear(l.movie_object)),
        ...bookLogs.map((l) => bookYearOf(l.book_entries)),
      ]),
      watchlist: series([
        ...userWatchlist.map((w) => movieYear(w.movie_object)),
        ...userBookTbr.map((t) => bookYearOf(t.book_entries)),
      ]),
    };
  }, [userRatings, bookRatings, userLogs, bookLogs, userWatchlist, userBookTbr]);

  /* ---------- unified recent activity feed ---------- */

  const activity = useMemo(() => {
    const ev = [];
    // Open the Logs page with its search bar pre-filled with this title.
    const goLog = (title) => () =>
      navigate("/log", { state: { searchTerm: title || "" } });
    const goRatings = (title) => () =>
      navigate("/ratings", { state: { searchTerm: title || "" } });
    const goWatchlist = (title) => () =>
      navigate("/watchlist", { state: { searchTerm: title || "" } });
    userRatings.forEach((r) =>
      ev.push({
        date: r.created_at,
        type: "rate",
        media: "screen",
        prefix: "Rated",
        title: r.movie_object?.primaryTitle || "a title",
        meta: `${r.rating}`,
        onClick: goRatings(r.movie_object?.primaryTitle),
      }),
    );
    userLogs.forEach((l) => {
      const title = l.movie_object?.primaryTitle || "a title";
      const seasons = l.season_info || [];
      if (isTV(l.movie_object) && seasons.length > 0) {
        // one event per season the show was started, plus one when finished
        seasons.forEach((s) => {
          ev.push({
            date: s.start_date || s.created_at || l.created_at,
            type: "log",
            media: "screen",
            prefix: `Started watching Season ${s.season} of`,
            title,
            onClick: goLog(l.movie_object?.primaryTitle),
          });
          if (s.end_date && s.finished) {
            ev.push({
              date: s.end_date,
              type: "finish",
              media: "screen",
              prefix: `Finished watching Season ${s.season} of`,
              title,
              onClick: goLog(l.movie_object?.primaryTitle),
            });
          }
        });
      } else if (!isTV(l.movie_object) && l.multi_day) {
        ev.push({
          date: l.created_at,
          type: "log",
          media: "screen",
          prefix: "Started watching",
          title,
          onClick: goLog(l.movie_object?.primaryTitle),
        });
        if (l.movie_end_date) {
          ev.push({
            date: l.movie_end_date,
            type: "finish",
            media: "screen",
            prefix: "Finished watching",
            title,
            onClick: goLog(l.movie_object?.primaryTitle),
          });
        }
      } else {
        ev.push({
          date: l.created_at,
          type: "log",
          media: "screen",
          prefix: isTV(l.movie_object) ? "Started watching" : "Watched",
          title,
          onClick: goLog(l.movie_object?.primaryTitle),
        });
      }
    });
    userWatchlist.forEach((w) =>
      ev.push({
        date: w.created_at,
        type: "add",
        media: "screen",
        prefix: "Added",
        title: w.movie_object?.primaryTitle || "a title",
        suffix: " to watchlist",
        onClick: goWatchlist(w.movie_object?.primaryTitle),
      }),
    );
    bookRatings.forEach((r) =>
      ev.push({
        date: r.created_at,
        type: "rate",
        media: "book",
        prefix: "Rated",
        title: stripSeries(r.book_entries?.title) || "a book",
        meta: `${r.book_rating}`,
        onClick: goRatings(stripSeries(r.book_entries?.title)),
      }),
    );
    bookLogs.forEach((l) => {
      const bookTitle = stripSeries(l.book_entries?.title) || "a book";
      ev.push({
        date: l.start_date || l.created_at,
        type: "log",
        media: "book",
        prefix: "Started reading",
        title: bookTitle,
        onClick: goLog(stripSeries(l.book_entries?.title)),
      });
      if (l.end_date)
        ev.push({
          date: l.end_date,
          type: "finish",
          media: "book",
          prefix: "Finished reading",
          title: bookTitle,
          onClick: goLog(stripSeries(l.book_entries?.title)),
        });
    });
    userBookTbr.forEach((t) =>
      ev.push({
        date: t.created_at,
        type: "add",
        media: "book",
        prefix: "Added",
        title: stripSeries(t.book_entries?.title) || "a book",
        suffix: " to TBR",
        onClick: goWatchlist(stripSeries(t.book_entries?.title)),
      }),
    );
    return ev
      .filter((e) => e.date)
      .filter((e) => showListAdds || e.type !== "add")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 36);
  }, [userRatings, userLogs, userWatchlist, bookRatings, bookLogs, userBookTbr, navigate, showListAdds]);

  /* ---------- in-progress: unfinished TV seasons + unfinished books ---------- */

  const inProgress = useMemo(() => {
    const items = [];
    userLogs.forEach((l) => {
      const seasons = l.season_info || [];
      // a season counts as in-progress only if the series isn't DNFed and the
      // season itself is neither finished nor DNF
      if (
        seasons.length &&
        !l.dnf &&
        seasons.some((s) => !s.finished && !s.dnf)
      ) {
        items.push({
          ...movieTile(l.movie_object, {}),
          onClick: goLog(l.movie_object?.primaryTitle),
        });
        return;
      }
      // multi-day movie logs that haven't been finished or DNFed yet
      if (l.multi_day && !l.movie_end_date && !l.dnf)
        items.push({
          ...movieTile(l.movie_object, {}),
          onClick: goLog(l.movie_object?.primaryTitle),
        });
    });
    bookLogs
      .filter((l) => !l.end_date && !l.dnf)
      .forEach((l) =>
        items.push({
          ...bookTile(l.book_entries, {}),
          onClick: goLog(stripSeries(l.book_entries?.title)),
        }),
      );
    return items;
  }, [userLogs, bookLogs, movieTile, bookTile, goLog]);

  /* ---------- on this day: a past-year event sharing today's date ---------- */

  const onThisDay = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const d = now.getDate();
    const y = now.getFullYear();
    const hits = [];
    const check = (dateStr, build) => {
      if (!dateStr) return;
      const dt = new Date(dateStr);
      if (dt.getMonth() === m && dt.getDate() === d && dt.getFullYear() < y)
        hits.push({ dt, ...build(dt) });
    };
    userRatings.forEach((r) =>
      check(r.created_at, (dt) => ({
        cover: r.movie_object?.primaryImage,
        title: r.movie_object?.primaryTitle,
        line: `You rated this ${r.rating}/10 in ${dt.getFullYear()}`,
        fit: "cover",
        onClick: () =>
          r.movie_object?.id && navigate(`/mediadetails/${r.movie_object.id}`),
      })),
    );
    bookLogs.forEach((l) =>
      check(l.end_date, (dt) => ({
        cover: l.book_entries?.cover_image,
        title: stripSeries(l.book_entries?.title),
        line: `You finished this in ${dt.getFullYear()}`,
        fit: "contain",
        onClick: () => {
          const route = bookDetailsRoute(l.book_entries?.goodreads_link);
          if (route) navigate(route, { state: { book: l.book_entries } });
        },
      })),
    );
    hits.sort((a, b) => b.dt - a.dt);
    return hits[0] || null;
  }, [userRatings, bookLogs, navigate]);

  /* ---------- recent strips ---------- */

  const recentFilmRatings = useMemo(
    () =>
      [...userRatings]
        .filter((r) => !isTV(r.movie_object))
        .sort(byDateDesc("created_at"))
        .slice(0, 36)
        .map((r) => movieTile(r.movie_object, { badge: r.rating })),
    [userRatings, movieTile],
  );
  const recentTvRatings = useMemo(
    () =>
      [...userRatings]
        .filter((r) => isTV(r.movie_object))
        .sort(byDateDesc("created_at"))
        .slice(0, 36)
        .map((r) => movieTile(r.movie_object, { badge: r.rating })),
    [userRatings, movieTile],
  );
  const recentBookRatings = useMemo(
    () =>
      [...bookRatings]
        .sort(byDateDesc("created_at"))
        .slice(0, 36)
        .map((r) => bookTile(r.book_entries, { badge: r.book_rating })),
    [bookRatings, bookTile],
  );
  const recentFilmLogs = useMemo(
    () =>
      [...userLogs]
        .filter((l) => !isTV(l.movie_object))
        .sort((a, b) => mostRecentLogDate(b) - mostRecentLogDate(a))
        .slice(0, 36)
        .map((l) => ({
          ...movieTile(l.movie_object, {}),
          onClick: goLog(l.movie_object?.primaryTitle),
        })),
    [userLogs, movieTile, goLog],
  );
  const recentTvLogs = useMemo(
    () =>
      [...userLogs]
        .filter((l) => isTV(l.movie_object))
        .sort((a, b) => mostRecentLogDate(b) - mostRecentLogDate(a))
        .slice(0, 36)
        .map((l) => ({
          ...movieTile(l.movie_object, {}),
          onClick: goLog(l.movie_object?.primaryTitle),
        })),
    [userLogs, movieTile, goLog],
  );
  const recentBookLogs = useMemo(
    () =>
      [...bookLogs]
        .sort((a, b) => mostRecentBookLogDate(b) - mostRecentBookLogDate(a))
        .slice(0, 36)
        .map((l) => bookTile(l.book_entries, {})),
    [bookLogs, bookTile],
  );

  /* ---------- recently DNFed, per category, in Log page order ---------- */

  // A show is DNFed if the whole series was abandoned (log-level `dnf`) or any
  // individual season was marked DNF. Ordered by the last season the user
  // finished, so a show dropped after season 1 sorts by that finish date.
  const dnfTvLogs = useMemo(
    () =>
      [...userLogs]
        .filter(
          (l) =>
            isTV(l.movie_object) &&
            (l.dnf ||
              (Array.isArray(l.season_info) &&
                l.season_info.some((s) => s.dnf))),
        )
        .sort(
          (a, b) =>
            (lastFinishedSeasonDate(b) || mostRecentLogDate(b)) -
            (lastFinishedSeasonDate(a) || mostRecentLogDate(a)),
        )
        .slice(0, 12)
        .map((l) => ({
          ...movieTile(l.movie_object, {}),
          onClick: goLog(l.movie_object?.primaryTitle),
        })),
    [userLogs, movieTile, goLog],
  );
  const dnfBookLogs = useMemo(
    () =>
      [...bookLogs]
        .filter((l) => l.dnf)
        .sort((a, b) => mostRecentBookLogDate(b) - mostRecentBookLogDate(a))
        .slice(0, 12)
        .map((l) => bookTile(l.book_entries, {})),
    [bookLogs, bookTile],
  );
  const recentWatchlist = useMemo(
    () =>
      [...userWatchlist]
        .sort(byDateDesc("created_at"))
        .slice(0, 36)
        .map((w) => movieTile(w.movie_object, {})),
    [userWatchlist, movieTile],
  );
  const newSeasonShows = useMemo(
    () =>
      userWatchlist
        .filter((w) => w.new_season_to_watch)
        .sort(byDateDesc("created_at"))
        .map((w) => movieTile(w.movie_object, {})),
    [userWatchlist, movieTile],
  );
  const recentTbr = useMemo(
    () =>
      [...userBookTbr]
        .sort(byDateDesc("created_at"))
        .slice(0, 36)
        .map((t) => bookTile(t.book_entries, {})),
    [userBookTbr, bookTile],
  );

  const trendingMovies = useMemo(
    () => (popularMovies || []).slice(0, 10).map((m) => movieTile(m)),
    [popularMovies, movieTile],
  );
  const trendingTV = useMemo(
    () => (popularTV || []).slice(0, 10).map((m) => movieTile(m)),
    [popularTV, movieTile],
  );

  /* ---------- render ---------- */

  const displayName =
    (user?.email || "").split("@")[0] || (isAuthenticated ? "there" : "");

  // Signed-out visitors get the sign-in screen instead of an empty library.
  if (!loading && !isAuthenticated) {
    return <SignIn />;
  }

  // Hold the whole page back until every library context has loaded, so the
  // user never sees a half-built page where (e.g.) only the book strips have
  // populated while the movie/TV data is still in flight.
  const libraryReady =
    userRatingsLoaded &&
    userLogsLoaded &&
    userWatchlistLoaded &&
    bookRatingsLoaded &&
    bookLogsLoaded &&
    userBookTbrLoaded;

  if (loading || !libraryReady) {
    return (
      <div className="home-page hp-page-loading">
        <Spinner className="hp-spinner-lg" />
      </div>
    );
  }

  return (
    <div className="home-page">
      <header className="hp-header">
        <div className="hp-avatar">{(displayName[0] || "?").toUpperCase()}</div>
        <div>
          <div className="hp-hello">
            {isAuthenticated ? `Welcome back, ${displayName}` : "Your Library"}
          </div>
          <div className="hp-subhello">
            {isAuthenticated
              ? "Here's everything you've been watching and reading."
              : "Sign in to track your movies, shows and books."}
          </div>
        </div>
      </header>

      {/* stats strip */}
      <div className="hp-stats">
        {stats.map((s) => (
          <div
            className="hp-stat"
            key={s.label}
            onClick={s.onClick}
            style={{ cursor: s.onClick ? "pointer" : "default" }}
          >
            <div className="hp-stat-num">{s.num}</div>
            <div className="hp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="hp-two-col">
        <div className="hp-col-left">
          {/* currently watching / reading */}
          {inProgress.length > 0 && (
            <Section label="Currently Watching & Reading" panel>
              <CoverStrip tiles={inProgress} empty="" />
            </Section>
          )}
          {/* trending movies + tv strips */}
          <Section label="What's Trending?" panel>
            <div className="hp-sub-label">Movies</div>
            <CoverStrip
              tiles={trendingMovies}
              loading={!popularMoviesLoaded}
              empty="No trending movies."
            />
            <div className="hp-sub-label">TV Shows</div>
            <CoverStrip
              tiles={trendingTV}
              loading={!popularTVLoaded}
              empty="No trending TV."
            />
          </Section>
          {/* top 4 ranked */}
          <Section label="4 Favourites" panel>
        <div className="hp-sub-label">Movies</div>
        <CoverStrip
          tiles={topMovies}
          empty="Rank your movies on the Ratings page to fill this in."
        />
        <div className="hp-sub-label">TV Shows</div>
        <CoverStrip
          tiles={topTV}
          empty="Rank your shows on the Ratings page to fill this in."
        />
        <div className="hp-sub-label">Books</div>
        <CoverStrip
          tiles={topBooks}
          empty="Rank your books on the Ratings page to fill this in."
        />
      </Section>
        </div>

        <div className="hp-col-right">
          {/* recent activity feed */}
          <Section
            label="Recent Activity"
            action={
              <button
                type="button"
                className={`hp-toggle${showListAdds ? " hp-toggle-on" : ""}`}
                onClick={() => setShowListAdds((v) => !v)}
                aria-pressed={showListAdds}
                title={
                  showListAdds
                    ? "Hide watchlist additions"
                    : "Show watchlist additions"
                }
              >
                <span className="hp-toggle-box">
                  {showListAdds && (
                    <svg
                      className="hp-toggle-tick"
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 6.2l2.3 2.3 4.7-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="hp-toggle-label">Show watchlist additions</span>
              </button>
            }
          >
        <ul className="hp-feed">
          {activity.length === 0 ? (
            <li className="hp-feed-empty">Nothing logged yet.</li>
          ) : (
            activity.map((e, i) => (
              <li
                key={i}
                className="hp-feed-item"
                onClick={e.onClick}
                style={{ cursor: e.onClick ? "pointer" : "default" }}
              >
                <img
                  className="hp-feed-media-icon"
                  src={e.media === "book" ? "/book.png" : "/movie.png"}
                  alt={e.media === "book" ? "Book" : "Movie/TV"}
                />
                <img
                  className="hp-feed-media-icon"
                  src={
                    e.type === "rate"
                      ? "/ratings.png"
                      : e.type === "add"
                        ? "/watchlist-navbar.png"
                        : "/log.png"
                  }
                  alt={e.type}
                />
                <span className="hp-feed-body">
                  <span className="hp-feed-text">
                    {e.prefix} <strong>{e.title}</strong>
                    {e.suffix || ""}
                  </span>
                  {e.meta && <span className="hp-feed-rating">{e.meta}</span>}
                </span>
                <span className="hp-feed-date">{timeAgo(e.date)}</span>
              </li>
            ))
          )}
        </ul>
      </Section>

      {/* ratings distribution */}
      <Section label="Ratings Distribution">
        <div className="hp-chart">
          <div className="hp-chart-bars">
            {[5, 6, 7, 8, 9, 10].map((rating) => {
              const total = dist.total[rating];
              const active = hoverRating === rating;
              // 5 = red, 10 = green, through yellow in between
              const hue = ((rating - 5) / 5) * 120;
              const clickable = total > 0;
              return (
                <div
                  className="hp-chart-col"
                  key={rating}
                  onMouseEnter={() => setHoverRating(rating)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={
                    clickable
                      ? () =>
                          navigate("/ratings", {
                            state: { ratingFilter: String(rating) },
                          })
                      : undefined
                  }
                  style={{ cursor: clickable ? "pointer" : "default" }}
                >
                  <div className="hp-bar-pair">
                    {active && (
                      <div className="hp-chart-tip">
                        <div className="hp-chart-tip-head">
                          Rated {rating}
                        </div>
                        <div className="hp-chart-tip-row">
                          <span>Movies</span>
                          <b>{dist.film[rating]}</b>
                        </div>
                        <div className="hp-chart-tip-row">
                          <span>TV</span>
                          <b>{dist.tv[rating]}</b>
                        </div>
                        <div className="hp-chart-tip-row">
                          <span>Books</span>
                          <b>{dist.book[rating]}</b>
                        </div>
                        <div className="hp-chart-tip-row hp-chart-tip-total">
                          <span>Total</span>
                          <b>{total}</b>
                        </div>
                      </div>
                    )}
                    <div
                      className="hp-bar hp-bar-all"
                      style={{
                        height: `${(total / dist.max) * 100}%`,
                        background: active
                          ? `hsl(${hue}, 70%, 58%)`
                          : `hsl(${hue}, 65%, 48%)`,
                      }}
                    />
                  </div>
                  <div className="hp-chart-x">{rating}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* decade breakdown */}
      <Section
        label="Decade Breakdown"
        hint="by release year"
        panel
        className="hp-section-decades"
      >
        <div className="hp-decades-body">
        {!(decades.rated || decades.logged || decades.watchlist) && (
          <div className="hp-empty">No decade data yet.</div>
        )}
        {decades.rated && (
          <>
            <div className="hp-sub-label">
              Rated
              <span className="hp-avg-pill">avg {decades.rated.avg}</span>
            </div>
            <DecadeChart
              decades={decades.rated.decades}
              counts={decades.rated.counts}
              max={decades.rated.max}
              onBarClick={(d) =>
                navigate("/ratings", {
                  state: { yearFrom: String(d), yearTo: String(d + 9) },
                })
              }
            />
          </>
        )}
        {decades.logged && (
          <>
            <div className="hp-sub-label">
              Logged
              <span className="hp-avg-pill">avg {decades.logged.avg}</span>
            </div>
            <DecadeChart
              decades={decades.logged.decades}
              counts={decades.logged.counts}
              max={decades.logged.max}
              onBarClick={(d) =>
                navigate("/log", {
                  state: { yearFrom: String(d), yearTo: String(d + 9) },
                })
              }
            />
          </>
        )}
        {decades.watchlist && (
          <>
            <div className="hp-sub-label">
              On Watchlist
              <span className="hp-avg-pill">avg {decades.watchlist.avg}</span>
            </div>
            <DecadeChart
              decades={decades.watchlist.decades}
              counts={decades.watchlist.counts}
              max={decades.watchlist.max}
              onBarClick={(d) =>
                navigate("/watchlist", {
                  state: { yearFrom: String(d), yearTo: String(d + 9) },
                })
              }
            />
          </>
        )}
        </div>
      </Section>
        </div>
      </div>

      {/* recent logs */}
      <Section label="Recent Logs" panel>
        <div className="hp-sub-label">Movies</div>
        <CoverStrip tiles={recentFilmLogs} empty="No movie logs yet." />
        <div className="hp-sub-label">TV Shows</div>
        <CoverStrip tiles={recentTvLogs} empty="No TV logs yet." />
        <div className="hp-sub-label">Books</div>
        <CoverStrip tiles={recentBookLogs} empty="No book logs yet." />
      </Section>

      {/* recent ratings */}
      <Section label="Recent Ratings" panel>
        <div className="hp-sub-label">Movies</div>
        <CoverStrip tiles={recentFilmRatings} empty="No movie ratings yet." />
        <div className="hp-sub-label">TV Shows</div>
        <CoverStrip tiles={recentTvRatings} empty="No TV ratings yet." />
        <div className="hp-sub-label">Books</div>
        <CoverStrip tiles={recentBookRatings} empty="No book ratings yet." />
      </Section>

      {/* recently added to watchlist + TBR */}
      <Section label="Recently Added to Watchlist & TBR" panel>
        <div className="hp-sub-label">Watchlist</div>
        <CoverStrip tiles={recentWatchlist} empty="Watchlist is empty." />
        <div className="hp-sub-label">TBR</div>
        <CoverStrip tiles={recentTbr} empty="TBR is empty." />
      </Section>

      {/* on this day */}
      {onThisDay && (
        <Section label="On This Day">
          <div
            className="hp-otd"
            onClick={onThisDay.onClick}
            style={{ cursor: onThisDay.onClick ? "pointer" : "default" }}
          >
            <div className="hp-otd-poster">
              <img
                src={onThisDay.cover || "/placeholderimage.jpg"}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ objectFit: onThisDay.fit }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/placeholderimage.jpg";
                }}
              />
            </div>
            <div className="hp-otd-text">
              <div className="hp-otd-title">{onThisDay.title}</div>
              <div className="hp-otd-line">{onThisDay.line}</div>
            </div>
          </div>
        </Section>
      )}

      {/* shows with a new season marked on the watchlist */}
      {newSeasonShows.length > 0 && (
        <Section label="New Seasons To Watch/Released/Coming Soon" panel>
          <CoverStrip tiles={newSeasonShows} empty="" />
        </Section>
      )}

      {/* recently DNFed */}
      {(dnfTvLogs.length > 0 || dnfBookLogs.length > 0) && (
        <Section
          panel
          label={
            <>
              Recent <span className="hp-dnf-badge">DNFS</span>
            </>
          }
        >
          <div className="hp-sub-label">TV Shows</div>
          <CoverStrip tiles={dnfTvLogs} empty="No DNFed TV shows." />
          <div className="hp-sub-label">Books</div>
          <CoverStrip tiles={dnfBookLogs} empty="No DNFed books." />
        </Section>
      )}
    </div>
  );
}

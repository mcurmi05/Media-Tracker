import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useRatings } from "../contexts/UserRatingsContext";
import { useLogs } from "../contexts/UserLogsContext";
import { useWatchlist } from "../contexts/UserWatchlistContext";
import { useBookRatings } from "../contexts/UserBookRatingsContext";
import { useBookLogs } from "../contexts/UserBookLogsContext";
import { useBookTbr } from "../contexts/UserBookTbrContext";
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

// rank ascending (1 is best); unranked sinks to the bottom
const byRank = (a, b) =>
  (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER);

/* ---------- small presentational pieces ---------- */

function Section({ label, hint, children }) {
  return (
    <section className="hp-section">
      <div className="hp-section-head">
        <h2>{label}</h2>
        {hint && <span className="hp-section-hint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function CoverStrip({ tiles, empty }) {
  if (!tiles.length) return <p className="hp-empty">{empty}</p>;
  return (
    <div className="hp-strip">
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
  );
}

/* ---------- page ---------- */

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { userRatings } = useRatings();
  const { userLogs } = useLogs();
  const { userWatchlist } = useWatchlist();
  const { bookRatings } = useBookRatings();
  const { bookLogs } = useBookLogs();
  const { userBookTbr } = useBookTbr();

  const [hoverRating, setHoverRating] = useState(null);

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

  const bookTile = useCallback(
    (be, { badge, rank } = {}) => ({
      key: be?.id,
      cover: be?.cover_image,
      title: stripSeries(be?.title) || "Untitled",
      sub: be?.author || "",
      badge,
      rank,
      fit: "contain",
      onClick: () =>
        be?.goodreads_link &&
        window.open(be.goodreads_link, "_blank", "noopener,noreferrer"),
    }),
    [],
  );

  /* ---------- stats ---------- */

  const stats = useMemo(() => {
    const ratingValues = userRatings
      .map((r) => Number(r.rating))
      .filter((v) => v >= 1 && v <= 10);
    const avg = ratingValues.length
      ? (ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length).toFixed(1)
      : "-";
    const thisYear = userLogs.filter(
      (l) => new Date(l.created_at).getFullYear() === CURRENT_YEAR,
    ).length;
    const perfect =
      userRatings.filter((r) => Number(r.rating) === 10).length +
      bookRatings.filter((r) => Number(r.book_rating) === 10).length;
    return [
      {
        num: userLogs.filter((l) => !isTV(l.movie_object)).length,
        label: "Films logged",
      },
      {
        num: userLogs.filter((l) => isTV(l.movie_object)).length,
        label: "TV logged",
      },
      { num: bookLogs.length, label: "Books logged" },
      { num: avg, label: "Avg screen rating" },
      { num: thisYear, label: "Logged this year" },
      { num: perfect, label: "Perfect 10s" },
    ];
  }, [userRatings, userLogs, bookRatings, bookLogs]);

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

  /* ---------- unified recent activity feed ---------- */

  const activity = useMemo(() => {
    const ev = [];
    const goMovie = (id) => () => id && navigate(`/mediadetails/${id}`);
    // Open the Logs page with its search bar pre-filled with this title.
    const goLog = (title) => () =>
      navigate("/log", { state: { searchTerm: title || "" } });
    userRatings.forEach((r) =>
      ev.push({
        date: r.created_at,
        type: "rate",
        text: `Rated ${r.movie_object?.primaryTitle || "a title"}`,
        meta: `${r.rating}`,
        onClick: goMovie(r.movie_object?.id),
      }),
    );
    userLogs.forEach((l) => {
      const title = l.movie_object?.primaryTitle || "a title";
      const seasons = l.season_info || [];
      if (isTV(l.movie_object) && seasons.length > 0) {
        // one event per season the show was started
        seasons.forEach((s) =>
          ev.push({
            date: s.start_date || s.created_at || l.created_at,
            type: "log",
            text: `Started watching Season ${s.season} of ${title}`,
            onClick: goLog(l.movie_object?.primaryTitle),
          }),
        );
      } else {
        ev.push({
          date: l.created_at,
          type: "log",
          text: isTV(l.movie_object)
            ? `Started watching ${title}`
            : `Logged ${title}`,
          onClick: goLog(l.movie_object?.primaryTitle),
        });
      }
    });
    userWatchlist.forEach((w) =>
      ev.push({
        date: w.created_at,
        type: "add",
        text: `Added ${w.movie_object?.primaryTitle || "a title"} to watchlist`,
        onClick: goMovie(w.movie_object?.id),
      }),
    );
    bookRatings.forEach((r) =>
      ev.push({
        date: r.created_at,
        type: "rate",
        text: `Rated ${stripSeries(r.book_entries?.title) || "a book"}`,
        meta: `${r.book_rating}`,
      }),
    );
    bookLogs.forEach((l) => {
      const bookTitle = stripSeries(l.book_entries?.title) || "a book";
      ev.push({
        date: l.start_date || l.created_at,
        type: "log",
        text: `Started reading ${bookTitle}`,
        onClick: goLog(stripSeries(l.book_entries?.title)),
      });
      if (l.end_date)
        ev.push({
          date: l.end_date,
          type: "finish",
          text: `Finished reading ${bookTitle}`,
          onClick: goLog(stripSeries(l.book_entries?.title)),
        });
    });
    userBookTbr.forEach((t) =>
      ev.push({
        date: t.created_at,
        type: "add",
        text: `Added ${stripSeries(t.book_entries?.title) || "a book"} to TBR`,
      }),
    );
    return ev
      .filter((e) => e.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 36);
  }, [userRatings, userLogs, userWatchlist, bookRatings, bookLogs, userBookTbr, navigate]);

  /* ---------- in-progress: unfinished TV seasons + unfinished books ---------- */

  const inProgress = useMemo(() => {
    const items = [];
    userLogs.forEach((l) => {
      const seasons = l.season_info || [];
      // a season counts as in-progress only if not finished and not DNF
      if (seasons.length && seasons.some((s) => !s.finished && !s.dnf))
        items.push(
          movieTile(l.movie_object, {}),
        );
    });
    bookLogs
      .filter((l) => !l.end_date && !l.dnf)
      .forEach((l) => items.push(bookTile(l.book_entries, {})));
    return items;
  }, [userLogs, bookLogs, movieTile, bookTile]);

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
        onClick: () =>
          l.book_entries?.goodreads_link &&
          window.open(l.book_entries.goodreads_link, "_blank", "noopener,noreferrer"),
      })),
    );
    hits.sort((a, b) => b.dt - a.dt);
    return hits[0] || null;
  }, [userRatings, bookLogs, navigate]);

  /* ---------- genre breakdown (screen only) ---------- */

  const genres = useMemo(() => {
    const seen = new Map();
    [...userRatings, ...userLogs].forEach((x) => {
      const mo = x.movie_object;
      const id = mo?.id || x.imdb_movie_id;
      if (id && mo && !seen.has(id)) seen.set(id, mo);
    });
    const counts = {};
    seen.forEach((mo) => {
      (mo.interests || []).forEach((g) => {
        counts[g] = (counts[g] || 0) + 1;
      });
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const max = sorted.length ? sorted[0][1] : 1;
    return { sorted, max };
  }, [userRatings, userLogs]);

  /* ---------- recent strips ---------- */

  const recentFilmRatings = useMemo(
    () =>
      [...userRatings]
        .filter((r) => !isTV(r.movie_object))
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((r) => movieTile(r.movie_object, { badge: r.rating })),
    [userRatings, movieTile],
  );
  const recentTvRatings = useMemo(
    () =>
      [...userRatings]
        .filter((r) => isTV(r.movie_object))
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((r) => movieTile(r.movie_object, { badge: r.rating })),
    [userRatings, movieTile],
  );
  const recentBookRatings = useMemo(
    () =>
      [...bookRatings]
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((r) => bookTile(r.book_entries, { badge: r.book_rating })),
    [bookRatings, bookTile],
  );
  const recentFilmLogs = useMemo(
    () =>
      [...userLogs]
        .filter((l) => !isTV(l.movie_object))
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((l) => movieTile(l.movie_object, {})),
    [userLogs, movieTile],
  );
  const recentTvLogs = useMemo(
    () =>
      [...userLogs]
        .filter((l) => isTV(l.movie_object))
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((l) => movieTile(l.movie_object, {})),
    [userLogs, movieTile],
  );
  const recentBookLogs = useMemo(
    () =>
      [...bookLogs]
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((l) => bookTile(l.book_entries, {})),
    [bookLogs, bookTile],
  );
  const recentWatchlist = useMemo(
    () =>
      [...userWatchlist]
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((w) => movieTile(w.movie_object, {})),
    [userWatchlist, movieTile],
  );
  const recentTbr = useMemo(
    () =>
      [...userBookTbr]
        .sort(byDateDesc("created_at"))
        .slice(0, 12)
        .map((t) => bookTile(t.book_entries, {})),
    [userBookTbr, bookTile],
  );

  /* ---------- render ---------- */

  const displayName =
    (user?.email || "").split("@")[0] || (isAuthenticated ? "there" : "");

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
              : "Sign in to track your films, shows and books."}
          </div>
        </div>
      </header>

      {/* stats strip */}
      <div className="hp-stats">
        {stats.map((s) => (
          <div className="hp-stat" key={s.label}>
            <div className="hp-stat-num">{s.num}</div>
            <div className="hp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="hp-two-col">
        <div className="hp-col-left">
          {/* top 4 ranked */}
          <Section label="4 Favourites">
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
          {/* ratings distribution */}
          <Section label="Ratings Distribution">
        <div className="hp-chart">
          <div className="hp-chart-bars">
            {[5, 6, 7, 8, 9, 10].map((rating) => {
              const total = dist.total[rating];
              const active = hoverRating === rating;
              // 5 = red, 10 = green, through yellow in between
              const hue = ((rating - 5) / 5) * 120;
              return (
                <div
                  className="hp-chart-col"
                  key={rating}
                  onMouseEnter={() => setHoverRating(rating)}
                  onMouseLeave={() => setHoverRating(null)}
                >
                  <div className="hp-bar-pair">
                    {active && (
                      <div className="hp-chart-tip">
                        <div className="hp-chart-tip-head">
                          Rated {rating}
                        </div>
                        <div className="hp-chart-tip-row">
                          <span>
                            <i className="hp-dot hp-dot-film" /> Films
                          </span>
                          <b>{dist.film[rating]}</b>
                        </div>
                        <div className="hp-chart-tip-row">
                          <span>
                            <i className="hp-dot hp-dot-tv" /> TV
                          </span>
                          <b>{dist.tv[rating]}</b>
                        </div>
                        <div className="hp-chart-tip-row">
                          <span>
                            <i className="hp-dot hp-dot-book" /> Books
                          </span>
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

      {/* recent activity feed */}
      <Section label="Recent Activity">
        {activity.length === 0 ? (
          <p className="hp-empty">Nothing logged yet.</p>
        ) : (
          <ul className="hp-feed">
            {activity.map((e, i) => (
              <li
                key={i}
                className="hp-feed-item"
                onClick={e.onClick}
                style={{ cursor: e.onClick ? "pointer" : "default" }}
              >
                <span className={`hp-feed-dot hp-feed-dot-${e.type}`} />
                <span className="hp-feed-body">
                  <span className="hp-feed-text">{e.text}</span>
                  {e.meta && <span className="hp-feed-rating">{e.meta}</span>}
                </span>
                <span className="hp-feed-date">{timeAgo(e.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
        </div>
      </div>

      {/* currently watching / reading */}
      {inProgress.length > 0 && (
        <Section label="Currently Watching & Reading">
          <CoverStrip tiles={inProgress} empty="" />
        </Section>
      )}

      {/* recent logs */}
      <Section label="Recent Logs">
        <div className="hp-sub-label">Films</div>
        <CoverStrip tiles={recentFilmLogs} empty="No film logs yet." />
        <div className="hp-sub-label">TV Shows</div>
        <CoverStrip tiles={recentTvLogs} empty="No TV logs yet." />
        <div className="hp-sub-label">Books</div>
        <CoverStrip tiles={recentBookLogs} empty="No book logs yet." />
      </Section>

      {/* recent ratings */}
      <Section label="Recent Ratings">
        <div className="hp-sub-label">Films</div>
        <CoverStrip tiles={recentFilmRatings} empty="No film ratings yet." />
        <div className="hp-sub-label">TV Shows</div>
        <CoverStrip tiles={recentTvRatings} empty="No TV ratings yet." />
        <div className="hp-sub-label">Books</div>
        <CoverStrip tiles={recentBookRatings} empty="No book ratings yet." />
      </Section>

      {/* recent watchlist / tbr */}
      <Section label="Recently Added">
        <div className="hp-sub-label">Watchlist</div>
        <CoverStrip tiles={recentWatchlist} empty="Watchlist is empty." />
        <div className="hp-sub-label">To Be Read</div>
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

      {/* genre breakdown */}
      {genres.sorted.length > 0 && (
        <Section label="Most-Watched Genres" hint="films & TV">
          <div className="hp-genres">
            {genres.sorted.map(([name, count]) => (
              <div className="hp-genre-row" key={name}>
                <span className="hp-genre-name">{name}</span>
                <span className="hp-genre-track">
                  <span
                    className="hp-genre-fill"
                    style={{ width: `${(count / genres.max) * 100}%` }}
                  />
                </span>
                <span className="hp-genre-count">{count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

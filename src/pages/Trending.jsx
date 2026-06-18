import { useState, useEffect, useMemo, useRef } from "react";
import { getPopularMovies, getPopularTV } from "../services/api.js";
import { useCache } from "../contexts/PopularMoviesCacheContext";
import { useImdbRating, useImdbRatings } from "../contexts/ImdbRatingsContext";
import { useNavigate } from "react-router-dom";
import "../styles/Trending.css";
import "../styles/Toolbar.css";
import Loader from "../components/Loader.jsx";
import ExtraFiltersPanel from "../components/ExtraFiltersPanel.jsx";
import ReleaseYearFilter from "../components/ReleaseYearFilter.jsx";
import SortByMenu from "../components/SortByMenu.jsx";
import { yearInRange, compareNums } from "../utils/mediaFilters.js";
import { makeNavHandlers } from "../utils/navClick.js";

const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "imdb", label: "IMDb Rating" },
  { value: "imdbVotes", label: "IMDb Votes" },
  { value: "year", label: "Release Date" },
];

const yearOf = (mo) => {
  const y = Number(mo?.startYear);
  return Number.isFinite(y) && y > 0 ? y : null;
};

// compact vote count, e.g. 1234567 -> "1.2M", 12000 -> "12K"
const formatVotes = (v) => {
  if (!v) return null;
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return Math.round(v / 1000) + "K";
  return String(v);
};

// Drive the press/sink via pointer events instead of CSS :active. On mobile a
// quick tap often navigates before an :active frame paints; pointerdown fires
// immediately on touch, so the sink is reliably shown.
//
// To avoid pressing during a scroll/swipe, we record where the touch started
// and drop the press as soon as the finger moves past a small threshold — a
// tap stays still and keeps the press, a swipe moves and loses it.
const PRESS_MOVE_TOLERANCE = 8; // px
const PRESS_HANDLERS = {
  onPointerDown: (e) => {
    const el = e.currentTarget;
    el._pressX = e.clientX;
    el._pressY = e.clientY;
    el.classList.add("is-pressed");
  },
  onPointerMove: (e) => {
    const el = e.currentTarget;
    if (!el.classList.contains("is-pressed")) return;
    const dx = e.clientX - (el._pressX ?? e.clientX);
    const dy = e.clientY - (el._pressY ?? e.clientY);
    if (dx * dx + dy * dy > PRESS_MOVE_TOLERANCE * PRESS_MOVE_TOLERANCE) {
      el.classList.remove("is-pressed");
    }
  },
  onPointerUp: (e) => e.currentTarget.classList.remove("is-pressed"),
  onPointerCancel: (e) => e.currentTarget.classList.remove("is-pressed"),
  onPointerLeave: (e) => e.currentTarget.classList.remove("is-pressed"),
};

// Compact live IMDb rating badge. Renders nothing until/unless the title has a
// rating in the daily-synced dataset (resolved via its tconst, movie.id).
function TrendingRating({ movie }) {
  const hasId = !!movie?.id;
  const live = useImdbRating(hasId ? movie.id : undefined);
  const loading = hasId && live === undefined;
  const rating = live?.rating;
  const votes = formatVotes(live?.votes);
  if (rating != null) {
    return (
      <span className="trending-imdb">
        <img src="/imdbicon.png" alt="IMDb" className="trending-imdb-logo" />
        <img src="/staricon.png" alt="" className="trending-imdb-star" />
        {Number(rating).toFixed(1)}
        {votes ? ` (${votes})` : null}
      </span>
    );
  }
  // Wait for the batched lookup to resolve before declaring it has no rating.
  if (loading) return null;
  return (
    <span className="trending-imdb trending-imdb--none">
      <img src="/imdbicon.png" alt="IMDb" className="trending-imdb-logo" />
      No rating yet
    </span>
  );
}

function Trending() {
  const {
    popularMovies,
    popularMoviesLoaded,
    cachePopularMovies,
    popularTV,
    popularTVLoaded,
    cachePopularTV,
  } = useCache();
  const { ratings: imdbRatings } = useImdbRatings();

  const navigate = useNavigate();

  const getInitialMediaType = () => {
    const saved = localStorage.getItem("trendingMediaType");
    return saved === "tv" ? "tv" : "movies";
  };

  const [mediaType, setMediaType] = useState(getInitialMediaType);
  const [error, setError] = useState(null);

  // filter + sort state (mirrors the ratings/watchlist/log toolbars)
  const [genreFilter, setGenreFilter] = useState("all");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortKey, setSortKey] = useState("trending");
  const [sortDir, setSortDir] = useState("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // always-current sortKey, so the sort handler never reads a stale closure
  const sortKeyRef = useRef(sortKey);
  sortKeyRef.current = sortKey;

  useEffect(() => {
    localStorage.setItem("trendingMediaType", mediaType);
  }, [mediaType]);

  useEffect(() => {
    let cancelled = false;
    const fetchType = async (type) => {
      const alreadyLoaded = type === "movies" ? popularMoviesLoaded : popularTVLoaded;
      if (alreadyLoaded) return;
      try {
        const data = type === "movies" ? await getPopularMovies() : await getPopularTV();
        if (cancelled) return;
        type === "movies" ? cachePopularMovies(data) : cachePopularTV(data);
      } catch (err) {
        if (!cancelled) setError(`Failed to load ${type}: ${err}`);
      }
    };

    const other = mediaType === "movies" ? "tv" : "movies";
    fetchType(mediaType).then(() => fetchType(other));

    return () => { cancelled = true; };
  }, [mediaType]); // eslint-disable-line react-hooks/exhaustive-deps

  const movies = useMemo(() => {
    if (mediaType === "movies") return popularMoviesLoaded ? (popularMovies || []) : [];
    return popularTVLoaded ? (popularTV || []) : [];
  }, [mediaType, popularMovies, popularMoviesLoaded, popularTV, popularTVLoaded]);

  const isLoaded = mediaType === "movies" ? popularMoviesLoaded : popularTVLoaded;

  // genre + year-range options derived from the current media list
  const availableGenres = useMemo(() => {
    const set = new Set();
    movies.forEach((mo) => (mo.interests || []).forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [movies]);

  const yearRange = useMemo(() => {
    const years = movies.map(yearOf).filter((y) => y != null);
    const now = new Date().getFullYear();
    const max = years.length ? Math.max(now + 1, Math.max(...years)) : now + 1;
    return { min: 1900, max };
  }, [movies]);

  // each item keeps its original trending position (rank) so the displayed
  // numbers stay meaningful even after filtering / re-sorting
  const processed = useMemo(() => {
    // Strict IMDb-only accessors: no TMDB fallback, so the IMDb sorts use real
    // IMDb values and titles without a rating (null) sink to the bottom.
    const ratingOf = (mo) => {
      const v = imdbRatings[mo?.id]?.rating;
      return v == null ? null : Number(v);
    };
    const votesOf = (mo) => {
      const v = imdbRatings[mo?.id]?.votes;
      return v == null ? null : Number(v);
    };
    const ranked = movies.map((mo, i) => ({ mo, rank: i + 1 }));
    const filtered = ranked.filter(({ mo }) => {
      if (genreFilter !== "all" && !(mo.interests || []).includes(genreFilter))
        return false;
      if (!yearInRange(yearOf(mo), yearFrom, yearTo)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "imdb") {
        const r = compareNums(ratingOf(a.mo), ratingOf(b.mo), sortDir);
        if (r) return r;
      } else if (sortKey === "imdbVotes") {
        const r = compareNums(votesOf(a.mo), votesOf(b.mo), sortDir);
        if (r) return r;
      } else if (sortKey === "year") {
        const r = compareNums(yearOf(a.mo), yearOf(b.mo), sortDir);
        if (r) return r;
      } else if (sortKey === "trending") {
        return sortDir === "desc" ? a.rank - b.rank : b.rank - a.rank;
      }
      return a.rank - b.rank; // stable tiebreak by trending position
    });
    return sorted;
  }, [movies, genreFilter, yearFrom, yearTo, sortKey, sortDir, imdbRatings]);

  const activeFilterCount =
    (genreFilter !== "all" ? 1 : 0) +
    (yearFrom || yearTo ? 1 : 0) +
    (sortKey !== "trending" || sortDir !== "desc" ? 1 : 0);

  if (!isLoaded) return <Loader />;

  const featured = processed.slice(0, 3);
  const rest = processed.slice(3);

  const navTo = (movie) =>
    makeNavHandlers(
      navigate,
      `/mediadetails/${movie.media_type}/${movie.tmdb_id}`,
    );

  return (
    <div className="trending">
      <div className="trending-header">
        <h1 className="trending-title-h1">Top 100 Trending</h1>
      </div>

      <div className="trending-toolbar">
        <div className="toolbar">
          <select
            className="toolbar-select"
            value={mediaType}
            onChange={(e) => {
              setMediaType(e.target.value);
              setGenreFilter("all");
            }}
          >
            <option value="movies">Movies</option>
            <option value="tv">TV</option>
          </select>
          <ExtraFiltersPanel
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            onToggle={() => setFiltersOpen((v) => !v)}
            activeCount={activeFilterCount}
          >
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
            >
              <option value="all">All Genres</option>
              {availableGenres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <ReleaseYearFilter
              from={yearFrom}
              to={yearTo}
              onChange={({ from, to }) => {
                setYearFrom(from);
                setYearTo(to);
              }}
              minYear={yearRange.min}
              maxYear={yearRange.max}
            />
            <SortByMenu
              sortKey={sortKey}
              sortDir={sortDir}
              onChange={(k, d) => {
                // Switching *to* Trending from another sort restores the
                // natural 1→100 order; toggling direction while already on
                // Trending (same key) still flips it.
                if (k === "trending" && sortKeyRef.current !== "trending") {
                  setSortKey("trending");
                  setSortDir("desc");
                } else {
                  setSortKey(k);
                  setSortDir(d);
                }
              }}
              options={SORT_OPTIONS}
            />
          </ExtraFiltersPanel>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {processed.length === 0 ? (
        <div className="empty-msg">No trending titles match your filters.</div>
      ) : (
        <div className="trending-featured" key={mediaType}>
          {featured.map(({ mo }) => (
            <div
              key={`featured-${mo.media_type}-${mo.tmdb_id}`}
              className="tf-card"
              style={{
                backgroundImage: `url(${mo.backdropImage || mo.primaryImage})`,
              }}
              {...PRESS_HANDLERS}
              {...navTo(mo)}
            >
              <div className="tf-overlay" />
              <div className="tf-content">
                <img
                  className="tf-poster"
                  src={mo.primaryImage || "/placeholderimage.jpg"}
                  onError={(e) => { e.target.onerror = null; e.target.src = "/placeholderimage.jpg"; }}
                  alt={mo.primaryTitle}
                />
                <div className="tf-text">
                  <p className="tf-title">{mo.primaryTitle}</p>
                  <div className="tf-meta">
                    {mo.startYear && (
                      <span className="tf-year">{mo.startYear}</span>
                    )}
                    <TrendingRating movie={mo} />
                    {mo.interests?.length > 0 && (
                      <span className="tf-genres">
                        {mo.interests.slice(0, 3).map((g) => (
                          <span key={g} className="tf-genre-tag">{g}</span>
                        ))}
                      </span>
                    )}
                  </div>
                  {mo.description && (
                    <p className="tf-desc">{mo.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {rest.map(({ mo, rank }) => (
            <div
              key={`${mo.media_type}-${mo.tmdb_id}`}
              className="trending-row"
              {...PRESS_HANDLERS}
              {...navTo(mo)}
            >
              <span className="trending-rank">#{rank}</span>
              <img
                className="trending-thumb"
                src={mo.primaryImage || "/placeholderimage.jpg"}
                onError={(e) => { e.target.onerror = null; e.target.src = "/placeholderimage.jpg"; }}
                alt={mo.primaryTitle}
              />
              <div className="trending-info">
                <p className="trending-item-title">{mo.primaryTitle}</p>
                <div className="trending-meta">
                  {mo.startYear && (
                    <span className="trending-year">{mo.startYear}</span>
                  )}
                  <TrendingRating movie={mo} />
                  {mo.interests?.slice(0, 2).map((g) => (
                    <span key={g} className="trending-genre-tag">{g}</span>
                  ))}
                </div>
                {mo.description && (
                  <p className="trending-desc">{mo.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Trending;

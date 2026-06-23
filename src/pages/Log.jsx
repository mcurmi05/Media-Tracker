import LogComponent from "../components/LogComponent.jsx";
import { useRatings } from "../contexts/UserRatingsContext.jsx";
import { ratingMatchesMovie } from "../services/ratingsfromtable.js";
import "../styles/Log.css";
import "../styles/Toolbar.css";
import {
  isTV,
  movieYear,
  bookYear,
  compareNums,
  yearInRange,
  addedInRange,
  imdbRatingFor,
  imdbVotesFor,
  letterboxdRatingFor,
  letterboxdCountFor,
} from "../utils/mediaFilters.js";
import { useLogs } from "../contexts/UserLogsContext.jsx";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import BookLogCard from "../components/BookLogCard.jsx";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookInfo } from "../utils/bookInfo.js";
import SortByMenu from "../components/SortByMenu.jsx";
import ReleaseYearFilter from "../components/ReleaseYearFilter.jsx";
import DateAddedFilter from "../components/DateAddedFilter.jsx";
import Loader from "../components/Loader.jsx";
import { useImdbRatings } from "../contexts/ImdbRatingsContext.jsx";
import { useLetterboxdRatings } from "../contexts/LetterboxdRatingsContext.jsx";
import ExtraFiltersPanel from "../components/ExtraFiltersPanel.jsx";
import { useDebouncedValue } from "../utils/useDebouncedValue.js";

const SORT_OPTIONS = [
  { value: "date", label: "Date Added" },
  { value: "year", label: "Release Date" },
  { value: "rating", label: "Rating" },
  { value: "imdb", label: "IMDb Rating" },
  { value: "imdbVotes", label: "IMDb Votes" },
  { value: "letterboxd", label: "Letterboxd Rating" },
  { value: "letterboxdCount", label: "Letterboxd Votes" },
];

function Log() {
  const { userLogs, userLogsLoaded } = useLogs();
  const { bookLogs, bookLogsLoaded } = useBookLogs();
  const { userRatings } = useRatings();
  const { findRatingForBook } = useBookRatings();
  const { ratings: imdbRatings } = useImdbRatings();
  const { ratings: lbRatings } = useLetterboxdRatings();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(
    location.state?.searchTerm || "",
  );
  // Debounced copy used for filtering so it doesn't run on every keystroke.
  const debouncedSearch = useDebouncedValue(searchTerm);
  const [ratingFilter, setRatingFilter] = useState(
    location.state?.ratingFilter || "all",
  );
  const [mediaTypeFilter, setMediaTypeFilter] = useState(
    location.state?.mediaTypeFilter || "all",
  );
  const [sortKey, setSortKey] = useState(location.state?.sortKey || "date");
  const [sortDir, setSortDir] = useState(location.state?.sortDir || "desc");
  const [yearFrom, setYearFrom] = useState(location.state?.yearFrom || "");
  const [yearTo, setYearTo] = useState(location.state?.yearTo || "");
  const [addedFrom, setAddedFrom] = useState(location.state?.addedFrom || "");
  const [addedTo, setAddedTo] = useState(location.state?.addedTo || "");
  const [genreFilter, setGenreFilter] = useState(location.state?.genreFilter || "all");
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const s = location.state || {};
    return (
      (s.ratingFilter && s.ratingFilter !== "all") ||
      (s.genreFilter && s.genreFilter !== "all") ||
      s.yearFrom ||
      s.yearTo ||
      s.addedFrom ||
      s.addedTo ||
      (s.sortKey && s.sortKey !== "date") ||
      (s.sortDir && s.sortDir !== "desc")
    );
  });

  const activeFilterCount =
    (ratingFilter !== "all" ? 1 : 0) +
    (genreFilter !== "all" ? 1 : 0) +
    (yearFrom || yearTo ? 1 : 0) +
    (addedFrom || addedTo ? 1 : 0) +
    (sortKey !== "date" || sortDir !== "desc" ? 1 : 0);

  const goToRatings = () => {
    navigate("/ratings", {
      state: {
        searchTerm,
        ratingFilter,
        genreFilter,
        mediaTypeFilter,
        sortKey,
        sortDir,
        yearFrom,
        yearTo,
        addedFrom,
        addedTo,
      },
    });
  };

  const goToWatchlist = () => {
    navigate("/watchlist", {
      state: {
        searchTerm,
        genreFilter,
        mediaTypeFilter,
        sortKey,
        sortDir,
        yearFrom,
        yearTo,
        addedFrom,
        addedTo,
      },
    });
  };

  const yearMatchesFilter = (y) => yearInRange(y, yearFrom, yearTo);
  const addedMatchesFilter = (d) => addedInRange(d, addedFrom, addedTo);
  const movieRating = (log) => {
    if (!log.movie_object) return null;
    const found = userRatings.find((r) =>
      ratingMatchesMovie(r, log.movie_object),
    );
    const v = found ? Number(found.rating) : null;
    return Number.isFinite(v) ? v : null;
  };
  const bookRating = (bookLog) => {
    const v = Number(findRatingForBook(bookLog)?.book_rating);
    return Number.isFinite(v) ? v : null;
  };
  //live imdb rating/votes, books have no imdb entry so they null out and sink in these sorts
  const imdbRatingOf = (mo) => imdbRatingFor(imdbRatings, mo);
  const imdbVotesOf = (mo) => imdbVotesFor(imdbRatings, mo);
  const lbRatingOf = (mo) => letterboxdRatingFor(lbRatings, mo);
  const lbCountOf = (mo) => letterboxdCountFor(lbRatings, mo);
  const yearRange = useMemo(() => {
    const years = [];
    userLogs.forEach((l) => {
      const y = movieYear(l);
      if (y != null) years.push(y);
    });
    bookLogs.forEach((l) => {
      const y = bookYear(l);
      if (y != null) years.push(y);
    });
    const now = new Date().getFullYear();
    const max = years.length ? Math.max(now + 1, Math.max(...years)) : now + 1;
    return { min: 1500, max };
  }, [userLogs, bookLogs]);

  const availableGenres = useMemo(() => {
    const set = new Set();
    userLogs.forEach((l) => {
      (l.movie_object?.interests || []).forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [userLogs]);

  const compareNumeric = (a, b) => compareNums(a, b, sortDir);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const needsMovieData =
    mediaTypeFilter === "all" ||
    mediaTypeFilter === "moviesAndTV" ||
    mediaTypeFilter === "movies" ||
    mediaTypeFilter === "tv";
  const needsBookData =
    mediaTypeFilter === "all" || mediaTypeFilter === "books";

  if (
    (needsMovieData && !userLogsLoaded) ||
    (needsBookData && !bookLogsLoaded)
  ) {
    return <Loader />;
  }

  // Helper function to get the most recent activity date for a log
  const getMostRecentDate = (log) => {
    if (
      log.season_info &&
      Array.isArray(log.season_info) &&
      log.season_info.length > 0
    ) {
      const lastSeason = log.season_info[log.season_info.length - 1];

      // If the last season has an end_date AND is marked as finished, use that
      if (lastSeason.end_date && lastSeason.finished) {
        return new Date(lastSeason.end_date);
      }

      // Otherwise, use the start_date of the last season (currently watching or unwatched)
      if (lastSeason.start_date) {
        return new Date(lastSeason.start_date);
      }
    }

    // Fallback to log creation date for movies or shows without seasons
    return new Date(log.created_at);
  };

  const getMostRecentBookDate = (bookLog) => {
    // Use end_date if the book is finished
    if (bookLog.end_date) {
      return new Date(bookLog.end_date);
    }

    // Use start_date if currently reading
    if (bookLog.start_date) {
      return new Date(bookLog.start_date);
    }

    // Fallback to creation date
    return new Date(bookLog.created_at);
  };

  // Filter book logs (only relevant when books should be shown)
  const filteredBookLogs = (needsBookData && genreFilter === "all")
    ? bookLogs
        .filter((bookLog) => {
          if (debouncedSearch.trim()) {
            const info = getBookInfo(bookLog);
            const title = info.title || "";
            const author = info.author || "";
            if (
              !title.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
              !author.toLowerCase().includes(debouncedSearch.toLowerCase())
            ) {
              return false;
            }
          }
          if (ratingFilter !== "all") {
            const rating = findRatingForBook(bookLog)?.book_rating ?? null;
            if (rating == null) return false;
            if (Number(rating) !== Number(ratingFilter)) return false;
          }
          if (!yearMatchesFilter(bookYear(bookLog))) return false;
          if (!addedMatchesFilter(bookLog.created_at)) return false;
          return true;
        })
        .sort((a, b) => {
          if (sortKey === "year") {
            const yc = compareNumeric(bookYear(a), bookYear(b));
            if (yc !== 0) return yc;
          } else if (sortKey === "rating") {
            const rc = compareNumeric(bookRating(a), bookRating(b));
            if (rc !== 0) return rc;
          } else if (sortKey === "date" && sortDir === "asc") {
            return getMostRecentBookDate(a) - getMostRecentBookDate(b);
          }
          return getMostRecentBookDate(b) - getMostRecentBookDate(a);
        })
    : [];

  const filteredLogs = needsMovieData
    ? userLogs
        .filter((log) => {
          const itemIsTV = isTV(log.movie_object);
          if (mediaTypeFilter === "movies" && itemIsTV) return false;
          if (mediaTypeFilter === "tv" && !itemIsTV) return false;
          //"all" and "moviesAndTV" include both
          if (debouncedSearch.trim()) {
            const title = log.movie_object?.primaryTitle || "";
            if (!title.toLowerCase().includes(debouncedSearch.toLowerCase()))
              return false;
          }
          if (ratingFilter !== "all") {
            let ratingValue = null;
            if (log.movie_object) {
              const found = userRatings.find((r) =>
                ratingMatchesMovie(r, log.movie_object),
              );
              if (found) ratingValue = found.rating;
            }
            if (ratingValue === null) return false;
            if (Number(ratingValue) !== Number(ratingFilter)) return false;
          }
          if (genreFilter !== "all") {
            const genres = log.movie_object?.interests || [];
            if (!genres.includes(genreFilter)) return false;
          }
          if (!yearMatchesFilter(movieYear(log))) return false;
          if (!addedMatchesFilter(log.created_at)) return false;
          return true;
        })
        .sort((a, b) => {
          if (sortKey === "year") {
            const yc = compareNumeric(movieYear(a), movieYear(b));
            if (yc !== 0) return yc;
          } else if (sortKey === "rating") {
            const rc = compareNumeric(movieRating(a), movieRating(b));
            if (rc !== 0) return rc;
          } else if (sortKey === "imdb") {
            const rc = compareNumeric(
              imdbRatingOf(a.movie_object),
              imdbRatingOf(b.movie_object),
            );
            if (rc !== 0) return rc;
          } else if (sortKey === "imdbVotes") {
            const rc = compareNumeric(
              imdbVotesOf(a.movie_object),
              imdbVotesOf(b.movie_object),
            );
            if (rc !== 0) return rc;
          } else if (sortKey === "letterboxd") {
            const rc = compareNumeric(
              lbRatingOf(a.movie_object),
              lbRatingOf(b.movie_object),
            );
            if (rc !== 0) return rc;
          } else if (sortKey === "letterboxdCount") {
            const rc = compareNumeric(
              lbCountOf(a.movie_object),
              lbCountOf(b.movie_object),
            );
            if (rc !== 0) return rc;
          } else if (sortKey === "date" && sortDir === "asc") {
            return getMostRecentDate(a) - getMostRecentDate(b);
          }
          return getMostRecentDate(b) - getMostRecentDate(a);
        })
    : [];

  // Combined sorted list for "All" view (movies, TV, books interleaved by date)
  const combinedAllItems =
    mediaTypeFilter === "all"
      ? [
          ...filteredLogs.map((log) => ({
            kind: "log",
            id: `log-${log.id}`,
            data: log,
            date: getMostRecentDate(log),
            year: movieYear(log),
            rating: movieRating(log),
            imdb: imdbRatingOf(log.movie_object),
            imdbVotes: imdbVotesOf(log.movie_object),
            letterboxd: lbRatingOf(log.movie_object),
            letterboxdCount: lbCountOf(log.movie_object),
          })),
          ...filteredBookLogs.map((bookLog) => ({
            kind: "book",
            id: `book-${bookLog.id}`,
            data: bookLog,
            date: getMostRecentBookDate(bookLog),
            year: bookYear(bookLog),
            rating: bookRating(bookLog),
            imdb: null,
            imdbVotes: null,
            letterboxd: null,
            letterboxdCount: null,
          })),
        ].sort((a, b) => {
          if (sortKey === "year") {
            const yc = compareNumeric(a.year, b.year);
            if (yc !== 0) return yc;
          } else if (sortKey === "rating") {
            const rc = compareNumeric(a.rating, b.rating);
            if (rc !== 0) return rc;
          } else if (sortKey === "imdb") {
            const rc = compareNumeric(a.imdb, b.imdb);
            if (rc !== 0) return rc;
          } else if (sortKey === "imdbVotes") {
            const rc = compareNumeric(a.imdbVotes, b.imdbVotes);
            if (rc !== 0) return rc;
          } else if (sortKey === "letterboxd") {
            const rc = compareNumeric(a.letterboxd, b.letterboxd);
            if (rc !== 0) return rc;
          } else if (sortKey === "letterboxdCount") {
            const rc = compareNumeric(a.letterboxdCount, b.letterboxdCount);
            if (rc !== 0) return rc;
          } else if (sortKey === "date" && sortDir === "asc") {
            return a.date - b.date;
          }
          return b.date - a.date;
        })
      : null;

  const displayCount =
    mediaTypeFilter === "all"
      ? combinedAllItems.length
      : mediaTypeFilter === "books"
        ? filteredBookLogs.length
        : filteredLogs.length;

  return (
    <div className="page-stack">
      <h1 className="page-title">Your Log</h1>
      <div className="toolbar">
        <div className="toolbar-search">
          <input
            className="toolbar-input"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="toolbar-clear"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <select
          className="toolbar-select"
          value={mediaTypeFilter}
          onChange={(e) => setMediaTypeFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="moviesAndTV">Movies & TV</option>
          <option value="movies">Movies</option>
          <option value="tv">TV</option>
          <option value="books">Books</option>
        </select>
        <ExtraFiltersPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onToggle={() => setFiltersOpen((v) => !v)}
          activeCount={activeFilterCount}
          onClear={() => {
            setRatingFilter("all");
            setGenreFilter("all");
            setYearFrom("");
            setYearTo("");
            setAddedFrom("");
            setAddedTo("");
            setSortKey("date");
            setSortDir("desc");
          }}
        >
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
          >
            <option value="all">All Ratings</option>
            {[...Array(10)].map((_, i) => (
              <option key={10 - i} value={10 - i}>
                {10 - i}
              </option>
            ))}
          </select>
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
          <DateAddedFilter
            from={addedFrom}
            to={addedTo}
            onChange={({ from, to }) => {
              setAddedFrom(from);
              setAddedTo(to);
            }}
          />
          <SortByMenu
            sortKey={sortKey}
            sortDir={sortDir}
            onChange={(k, d) => {
              setSortKey(k);
              setSortDir(d);
            }}
            options={SORT_OPTIONS}
          />
        </ExtraFiltersPanel>
        <button
          className="toolbar-icon-btn"
          onClick={goToRatings}
          title="View ratings with these filters"
        >
          <img src="/ratings.png" alt="Go to Ratings" />
        </button>
        <button
          className="toolbar-icon-btn"
          onClick={goToWatchlist}
          title="View watchlist with these filters"
        >
          <img src="/watchlist-navbar.png" alt="Go to Watchlist" />
        </button>
        <span className="toolbar-count">{displayCount}</span>
      </div>
      {mediaTypeFilter === "all" ? (
        // Combined view: movies, TV, and books interleaved by date
        <>
          {combinedAllItems.length === 0 && (
            <div className="empty-msg">
              No logs match your applied filters
            </div>
          )}
          <div className="list-col">
            {combinedAllItems.map((item) =>
              item.kind === "log" ? (
                <div
                  key={item.id}
                  className="list-row"
                >
                  <LogComponent
                    log_id={item.data.id}
                    created_at={item.data.created_at}
                    movie_end_date={item.data.movie_end_date}
                    movie={item.data.movie_object}
                    logtext={item.data.log}
                  />
                </div>
              ) : (
                <div
                  key={item.id}
                  className="list-row"
                >
                  <BookLogCard bookLog={item.data} />
                </div>
              ),
            )}
          </div>
        </>
      ) : mediaTypeFilter === "books" ? (
        // Book logs section
        <>
          {filteredBookLogs.length === 0 && (
            <div className="empty-msg">
              {bookLogs.length === 0
                ? "No book logs yet. Add your first book!"
                : "No book logs match your applied filters"}
            </div>
          )}
          <div className="list-col" style={{ gap: "1rem" }}>
            {filteredBookLogs.map((bookLog) => (
              <BookLogCard key={bookLog.id} bookLog={bookLog} />
            ))}
          </div>
        </>
      ) : (
        // Movie/TV logs section
        <>
          {filteredLogs.length === 0 && (
            <div className="empty-msg">
              No logs match your applied filters
            </div>
          )}
          <div className="list-col">
            {filteredLogs.map((log) =>
              log.id ? (
                <div
                  key={log.id}
                  className="list-row"
                >
                  <LogComponent
                    log_id={log.id}
                    created_at={log.created_at}
                    movie_end_date={log.movie_end_date}
                    movie={log.movie_object}
                    logtext={log.log}
                  />
                </div>
              ) : null,
            )}
          </div>
        </>
      )}

    </div>
  );
}

export default Log;

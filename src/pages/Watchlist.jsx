import WatchlistComponent from "../components/WatchlistComponent.jsx";
import BookTbrComponent from "../components/BookTbrComponent.jsx";
import "../styles/Log.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWatchlist } from "../contexts/UserWatchlistContext.jsx";
import { useBookTbr } from "../contexts/UserBookTbrContext.jsx";
import { getBookInfo } from "../utils/bookInfo.js";
import SortByMenu from "../components/SortByMenu.jsx";
import ReleaseYearFilter from "../components/ReleaseYearFilter.jsx";
import DateAddedFilter from "../components/DateAddedFilter.jsx";
import Loader from "../components/Loader.jsx";

const SORT_OPTIONS = [
  { value: "date", label: "Date Added" },
  { value: "year", label: "Release Date" },
];

function Watchlist() {
  const { userWatchlist, userWatchlistLoaded } = useWatchlist();
  const { userBookTbr, userBookTbrLoaded } = useBookTbr();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(
    location.state?.searchTerm || "",
  );
  const [mediaTypeFilter, setMediaTypeFilter] = useState(
    location.state?.mediaTypeFilter || "all",
  );
  const [newSeasonFilter, setNewSeasonFilter] = useState(false);
  const [sortKey, setSortKey] = useState(location.state?.sortKey || "date");
  const [sortDir, setSortDir] = useState(location.state?.sortDir || "desc");
  const [yearFrom, setYearFrom] = useState(location.state?.yearFrom || "");
  const [yearTo, setYearTo] = useState(location.state?.yearTo || "");
  const [addedFrom, setAddedFrom] = useState(location.state?.addedFrom || "");
  const [addedTo, setAddedTo] = useState(location.state?.addedTo || "");
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const s = location.state || {};
    return (
      s.yearFrom ||
      s.yearTo ||
      s.addedFrom ||
      s.addedTo ||
      (s.sortKey && s.sortKey !== "date") ||
      (s.sortDir && s.sortDir !== "desc")
    );
  });

  const activeFilterCount =
    (newSeasonFilter ? 1 : 0) +
    (yearFrom || yearTo ? 1 : 0) +
    (addedFrom || addedTo ? 1 : 0) +
    (sortKey !== "date" || sortDir !== "desc" ? 1 : 0);

  const goToRatings = () => {
    navigate("/ratings", {
      state: {
        searchTerm,
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

  const goToLog = () => {
    navigate("/log", {
      state: {
        searchTerm,
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

  const yearMatchesFilter = (y) => {
    if (!yearFrom && !yearTo) return true;
    if (y == null) return false;
    if (yearFrom) {
      const n = Number(yearFrom);
      if (Number.isFinite(n) && y < n) return false;
    }
    if (yearTo) {
      const n = Number(yearTo);
      if (Number.isFinite(n) && y > n) return false;
    }
    return true;
  };

  const addedMatchesFilter = (dateStr) => {
    if (!addedFrom && !addedTo) return true;
    if (!dateStr) return false;
    const ymd = String(dateStr).slice(0, 10);
    if (!ymd) return false;
    if (addedFrom && ymd < addedFrom) return false;
    if (addedTo && ymd > addedTo) return false;
    return true;
  };

  // Release year helpers for the release-date sort.
  const movieYear = (item) => {
    const y = Number(item.movie_object?.startYear);
    return Number.isFinite(y) && y > 0 ? y : null;
  };
  const bookYear = (item) => {
    const y = Number(item.book_entries?.release_year ?? item.release_year);
    return Number.isFinite(y) && y > 0 ? y : null;
  };
  const compareNumeric = (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return sortDir === "asc" ? a - b : b - a;
  };

  const yearRange = useMemo(() => {
    const years = [];
    userWatchlist.forEach((w) => {
      const y = movieYear(w);
      if (y != null) years.push(y);
    });
    userBookTbr.forEach((t) => {
      const y = bookYear(t);
      if (y != null) years.push(y);
    });
    const now = new Date().getFullYear();
    const max = years.length ? Math.max(now + 5, Math.max(...years)) : now + 5;
    return { min: 1500, max };
  }, [userWatchlist, userBookTbr]);

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

  const isLoading =
    (needsMovieData && !userWatchlistLoaded) ||
    (needsBookData && !userBookTbrLoaded);

  const filteredWatchlist = useMemo(() => {
    if (!needsMovieData) return [];
    const filtered = userWatchlist.filter((item) => {
      if (newSeasonFilter && !item.new_season_to_watch) return false;
      const type = (item.movie_object?.type || "").toLowerCase();
      const titleType = (item.movie_object?.titleType || "").toLowerCase();
      const isTV =
        type.includes("tv") ||
        titleType.includes("tv") ||
        item.movie_object?.episodes;
      if (mediaTypeFilter === "movies" && isTV) return false;
      if (mediaTypeFilter === "tv" && !isTV) return false;
      if (searchTerm.trim()) {
        const title = item.movie_object?.primaryTitle || "";
        if (!title.toLowerCase().includes(searchTerm.toLowerCase()))
          return false;
      }
      if (!yearMatchesFilter(movieYear(item))) return false;
      if (!addedMatchesFilter(item.created_at)) return false;
      return true;
    });
    if (sortKey === "year") {
      return filtered.sort((a, b) => {
        const yc = compareNumeric(movieYear(a), movieYear(b));
        if (yc !== 0) return yc;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    return filtered.sort((a, b) =>
      sortDir === "asc"
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userWatchlist,
    newSeasonFilter,
    mediaTypeFilter,
    searchTerm,
    needsMovieData,
    sortKey,
    sortDir,
    yearFrom,
    yearTo,
    addedFrom,
    addedTo,
  ]);

  const filteredBookTbr = useMemo(() => {
    if (!needsBookData) return [];
    if (newSeasonFilter) return [];
    const filtered = userBookTbr.filter((item) => {
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        const info = getBookInfo(item);
        const title = (info.title || "").toLowerCase();
        const author = (info.author || "").toLowerCase();
        if (!title.includes(search) && !author.includes(search)) return false;
      }
      if (!yearMatchesFilter(bookYear(item))) return false;
      if (!addedMatchesFilter(item.created_at)) return false;
      return true;
    });
    if (sortKey === "year") {
      return filtered.sort((a, b) => {
        const yc = compareNumeric(bookYear(a), bookYear(b));
        if (yc !== 0) return yc;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    return filtered.sort((a, b) =>
      sortDir === "asc"
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userBookTbr,
    newSeasonFilter,
    searchTerm,
    needsBookData,
    sortKey,
    sortDir,
    yearFrom,
    yearTo,
    addedFrom,
    addedTo,
  ]);

  const isAllView = mediaTypeFilter === "all";
  const isBooksView = mediaTypeFilter === "books";

  const combinedAll = useMemo(() => {
    if (!isAllView) return null;
    const movieItems = filteredWatchlist.map((item) => ({
      kind: "movie",
      id: `movie-${item.id}`,
      data: item,
      date: new Date(item.created_at),
      year: movieYear(item),
    }));
    const bookItems = filteredBookTbr.map((item) => ({
      kind: "book",
      id: `book-${item.id}`,
      data: item,
      date: new Date(item.created_at),
      year: bookYear(item),
    }));
    return [...movieItems, ...bookItems].sort((a, b) => {
      if (sortKey === "year") {
        const yc = compareNumeric(a.year, b.year);
        if (yc !== 0) return yc;
      } else if (sortKey === "date" && sortDir === "asc") {
        return a.date - b.date;
      }
      return b.date - a.date;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllView, filteredWatchlist, filteredBookTbr, sortKey, sortDir]);

  const displayCount = isAllView
    ? combinedAll.length
    : isBooksView
      ? filteredBookTbr.length
      : filteredWatchlist.length;

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <h1 style={{ textAlign: "center", marginTop: "-20px" }}>
        {isBooksView ? "Your TBR list" : "Your Watchlist"}
      </h1>
      <div style={{ height: "18px" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            margin: "6px",
          }}
        >
          <input
            className="filter-input"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: "8px",
              paddingRight: searchTerm ? "26px" : "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              width: "180px",
              textAlign: "center",
              backgroundColor: "#3b3b3b",
              color: "#ffffff",
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: "6px",
                background: "none",
                border: "none",
                color: "#aaa",
                cursor: "pointer",
                fontSize: "13px",
                lineHeight: 1,
                padding: 0,
                outline: "none",
              }}
            >
              {String.fromCharCode(0x2715)}
            </button>
          )}
        </div>
        <select
          value={mediaTypeFilter}
          onChange={(e) => {
            const next = e.target.value;
            setMediaTypeFilter(next);
            if (next === "books" || next === "all") {
              setNewSeasonFilter(false);
            }
          }}
          style={{
            height: "32px",
            padding: "0 10px",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            backgroundColor: "#3b3b3b",
            color: "#ffffff",
            fontSize: "0.8rem",
            outline: "none",
            textAlign: "center",
            margin: "6px",
          }}
        >
          <option value="all">All</option>
          <option value="moviesAndTV">Movies & TV</option>
          <option value="movies">Movies</option>
          <option value="tv">TV</option>
          <option value="books">Books</option>
        </select>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setFiltersOpen((v) => !v)}
          title={filtersOpen ? "Hide extra filters" : "Show extra filters"}
          style={{
            height: "32px",
            padding: "0 12px",
            border:
              (activeFilterCount > 0 ? "2px" : "1px") +
              " solid " +
              (activeFilterCount > 0 ? "#ffffff" : "#cccccc"),
            borderRadius: "6px",
            backgroundColor:
              activeFilterCount > 0 ? "#e50914" : "#3b3b3b",
            color: "#ffffff",
            fontSize: "0.8rem",
            fontWeight: "bold",
            cursor: "pointer",
            margin: "6px",
            outline: "none",
            whiteSpace: "nowrap",
          }}
        >
          Extra Filters
        </button>
        {filtersOpen && (
          <>
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
            {mediaTypeFilter !== "books" && (
              <button
                onClick={() => {
                  const next = !newSeasonFilter;
                  setNewSeasonFilter(next);
                  if (next) setMediaTypeFilter("tv");
                  else setMediaTypeFilter("all");
                }}
                style={{
                  height: "32px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  border:
                    (newSeasonFilter ? "2px" : "1px") +
                    " solid " +
                    (newSeasonFilter ? "#ffffff" : "#cccccc"),
                  borderRadius: "6px",
                  backgroundColor: newSeasonFilter ? "#e50914" : "#3b3b3b",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  margin: "6px",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s, border-color 0.2s",
                  outline: "none",
                }}
              >
                {String.fromCharCode(0x2605)} New Season
              </button>
            )}
          </>
        )}
        <button
          onClick={goToRatings}
          title="View ratings with these filters"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            margin: "6px",
            display: "inline-flex",
            alignItems: "center",
            outline: "none",
          }}
        >
          <img
            src="/ratings.png"
            alt="Go to Ratings"
            style={{ width: 22, height: 22 }}
          />
        </button>
        <button
          onClick={goToLog}
          title="View log with these filters"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            margin: "6px",
            display: "inline-flex",
            alignItems: "center",
            outline: "none",
          }}
        >
          <img
            src="/log.png"
            alt="Go to Log"
            style={{ width: 22, height: 22 }}
          />
        </button>
        <span
          style={{
            fontWeight: "bold",
            background: "#ff0000",
            color: "white",
            borderRadius: "12px",
            padding: "2px 7px",
            fontSize: "0.95em",
            boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
            letterSpacing: "0.5px",
            verticalAlign: "middle",
            display: "inline-block",
            margin: "6px",
          }}
        >
          {displayCount}
        </span>
      </div>
      {displayCount === 0 && (
        <div style={{ textAlign: "center" }}>
          {searchTerm
            ? `No watchlist items found for "${searchTerm}"!`
            : "No watchlist items found!"}
        </div>
      )}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {isAllView
          ? combinedAll.map((item) =>
              item.kind === "movie" ? (
                <div
                  key={item.id}
                  style={{
                    marginBottom: "1rem",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <WatchlistComponent
                    watchlist_id={item.data.id}
                    movie={item.data.movie_object}
                    addedDate={item.data.created_at}
                    newSeasonToWatch={item.data.new_season_to_watch}
                  />
                </div>
              ) : (
                <div
                  key={item.id}
                  style={{
                    marginBottom: "1rem",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <BookTbrComponent tbrEntry={item.data} />
                </div>
              ),
            )
          : isBooksView
            ? filteredBookTbr.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    marginBottom: "1rem",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <BookTbrComponent tbrEntry={entry} />
                </div>
              ))
            : filteredWatchlist.map((watchlist_entry) =>
                watchlist_entry.id ? (
                  <div
                    key={watchlist_entry.id}
                    style={{
                      marginBottom: "1rem",
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <WatchlistComponent
                      watchlist_id={watchlist_entry.id}
                      movie={watchlist_entry.movie_object}
                      addedDate={watchlist_entry.created_at}
                      newSeasonToWatch={watchlist_entry.new_season_to_watch}
                    />
                  </div>
                ) : null,
              )}
      </div>
    </div>
  );
}

export default Watchlist;

import WatchlistComponent from "../components/WatchlistComponent.jsx";
import BookTbrComponent from "../components/BookTbrComponent.jsx";
import Rating from "../components/Rating.jsx";
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
  const {
    userWatchlist,
    userWatchlistLoaded,
    watchlistQueue,
    updateQueueRank,
    removeFromQueue,
  } = useWatchlist();
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
  const [queueOpen, setQueueOpen] = useState(true);
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

  // Set of watchlist ids that currently live in the queue. These are pulled out
  // of the main list and shown in the highlighted queue section at the top.
  const queuedIds = useMemo(
    () =>
      new Set(
        watchlistQueue
          .filter((q) => q.watchlist_id != null)
          .map((q) => q.watchlist_id),
      ),
    [watchlistQueue],
  );

  // Book TBR ids that currently live in the queue (pulled out of the main list).
  const queuedBookIds = useMemo(
    () =>
      new Set(
        watchlistQueue
          .filter((q) => q.book_tbr_id != null)
          .map((q) => q.book_tbr_id),
      ),
    [watchlistQueue],
  );

  // Which movie/TV queue category a watchlist item belongs to.
  const queueCategoryOf = (m) => {
    const type = (m?.type || "").toLowerCase();
    const titleType = (m?.titleType || "").toLowerCase();
    const isTV =
      type.includes("tv") || titleType.includes("tv") || !!m?.episodes;
    return isTV ? "tv" : "movies";
  };

  // Queue rows joined with their watchlist/book data, grouped by category and
  // each group ordered by queue_rank. Ranks are tracked per category, so movies,
  // TV, and books each start their numbering at 1.
  const queueByCategory = useMemo(() => {
    const groups = { movies: [], tv: [], books: [] };
    watchlistQueue
      .slice()
      .sort(
        (a, b) =>
          (a.queue_rank ?? Number.MAX_SAFE_INTEGER) -
          (b.queue_rank ?? Number.MAX_SAFE_INTEGER),
      )
      .forEach((q) => {
        if (q.book_tbr_id != null) {
          const entry = userBookTbr.find((b) => b.id === q.book_tbr_id);
          if (!entry) return;
          groups.books.push({
            queue_id: q.id,
            queue_rank: q.queue_rank,
            book_tbr_id: q.book_tbr_id,
            book: entry,
          });
        } else if (q.watchlist_id != null) {
          const entry = userWatchlist.find((w) => w.id === q.watchlist_id);
          if (!entry) return;
          groups[queueCategoryOf(entry.movie_object)].push({
            queue_id: q.id,
            queue_rank: q.queue_rank,
            watchlist_id: q.watchlist_id,
            movie: entry.movie_object,
          });
        }
      });
    return groups;
  }, [watchlistQueue, userWatchlist, userBookTbr]);

  const queueCount =
    queueByCategory.movies.length +
    queueByCategory.tv.length +
    queueByCategory.books.length;

  const QUEUE_CATEGORY_LABELS = { movies: "Movies", tv: "TV", books: "Books" };
  const queueCategoriesToShow =
    mediaTypeFilter === "movies"
      ? ["movies"]
      : mediaTypeFilter === "tv"
        ? ["tv"]
        : mediaTypeFilter === "books"
          ? ["books"]
          : mediaTypeFilter === "moviesAndTV"
            ? ["movies", "tv"]
            : ["movies", "tv", "books"];
  const visibleQueueCount = queueCategoriesToShow.reduce(
    (n, c) => n + queueByCategory[c].length,
    0,
  );

  // Persist a new sequential ordering (1..n) for the given queue ids. Called
  // per category so each category is renumbered independently.
  const applyQueueOrder = async (orderedQueueIds) => {
    for (let i = 0; i < orderedQueueIds.length; i++) {
      await updateQueueRank(orderedQueueIds[i], i + 1);
    }
  };

  const handleQueueMove = async (category, queueId, direction) => {
    const ids = queueByCategory[category].map((q) => q.queue_id);
    const index = ids.indexOf(queueId);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    await applyQueueOrder(ids);
  };

  const handleQueueSendTop = async (category, queueId) => {
    const ids = queueByCategory[category].map((q) => q.queue_id);
    const index = ids.indexOf(queueId);
    if (index <= 0) return;
    const [moved] = ids.splice(index, 1);
    ids.unshift(moved);
    await applyQueueOrder(ids);
  };

  const handleQueueSendBottom = async (category, queueId) => {
    const ids = queueByCategory[category].map((q) => q.queue_id);
    const index = ids.indexOf(queueId);
    if (index === -1 || index === ids.length - 1) return;
    const [moved] = ids.splice(index, 1);
    ids.push(moved);
    await applyQueueOrder(ids);
  };

  const filteredWatchlist = useMemo(() => {
    if (!needsMovieData) return [];
    const filtered = userWatchlist.filter((item) => {
      if (queuedIds.has(item.id)) return false;
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
    queuedIds,
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
      if (queuedBookIds.has(item.id)) return false;
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
    queuedBookIds,
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
      {queueCount > 0 && (
        <div
          className="watchlist-queue"
          style={{
            boxSizing: "border-box",
            background: "#2a2a2a",
            border: "1px solid #2e2e2e",
            borderRadius: "14px",
            padding: queueOpen ? "16px 16px 6px" : "12px 16px",
            marginBottom: "32px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
          }}
        >
          <div
            onClick={() => setQueueOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: queueOpen ? "16px" : "0",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <img
              src="/add-to-queue.png"
              alt=""
              style={{ width: 20, height: 20 }}
            />
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Up Next</h2>
            <span
              style={{
                fontWeight: "bold",
                background: "#ff0000",
                color: "white",
                borderRadius: "12px",
                padding: "2px 7px",
                fontSize: "0.8em",
              }}
            >
              {visibleQueueCount}
            </span>
            <img
              src={queueOpen ? "/promote.png" : "/demote.png"}
              alt=""
              style={{ width: 14, height: 14, marginLeft: "auto" }}
            />
          </div>
          {queueOpen &&
            (visibleQueueCount === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#888",
                  padding: "8px 0 14px",
                }}
              >
                Nothing in your queue yet.
              </div>
            ) : (
              queueCategoriesToShow.map((category) => {
                const items = queueByCategory[category];
                if (items.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: "4px" }}>
                    {queueCategoriesToShow.length > 1 && (
                      <div
                        style={{
                          color: "#9a9a9a",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                          margin: "4px 2px 0",
                        }}
                      >
                        {QUEUE_CATEGORY_LABELS[category]}
                      </div>
                    )}
                    {items.map((item, index) => (
                      <div
                        key={item.queue_id}
                        style={{
                          marginBottom: "0.15rem",
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        {category === "books" ? (
                          <BookTbrComponent
                            tbrEntry={item.book}
                            queueMode={true}
                            rankNumber={index + 1}
                            onMoveUp={() =>
                              handleQueueMove(category, item.queue_id, "up")
                            }
                            onMoveDown={() =>
                              handleQueueMove(category, item.queue_id, "down")
                            }
                            onSendTop={() =>
                              handleQueueSendTop(category, item.queue_id)
                            }
                            onSendBottom={() =>
                              handleQueueSendBottom(category, item.queue_id)
                            }
                          />
                        ) : (
                          <Rating
                            movie_object={item.movie}
                            ratingDate={null}
                            rankNumber={index + 1}
                            showRankControls={true}
                            rankLeft={true}
                            onMoveUp={() =>
                              handleQueueMove(category, item.queue_id, "up")
                            }
                            onMoveDown={() =>
                              handleQueueMove(category, item.queue_id, "down")
                            }
                            onSendTop={() =>
                              handleQueueSendTop(category, item.queue_id)
                            }
                            onSendBottom={() =>
                              handleQueueSendBottom(category, item.queue_id)
                            }
                            actionSlot={
                              <button
                                onClick={() => removeFromQueue(item.queue_id)}
                                title="Remove from queue (keep in watchlist)"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#aaa",
                                  cursor: "pointer",
                                  fontSize: "18px",
                                  lineHeight: 1,
                                  padding: "0 2px",
                                  marginLeft: "2px",
                                  marginBottom: "1px",
                                  outline: "none",
                                }}
                              >
                                {String.fromCharCode(0x2715)}
                              </button>
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            ))}
        </div>
      )}
      {displayCount === 0 && queueCount === 0 && (
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

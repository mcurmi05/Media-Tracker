import WatchlistComponent from "../components/WatchlistComponent.jsx";
import BookTbrComponent from "../components/BookTbrComponent.jsx";
import ListComponent from "../components/ListComponent.jsx";
import AddToList from "../components/AddToList.jsx";
import "../styles/Log.css";
import "../styles/Toolbar.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWatchlist } from "../contexts/UserWatchlistContext.jsx";
import { useBookTbr } from "../contexts/UserBookTbrContext.jsx";
import { getBookInfo } from "../utils/bookInfo.js";
import SortByMenu from "../components/SortByMenu.jsx";
import ReleaseYearFilter from "../components/ReleaseYearFilter.jsx";
import DateAddedFilter from "../components/DateAddedFilter.jsx";
import Loader from "../components/Loader.jsx";
import { useImdbRatings } from "../contexts/ImdbRatingsContext.jsx";
import ExtraFiltersPanel from "../components/ExtraFiltersPanel.jsx";
import { useDebouncedValue } from "../utils/useDebouncedValue.js";
import {
  isTV,
  movieYear,
  bookYear,
  compareNums,
  yearInRange,
  addedInRange,
  imdbRatingFor,
  imdbVotesFor,
} from "../utils/mediaFilters.js";

const SORT_OPTIONS = [
  { value: "date", label: "Date Added" },
  { value: "year", label: "Release Date" },
  { value: "imdb", label: "IMDb Rating" },
  { value: "imdbVotes", label: "IMDb Votes" },
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
  const { ratings: imdbRatings } = useImdbRatings();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(
    location.state?.searchTerm || "",
  );
  // Debounced copy used for the (expensive) list/queue filtering so it doesn't
  // recompute on every keystroke; the input itself stays on searchTerm.
  const debouncedSearch = useDebouncedValue(searchTerm);
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
  const [genreFilter, setGenreFilter] = useState(location.state?.genreFilter || "all");
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const s = location.state || {};
    return (
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
    (newSeasonFilter ? 1 : 0) +
    (genreFilter !== "all" ? 1 : 0) +
    (yearFrom || yearTo ? 1 : 0) +
    (addedFrom || addedTo ? 1 : 0) +
    (sortKey !== "date" || sortDir !== "desc" ? 1 : 0);

  const goToRatings = () => {
    navigate("/ratings", {
      state: {
        debouncedSearch,
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

  const goToLog = () => {
    navigate("/log", {
      state: {
        debouncedSearch,
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

  //thin wrappers around the shared helpers so call sites stay short
  const yearMatchesFilter = (y) => yearInRange(y, yearFrom, yearTo);
  const addedMatchesFilter = (d) => addedInRange(d, addedFrom, addedTo);
  const compareNumeric = (a, b) => compareNums(a, b, sortDir);
  const imdbRatingOf = (mo) => imdbRatingFor(imdbRatings, mo);
  const imdbVotesOf = (mo) => imdbVotesFor(imdbRatings, mo);

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

  const availableGenres = useMemo(() => {
    const set = new Set();
    userWatchlist.forEach((w) => {
      (w.movie_object?.interests || []).forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [userWatchlist]);

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

  //which movie/tv queue category a watchlist item belongs to
  const queueCategoryOf = (m) => (isTV(m) ? "tv" : "movies");

  // Queue rows joined with their watchlist/book data, grouped by category and
  // each group ordered by queue_rank. Ranks are tracked per category, so movies,
  // TV, and books each start their numbering at 1.
  const queueByCategory = useMemo(() => {
    const groups = { movies: [], tv: [], books: [] };
    const term = debouncedSearch.trim().toLowerCase();
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
          if (term) {
            const info = getBookInfo(entry);
            const title = (info.title || "").toLowerCase();
            const author = (info.author || "").toLowerCase();
            if (!title.includes(term) && !author.includes(term)) return;
          }
          groups.books.push({
            queue_id: q.id,
            queue_rank: q.queue_rank,
            book_tbr_id: q.book_tbr_id,
            book: entry,
          });
        } else if (q.watchlist_id != null) {
          const entry = userWatchlist.find((w) => w.id === q.watchlist_id);
          if (!entry) return;
          if (term) {
            const title = (entry.movie_object?.primaryTitle || "").toLowerCase();
            if (!title.includes(term)) return;
          }
          groups[queueCategoryOf(entry.movie_object)].push({
            queue_id: q.id,
            queue_rank: q.queue_rank,
            watchlist_id: q.watchlist_id,
            movie: entry.movie_object,
          });
        }
      });
    return groups;
  }, [watchlistQueue, userWatchlist, userBookTbr, debouncedSearch]);

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
      const itemIsTV = isTV(item.movie_object);
      if (mediaTypeFilter === "movies" && itemIsTV) return false;
      if (mediaTypeFilter === "tv" && !itemIsTV) return false;
      if (debouncedSearch.trim()) {
        const title = item.movie_object?.primaryTitle || "";
        if (!title.toLowerCase().includes(debouncedSearch.toLowerCase()))
          return false;
      }
      if (genreFilter !== "all") {
        const genres = item.movie_object?.interests || [];
        if (!genres.includes(genreFilter)) return false;
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
    if (sortKey === "imdb" || sortKey === "imdbVotes") {
      const valOf = sortKey === "imdb" ? imdbRatingOf : imdbVotesOf;
      return filtered.sort((a, b) => {
        const rc = compareNumeric(valOf(a.movie_object), valOf(b.movie_object));
        if (rc !== 0) return rc;
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
    debouncedSearch,
    needsMovieData,
    sortKey,
    sortDir,
    yearFrom,
    yearTo,
    addedFrom,
    addedTo,
    imdbRatings,
  ]);

  const filteredBookTbr = useMemo(() => {
    if (!needsBookData) return [];
    if (newSeasonFilter) return [];
    if (genreFilter !== "all") return [];
    const filtered = userBookTbr.filter((item) => {
      if (queuedBookIds.has(item.id)) return false;
      if (debouncedSearch.trim()) {
        const search = debouncedSearch.toLowerCase();
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
    debouncedSearch,
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
      imdb: imdbRatingOf(item.movie_object),
      imdbVotes: imdbVotesOf(item.movie_object),
    }));
    const bookItems = filteredBookTbr.map((item) => ({
      kind: "book",
      id: `book-${item.id}`,
      data: item,
      date: new Date(item.created_at),
      year: bookYear(item),
      imdb: null,
      imdbVotes: null,
    }));
    return [...movieItems, ...bookItems].sort((a, b) => {
      if (sortKey === "year") {
        const yc = compareNumeric(a.year, b.year);
        if (yc !== 0) return yc;
      } else if (sortKey === "imdb") {
        const rc = compareNumeric(a.imdb, b.imdb);
        if (rc !== 0) return rc;
      } else if (sortKey === "imdbVotes") {
        const rc = compareNumeric(a.imdbVotes, b.imdbVotes);
        if (rc !== 0) return rc;
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
    <div className="page-stack">
      <h1 className="page-title">
        {isBooksView ? "Your TBR list" : "Your Watchlist"}
      </h1>
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
              {String.fromCharCode(0x2715)}
            </button>
          )}
        </div>
        <select
          className="toolbar-select"
          value={mediaTypeFilter}
          onChange={(e) => {
            const next = e.target.value;
            setMediaTypeFilter(next);
            if (next === "books" || next === "all") {
              setNewSeasonFilter(false);
            }
          }}
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
            setGenreFilter("all");
            setYearFrom("");
            setYearTo("");
            setAddedFrom("");
            setAddedTo("");
            setSortKey("date");
            setSortDir("desc");
            setNewSeasonFilter(false);
          }}
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
              className={`toolbar-btn${newSeasonFilter ? " toolbar-btn--active" : ""}`}
              onClick={() => {
                const next = !newSeasonFilter;
                setNewSeasonFilter(next);
                if (next) setMediaTypeFilter("tv");
                else setMediaTypeFilter("all");
              }}
            >
              New Season
            </button>
          )}
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
          onClick={goToLog}
          title="View log with these filters"
        >
          <img src="/log.png" alt="Go to Log" />
        </button>
        <span className="toolbar-count">{displayCount}</span>
      </div>
      {queueCount > 0 && (
        <div
          className="watchlist-queue"
          style={{
            boxSizing: "border-box",
            background: "#2a2a2a",
            border: "1px solid #2e2e2e",
            borderRadius: "14px",
            padding: "12px 8px 6px",
            /* pull out into the page's side padding so the queue uses a bit
               more horizontal space (esp. on mobile) */
            margin: "0 -24px 32px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
          }}
        >
          <div
            onClick={() => setQueueOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
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
              src="/demote.png"
              alt=""
              className={`queue-chevron${queueOpen ? " open" : ""}`}
              style={{ width: 14, height: 14, marginRight: "6px" }}
            />
          </div>
          <div className={`queue-body-wrap${queueOpen ? " open" : ""}`}>
          <div className="queue-body-inner">
          <div style={{ height: "16px" }} />
          {visibleQueueCount === 0 ? (
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
                          <ListComponent
                            movie_object={item.movie}
                            ratingDate={null}
                            betweenSlot={<AddToList movie={item.movie} />}
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
                            belowRank={
                              <button
                                onClick={() => removeFromQueue(item.queue_id)}
                                title="Remove from queue (keep in watchlist)"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#aaa",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  lineHeight: 1,
                                  padding: 0,
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
            )}
          </div>
          </div>
        </div>
      )}
      {displayCount === 0 && queueCount === 0 && (
        <div className="empty-msg">
          {searchTerm
            ? `No watchlist items found for "${searchTerm}"!`
            : "No watchlist items found!"}
        </div>
      )}
      <div className="list-col">
        {isAllView
          ? combinedAll.map((item) =>
              item.kind === "movie" ? (
                <div
                  key={item.id}
                  className="list-row"
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
                  className="list-row"
                >
                  <BookTbrComponent tbrEntry={item.data} />
                </div>
              ),
            )
          : isBooksView
            ? filteredBookTbr.map((entry) => (
                <div
                  key={entry.id}
                  className="list-row"
                >
                  <BookTbrComponent tbrEntry={entry} />
                </div>
              ))
            : filteredWatchlist.map((watchlist_entry) =>
                watchlist_entry.id ? (
                  <div
                    key={watchlist_entry.id}
                    className="list-row"
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

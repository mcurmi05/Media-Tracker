import { useRatings } from "../contexts/UserRatingsContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import Rating from "../components/Rating.jsx";
import BookRating from "../components/BookRating.jsx";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookInfo } from "../utils/bookInfo.js";
import SortByMenu from "../components/SortByMenu.jsx";
import ReleaseYearFilter from "../components/ReleaseYearFilter.jsx";
import DateAddedFilter from "../components/DateAddedFilter.jsx";
import Loader from "../components/Loader.jsx";
import { useImdbRatings } from "../contexts/ImdbRatingsContext.jsx";
import ExtraFiltersPanel from "../components/ExtraFiltersPanel.jsx";
import "../styles/Toolbar.css";
import { isTV, movieYear, bookYear, compareNums, yearInRange, addedInRange, imdbRatingFor, imdbVotesFor } from "../utils/mediaFilters.js";

const SORT_OPTIONS = [
  { value: "date", label: "Date Added" },
  { value: "year", label: "Release Date" },
  { value: "rating", label: "Rating" },
  { value: "imdb", label: "IMDb Rating" },
  { value: "imdbVotes", label: "IMDb Votes" },
];

function Ratings() {
  const { userRatings, userRatingsLoaded, updateRanking } = useRatings();
  const { bookRatings, bookRatingsLoaded, updateBookRanking } =
    useBookRatings();
  const { ratings: imdbRatings } = useImdbRatings();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(
    location.state?.searchTerm || "",
  );
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
  //rank mode: none | movies | tv | books
  const [rankModeType, setRankModeType] = useState("none");

  const activeFilterCount =
    (ratingFilter !== "all" ? 1 : 0) +
    (genreFilter !== "all" ? 1 : 0) +
    (yearFrom || yearTo ? 1 : 0) +
    (addedFrom || addedTo ? 1 : 0) +
    (sortKey !== "date" || sortDir !== "desc" ? 1 : 0);

  const goToLog = () => {
    navigate("/log", {
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

  //thin wrappers around the shared helpers so call sites stay short
  const yearMatchesFilter = (y) => yearInRange(y, yearFrom, yearTo);
  const addedMatchesFilter = (d) => addedInRange(d, addedFrom, addedTo);
  const compareNumeric = (a, b) => compareNums(a, b, sortDir);
  //live imdb rating/votes, falls back to whats on the movie object until the dataset loads
  const imdbRatingOf = (mo) => imdbRatingFor(imdbRatings, mo);
  const imdbVotesOf = (mo) => imdbVotesFor(imdbRatings, mo);

  const movieRatingValue = (r) => {
    const v = Number(r.rating);
    return Number.isFinite(v) ? v : null;
  };
  const bookRatingValue = (r) => {
    const v = Number(r.book_rating);
    return Number.isFinite(v) ? v : null;
  };

  const yearRange = useMemo(() => {
    const years = [];
    userRatings.forEach((r) => {
      const y = movieYear(r);
      if (y != null) years.push(y);
    });
    bookRatings.forEach((r) => {
      const y = bookYear(r);
      if (y != null) years.push(y);
    });
    const now = new Date().getFullYear();
    const max = years.length ? Math.max(now + 1, Math.max(...years)) : now + 1;
    return { min: 1500, max };
  }, [userRatings, bookRatings]);

  const availableGenres = useMemo(() => {
    const set = new Set();
    userRatings.forEach((r) => {
      (r.movie_object?.interests || []).forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [userRatings]);

  //rank mode forces the rating + media filters to match
  useEffect(() => {
    if (rankModeType === "movies") {
      setRatingFilter("10");
      setMediaTypeFilter("movies");
    } else if (rankModeType === "tv") {
      setRatingFilter("10");
      setMediaTypeFilter("tv");
    } else if (rankModeType === "books") {
      setRatingFilter("all");
      setMediaTypeFilter("books");
    }
  }, [rankModeType]);

  const handleRatingFilterChange = (newValue) => {
    setRatingFilter(newValue);
    if (
      (rankModeType === "movies" || rankModeType === "tv") &&
      newValue !== "10"
    ) {
      setRankModeType("none");
    }
  };

  //no early return before hooks, loading state renders in jsx
  const isTVItem = (item) => isTV(item.movie_object);

  const includeMoviesTV =
    mediaTypeFilter === "all" ||
    mediaTypeFilter === "moviesAndTV" ||
    mediaTypeFilter === "movies" ||
    mediaTypeFilter === "tv";
  const includeBooks =
    mediaTypeFilter === "all" || mediaTypeFilter === "books";

  const filteredRatings = userRatings.filter((rating) => {
    if (!includeMoviesTV) return false;
    const itemIsTV = isTVItem(rating);
    if (mediaTypeFilter === "movies" && itemIsTV) return false;
    if (mediaTypeFilter === "tv" && !itemIsTV) return false;
    if (searchTerm.trim()) {
      const title = rating.movie_object?.primaryTitle || "";
      if (!title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }
    if (ratingFilter !== "all") {
      if (Number(rating.rating) !== Number(ratingFilter)) return false;
    }
    if (genreFilter !== "all") {
      const genres = rating.movie_object?.interests || [];
      if (!genres.includes(genreFilter)) return false;
    }
    if (!yearMatchesFilter(movieYear(rating))) return false;
    if (!addedMatchesFilter(rating.created_at)) return false;
    return true;
  });

  // Compute 10s with ranking and default sort
  const allTens = useMemo(() => {
    return filteredRatings.filter((r) => Number(r.rating) === 10);
  }, [filteredRatings]);

  // Sort helper for rankings: rank asc (1..n), then created_at desc
  const rankSort = useCallback((a, b) => {
    const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
    const rb = b.ranking ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    // Same rank: show TV first, then movies
    const aIsTV = isTVItem(a);
    const bIsTV = isTVItem(b);
    if (aIsTV !== bIsTV) return aIsTV ? -1 : 1;
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return dateB - dateA;
  }, []);

  // Display list respects rank when filtering 10s, otherwise default date sort
  const sortedRatings = useMemo(() => {
    if (sortKey === "year") {
      return filteredRatings.slice().sort((a, b) => {
        const yc = compareNumeric(movieYear(a), movieYear(b));
        if (yc !== 0) return yc;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    if (sortKey === "rating") {
      return filteredRatings.slice().sort((a, b) => {
        const rc = compareNumeric(movieRatingValue(a), movieRatingValue(b));
        if (rc !== 0) return rc;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    if (sortKey === "imdb" || sortKey === "imdbVotes") {
      const valOf = sortKey === "imdb" ? imdbRatingOf : imdbVotesOf;
      return filteredRatings.slice().sort((a, b) => {
        const rc = compareNumeric(valOf(a.movie_object), valOf(b.movie_object));
        if (rc !== 0) return rc;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    if (ratingFilter === "10") {
      return [...allTens].sort(rankSort);
    }
    return filteredRatings.slice().sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortDir === "asc" ? dateA - dateB : dateB - dateA;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRatings, allTens, ratingFilter, rankSort, sortKey, sortDir, imdbRatings]);

  // Books: every row in book_ratings is a rated book
  const filteredBooks = useMemo(() => {
    if (!includeBooks) return [];
    if (genreFilter !== "all") return [];
    return bookRatings.filter((bookRating) => {
      if (searchTerm.trim()) {
        const info = getBookInfo(bookRating);
        const title = (info.title || "").toLowerCase();
        const author = (info.author || "").toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!title.includes(search) && !author.includes(search)) return false;
      }
      if (ratingFilter !== "all") {
        if (Number(bookRating.book_rating) !== Number(ratingFilter))
          return false;
      }
      if (!yearMatchesFilter(bookYear(bookRating))) return false;
      if (!addedMatchesFilter(bookRating.created_at)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookRatings, searchTerm, ratingFilter, includeBooks, yearFrom, yearTo, addedFrom, addedTo]);

  const bookSortDate = (b) => new Date(b.created_at);

  const bookRankSort = useCallback((a, b) => {
    const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
    const rb = b.ranking ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return bookSortDate(b) - bookSortDate(a);
  }, []);

  const sortedBooks = useMemo(() => {
    if (sortKey === "year") {
      return filteredBooks.slice().sort((a, b) => {
        const yc = compareNumeric(bookYear(a), bookYear(b));
        if (yc !== 0) return yc;
        return bookSortDate(b) - bookSortDate(a);
      });
    }
    if (sortKey === "rating") {
      return filteredBooks.slice().sort((a, b) => {
        const rc = compareNumeric(bookRatingValue(a), bookRatingValue(b));
        if (rc !== 0) return rc;
        return bookSortDate(b) - bookSortDate(a);
      });
    }
    if (rankModeType === "books") {
      return filteredBooks.slice().sort(bookRankSort);
    }
    return filteredBooks
      .slice()
      .sort((a, b) =>
        sortDir === "asc"
          ? bookSortDate(a) - bookSortDate(b)
          : bookSortDate(b) - bookSortDate(a),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBooks, rankModeType, bookRankSort, sortKey, sortDir]);

  // Move rank up/down among 10s by swapping ranking values and normalizing
  // Note: normalization handled implicitly by applyRankOrder indices

  const applyRankOrder = async (orderedIds) => {
    // Persist sequential rankings based on provided order of movie_entry_ids
    for (let i = 0; i < orderedIds.length; i++) {
      const entryId = orderedIds[i];
      await updateRanking(entryId, i + 1);
    }
  };

  const handleMove = async (entryId, direction) => {
    const tensSorted = [...allTens].sort(rankSort);
    const index = tensSorted.findIndex((r) => r.movie_entry_id === entryId);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= tensSorted.length) return;
    const ids = tensSorted.map((r) => r.movie_entry_id);
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    await applyRankOrder(ids);
  };

  const handleSendTop = async (entryId) => {
    const tensSorted = [...allTens].sort(rankSort);
    const index = tensSorted.findIndex((r) => r.movie_entry_id === entryId);
    if (index <= 0) return;
    const ids = tensSorted.map((r) => r.movie_entry_id);
    const [moved] = ids.splice(index, 1);
    ids.unshift(moved);
    await applyRankOrder(ids);
  };

  const handleSendBottom = async (entryId) => {
    const tensSorted = [...allTens].sort(rankSort);
    const index = tensSorted.findIndex((r) => r.movie_entry_id === entryId);
    if (index === -1 || index === tensSorted.length - 1) return;
    const ids = tensSorted.map((r) => r.movie_entry_id);
    const [moved] = ids.splice(index, 1);
    ids.push(moved);
    await applyRankOrder(ids);
  };

  // Book rank handlers operate on book log ids and persist via updateBookRanking
  const applyBookRankOrder = async (orderedIds) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await updateBookRanking(orderedIds[i], i + 1);
    }
  };

  // Rank reorder operates on all rated books (every row in book_ratings).
  const finishedSortedForRank = () => bookRatings.slice().sort(bookRankSort);

  const handleBookMove = async (bookId, direction) => {
    const sorted = finishedSortedForRank();
    const index = sorted.findIndex((b) => b.id === bookId);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    const ids = sorted.map((b) => b.id);
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    await applyBookRankOrder(ids);
  };

  const handleBookSendTop = async (bookId) => {
    const sorted = finishedSortedForRank();
    const index = sorted.findIndex((b) => b.id === bookId);
    if (index <= 0) return;
    const ids = sorted.map((b) => b.id);
    const [moved] = ids.splice(index, 1);
    ids.unshift(moved);
    await applyBookRankOrder(ids);
  };

  const handleBookSendBottom = async (bookId) => {
    const sorted = finishedSortedForRank();
    const index = sorted.findIndex((b) => b.id === bookId);
    if (index === -1 || index === sorted.length - 1) return;
    const ids = sorted.map((b) => b.id);
    const [moved] = ids.splice(index, 1);
    ids.push(moved);
    await applyBookRankOrder(ids);
  };

  const isBooksView = mediaTypeFilter === "books";
  const isAllView = mediaTypeFilter === "all";

  // Combined list for "All" view: ratings (movies + TV) and books interleaved by date
  const combinedAll = useMemo(() => {
    if (!isAllView) return null;
    const ratingItems = sortedRatings.map((r) => ({
      kind: "rating",
      id: `rating-${r.id || r.movie_entry_id}`,
      data: r,
      date: new Date(r.created_at),
      year: movieYear(r),
      rating: movieRatingValue(r),
    }));
    const bookItems = sortedBooks.map((b) => ({
      kind: "book",
      id: `book-${b.id}`,
      data: b,
      date: bookSortDate(b),
      year: bookYear(b),
      rating: bookRatingValue(b),
    }));
    return [...ratingItems, ...bookItems].sort((a, b) => {
      if (sortKey === "year") {
        const yc = compareNumeric(a.year, b.year);
        if (yc !== 0) return yc;
      } else if (sortKey === "rating") {
        const rc = compareNumeric(a.rating, b.rating);
        if (rc !== 0) return rc;
      } else if (sortKey === "date" && sortDir === "asc") {
        return a.date - b.date;
      }
      return b.date - a.date;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllView, sortedRatings, sortedBooks, sortKey, sortDir]);

  const displayCount = isAllView
    ? combinedAll.length
    : isBooksView
      ? sortedBooks.length
      : sortedRatings.length;
  const isLoading = isAllView
    ? !userRatingsLoaded || !bookRatingsLoaded
    : isBooksView
      ? !bookRatingsLoaded
      : !userRatingsLoaded;

  if (isLoading) return <Loader />;

  return (
    <div className="page-stack">
      <h1 className="page-title">Your Ratings</h1>
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
        >
          <select
            value={ratingFilter}
            onChange={(e) => handleRatingFilterChange(e.target.value)}
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

        {/*rank mode: pick what to reorder (single-select, so a dropdown)*/}
        <select
          className={`toolbar-select${
            rankModeType !== "none" ? " toolbar-select--active" : ""
          }`}
          value={rankModeType}
          onChange={(e) => {
            const value = e.target.value;
            setRankModeType(value);
            // Turning ranking off clears the rating + media filters that the
            // rank modes force on, back to their defaults.
            if (value === "none") {
              setRatingFilter("all");
              setMediaTypeFilter("all");
            }
          }}
          title="Reorder your top-ranked items"
        >
          <option value="none">Rank: Off</option>
          <option value="movies">Rank 10s Movies</option>
          <option value="tv">Rank 10s TV</option>
          <option value="books">Rank Books</option>
        </select>
        <button
          className="toolbar-icon-btn"
          onClick={goToWatchlist}
          title="View watchlist with these filters"
        >
          <img src="/watchlist-navbar.png" alt="Go to Watchlist" />
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
      {displayCount === 0 ? (
        <div className="empty-msg">
          {isAllView
            ? `No ratings found${searchTerm ? ` for "${searchTerm}"` : ""}!`
            : isBooksView
              ? `No rated books found${searchTerm ? ` for "${searchTerm}"` : ""}!`
              : `No ratings found for "${searchTerm}"!`}
        </div>
      ) : null}
      <div className="list-col">
        {isAllView
          ? combinedAll.map((item) =>
              item.kind === "rating" ? (
                <div
                  key={item.id}
                  className="list-row"
                >
                  <div className="div-wrapper-rating-testing">
                    <Rating
                      movie_object={item.data.movie_object}
                      ratingDate={item.data.created_at}
                      ratingUpdatedDate={item.data.updated_at}
                      ratingPreviousValue={item.data.previous_rating}
                      ratingAccurate={item.data.accurate}
                      rankNumber={
                        Number(item.data.rating) === 10
                          ? item.data.ranking
                          : null
                      }
                    />
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="list-row"
                >
                  <div className="div-wrapper-rating-testing">
                    <BookRating
                      bookLog={item.data}
                      rankNumber={item.data.ranking || null}
                    />
                  </div>
                </div>
              ),
            )
          : isBooksView
          ? sortedBooks.map((bookLog) => (
              <div
                key={bookLog.id}
                className="list-row"
              >
                <div className="div-wrapper-rating-testing">
                  <BookRating
                    bookLog={bookLog}
                    rankNumber={bookLog.ranking || null}
                    showRankControls={rankModeType === "books"}
                    onMoveUp={() => handleBookMove(bookLog.id, "up")}
                    onMoveDown={() => handleBookMove(bookLog.id, "down")}
                    onSendTop={() => handleBookSendTop(bookLog.id)}
                    onSendBottom={() => handleBookSendBottom(bookLog.id)}
                  />
                </div>
              </div>
            ))
          : sortedRatings.map((rating) => (
              <div
                key={rating.id || rating.movie_entry_id}
                className="list-row"
              >
                <div className="div-wrapper-rating-testing">
                  <Rating
                    movie_object={rating.movie_object}
                    ratingDate={rating.created_at}
                    ratingUpdatedDate={rating.updated_at}
                    ratingPreviousValue={rating.previous_rating}
                    ratingAccurate={rating.accurate}
                    rankNumber={
                      Number(rating.rating) === 10 ? rating.ranking : null
                    }
                    showRankControls={
                      rankModeType !== "none" && Number(rating.rating) === 10
                    }
                    onMoveUp={() => handleMove(rating.movie_entry_id, "up")}
                    onMoveDown={() => handleMove(rating.movie_entry_id, "down")}
                    onSendTop={() => handleSendTop(rating.movie_entry_id)}
                    onSendBottom={() => handleSendBottom(rating.movie_entry_id)}
                  />
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

export default Ratings;

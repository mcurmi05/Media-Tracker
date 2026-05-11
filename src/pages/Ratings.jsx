import { useRatings } from "../contexts/UserRatingsContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import Rating from "../components/Rating.jsx";
import BookRating from "../components/BookRating.jsx";
import AddBookLog from "../components/AddBookLog.jsx";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookInfo } from "../utils/bookInfo.js";

function Ratings() {
  const { userRatings, userRatingsLoaded, updateRanking } = useRatings();
  const { bookRatings, bookRatingsLoaded, updateBookRanking, rateBook } =
    useBookRatings();
  const [showAddBook, setShowAddBook] = useState(false);

  const handleAddRatedBook = async (payload) => {
    const { book_rating, ...book } = payload;
    await rateBook(book, book_rating);
  };
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
  // Rank mode: none | movies | tv | books
  const [rankModeType, setRankModeType] = useState("none");

  const goToLog = () => {
    navigate("/log", {
      state: { searchTerm, ratingFilter, mediaTypeFilter },
    });
  };

  const goToWatchlist = () => {
    navigate("/watchlist", {
      state: { searchTerm, mediaTypeFilter },
    });
  };

  // When rank mode is enabled, force rating filter and media filter appropriately
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

  // Avoid early return before hooks; we'll render a loading state in JSX

  // Helper to determine if an item is a TV show
  const isTVItem = (item) => {
    const type = (item.movie_object?.type || "").toLowerCase();
    const titleType = (item.movie_object?.titleType || "").toLowerCase();
    return (
      type.includes("tv") ||
      titleType.includes("tv") ||
      item.movie_object?.episodes
    );
  };

  const includeMoviesTV =
    mediaTypeFilter === "all" ||
    mediaTypeFilter === "moviesAndTV" ||
    mediaTypeFilter === "movies" ||
    mediaTypeFilter === "tv";
  const includeBooks =
    mediaTypeFilter === "all" || mediaTypeFilter === "books";

  const filteredRatings = userRatings.filter((rating) => {
    if (!includeMoviesTV) return false;
    const type = (rating.movie_object?.type || "").toLowerCase();
    const titleType = (rating.movie_object?.titleType || "").toLowerCase();
    const isTV =
      type.includes("tv") ||
      titleType.includes("tv") ||
      rating.movie_object?.episodes;
    if (mediaTypeFilter === "movies" && isTV) return false;
    if (mediaTypeFilter === "tv" && !isTV) return false;
    // Filter by search term
    if (searchTerm.trim()) {
      const title = rating.movie_object?.primaryTitle || "";
      if (!title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }
    // Filter by rating value
    if (ratingFilter !== "all") {
      if (Number(rating.rating) !== Number(ratingFilter)) return false;
    }
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
    if (ratingFilter === "10") {
      return [...allTens].sort(rankSort);
    }
    return filteredRatings.slice().sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });
  }, [filteredRatings, allTens, ratingFilter, rankSort]);

  // Books: every row in book_ratings is a rated book
  const filteredBooks = useMemo(() => {
    if (!includeBooks) return [];
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
      return true;
    });
  }, [bookRatings, searchTerm, ratingFilter, includeBooks]);

  const bookSortDate = (b) => new Date(b.created_at);

  const bookRankSort = useCallback((a, b) => {
    const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
    const rb = b.ranking ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return bookSortDate(b) - bookSortDate(a);
  }, []);

  const sortedBooks = useMemo(() => {
    if (rankModeType === "books") {
      return filteredBooks.slice().sort(bookRankSort);
    }
    return filteredBooks
      .slice()
      .sort((a, b) => bookSortDate(b) - bookSortDate(a));
  }, [filteredBooks, rankModeType, bookRankSort]);

  // Move rank up/down among 10s by swapping ranking values and normalizing
  // Note: normalization handled implicitly by applyRankOrder indices

  const applyRankOrder = async (orderedIds) => {
    // Persist sequential rankings based on provided order of imdb ids
    for (let i = 0; i < orderedIds.length; i++) {
      const imdb = orderedIds[i];
      await updateRanking(imdb, i + 1);
    }
  };

  const handleMove = async (imdbId, direction) => {
    const tensSorted = [...allTens].sort(rankSort);
    const index = tensSorted.findIndex((r) => r.imdb_movie_id === imdbId);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= tensSorted.length) return;
    const ids = tensSorted.map((r) => r.imdb_movie_id);
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    await applyRankOrder(ids);
  };

  const handleSendTop = async (imdbId) => {
    const tensSorted = [...allTens].sort(rankSort);
    const index = tensSorted.findIndex((r) => r.imdb_movie_id === imdbId);
    if (index <= 0) return;
    const ids = tensSorted.map((r) => r.imdb_movie_id);
    const [moved] = ids.splice(index, 1);
    ids.unshift(moved);
    await applyRankOrder(ids);
  };

  const handleSendBottom = async (imdbId) => {
    const tensSorted = [...allTens].sort(rankSort);
    const index = tensSorted.findIndex((r) => r.imdb_movie_id === imdbId);
    if (index === -1 || index === tensSorted.length - 1) return;
    const ids = tensSorted.map((r) => r.imdb_movie_id);
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
      id: `rating-${r.id || r.imdb_movie_id}`,
      data: r,
      date: new Date(r.created_at),
    }));
    const bookItems = sortedBooks.map((b) => ({
      kind: "book",
      id: `book-${b.id}`,
      data: b,
      date: bookSortDate(b),
    }));
    return [...ratingItems, ...bookItems].sort((a, b) => b.date - a.date);
  }, [isAllView, sortedRatings, sortedBooks]);

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
      <h1 style={{ textAlign: "center", marginTop: "-20px" }}>Your Ratings</h1>
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
              ×
            </button>
          )}
        </div>
        <select
          value={mediaTypeFilter}
          onChange={(e) => setMediaTypeFilter(e.target.value)}
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
        <select
          value={ratingFilter}
          onChange={(e) => handleRatingFilterChange(e.target.value)}
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
          <option value="all" style={{ whiteSpace: "nowrap" }}>
            All Ratings
          </option>
          {[...Array(10)].map((_, i) => (
            <option key={10 - i} value={10 - i}>
              {10 - i}
            </option>
          ))}
        </select>

        {/* Rank mode toggles */}
        {[
          { value: "movies", label: "Rank 10s Movies" },
          { value: "tv", label: "Rank 10s TV" },
          { value: "books", label: "Rank Books" },
        ].map(({ value, label }) => {
          const active = rankModeType === value;
          return (
            <button
              key={value}
              onClick={() => setRankModeType(active ? "none" : value)}
              style={{
                height: "32px",
                boxSizing: "border-box",
                padding: "0 12px",
                border:
                  (active ? "2px" : "1px") +
                  " solid " +
                  (active ? "#ffffff" : "#cccccc"),
                borderRadius: "6px",
                backgroundColor: active ? "#e50914" : "#3b3b3b",
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
              {label}
            </button>
          );
        })}
        {(mediaTypeFilter === "books" || mediaTypeFilter === "all") && (
          <button
            onClick={() => setShowAddBook(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              margin: "6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              outline: "none",
            }}
            title="Add Rated Book"
          >
            <img
              src="/addbookicon.png"
              alt="Add Rated Book"
              style={{ width: 22, height: 22 }}
            />
          </button>
        )}
        <button
          onClick={goToWatchlist}
          title="View watchlist with these filters"
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
            src="/watchlist-navbar.png"
            alt="Go to Watchlist"
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
      {isLoading ? (
        <div style={{ textAlign: "center" }}>Loading...</div>
      ) : displayCount === 0 ? (
        <div style={{ textAlign: "center" }}>
          {isAllView
            ? `No ratings found${searchTerm ? ` for "${searchTerm}"` : ""}!`
            : isBooksView
              ? `No rated books found${searchTerm ? ` for "${searchTerm}"` : ""}!`
              : `No ratings found for "${searchTerm}"!`}
        </div>
      ) : null}
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
              item.kind === "rating" ? (
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
                  <div className="div-wrapper-rating-testing">
                    <Rating
                      movie_object={item.data.movie_object}
                      ratingDate={item.data.created_at}
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
                  style={{
                    marginBottom: "1rem",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
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
                style={{
                  marginBottom: "1rem",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
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
                key={rating.id || rating.imdb_movie_id}
                style={{
                  marginBottom: "1rem",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div className="div-wrapper-rating-testing">
                  <Rating
                    movie_object={rating.movie_object}
                    ratingDate={rating.created_at}
                    rankNumber={
                      Number(rating.rating) === 10 ? rating.ranking : null
                    }
                    showRankControls={
                      rankModeType !== "none" && Number(rating.rating) === 10
                    }
                    onMoveUp={() => handleMove(rating.imdb_movie_id, "up")}
                    onMoveDown={() => handleMove(rating.imdb_movie_id, "down")}
                    onSendTop={() => handleSendTop(rating.imdb_movie_id)}
                    onSendBottom={() => handleSendBottom(rating.imdb_movie_id)}
                  />
                </div>
              </div>
            ))}
      </div>
      <AddBookLog
        isOpen={showAddBook}
        onClose={() => setShowAddBook(false)}
        title="Add Rated Book"
        submitLabel="Add Rating"
        onCreate={handleAddRatedBook}
        requireRating
      />
    </div>
  );
}

export default Ratings;

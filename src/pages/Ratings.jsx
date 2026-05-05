import { useRatings } from "../contexts/UserRatingsContext.jsx";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import Rating from "../components/Rating.jsx";
import BookRating from "../components/BookRating.jsx";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Ratings() {
  const { userRatings, userRatingsLoaded, updateRanking } = useRatings();
  const { bookLogs, bookLogsLoaded, updateBookRanking } = useBookLogs();
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

  const filteredRatings = userRatings.filter((rating) => {
    // Filter by media type (movie/tv)
    if (mediaTypeFilter !== "all") {
      const type = (rating.movie_object?.type || "").toLowerCase();
      const titleType = (rating.movie_object?.titleType || "").toLowerCase();
      const isTV =
        type.includes("tv") ||
        titleType.includes("tv") ||
        rating.movie_object?.episodes;
      if (mediaTypeFilter === "movies" && isTV) return false;
      if (mediaTypeFilter === "tv" && !isTV) return false;
    }
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

  // Books: only those with a non-null rating
  const filteredBooks = useMemo(() => {
    return bookLogs.filter((bookLog) => {
      if (!bookLog.book_rating || Number(bookLog.book_rating) === 0)
        return false;
      if (searchTerm.trim()) {
        const title = (bookLog.title || "").toLowerCase();
        const author = (bookLog.author || "").toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!title.includes(search) && !author.includes(search)) return false;
      }
      if (ratingFilter !== "all") {
        if (Number(bookLog.book_rating) !== Number(ratingFilter)) return false;
      }
      return true;
    });
  }, [bookLogs, searchTerm, ratingFilter]);

  const bookSortDate = (b) =>
    new Date(b.end_date || b.start_date || b.created_at);

  const bookRankSort = useCallback((a, b) => {
    const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
    const rb = b.ranking ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return bookSortDate(b) - bookSortDate(a);
  }, []);

  const sortedBooks = useMemo(() => {
    if (rankModeType === "books") {
      return filteredBooks
        .filter((b) => b.end_date != null)
        .sort(bookRankSort);
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

  // Rank reorder operates on finished books only (the ones visible in Rank Books).
  const finishedSortedForRank = () =>
    bookLogs.filter((b) => b.end_date != null).sort(bookRankSort);

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
  const displayCount = isBooksView ? sortedBooks.length : sortedRatings.length;
  const isLoading = isBooksView ? !bookLogsLoaded : !userRatingsLoaded;

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
          <option value="all">Movies & TV</option>
          <option value="movies">Movies</option>
          <option value="tv">TV</option>
          <option value="books">Books</option>
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
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
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#3b3b3b",
            color: "#ffffff",
            padding: "6px 10px",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            margin: "6px",
            fontSize: "0.85rem",
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={rankModeType === "movies"}
            onChange={(e) =>
              setRankModeType(e.target.checked ? "movies" : "none")
            }
          />
          Rank 10s Movies
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#3b3b3b",
            color: "#ffffff",
            padding: "6px 10px",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            margin: "6px",
            fontSize: "0.85rem",
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={rankModeType === "tv"}
            onChange={(e) => setRankModeType(e.target.checked ? "tv" : "none")}
          />
          Rank 10s TV
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#3b3b3b",
            color: "#ffffff",
            padding: "6px 10px",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            margin: "6px",
            fontSize: "0.85rem",
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={rankModeType === "books"}
            onChange={(e) =>
              setRankModeType(e.target.checked ? "books" : "none")
            }
          />
          Rank Books
        </label>
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
          {isBooksView
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
        {isBooksView
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
    </div>
  );
}

export default Ratings;

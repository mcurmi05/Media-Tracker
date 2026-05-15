import LogComponent from "../components/LogComponent.jsx";
import { useRatings } from "../contexts/UserRatingsContext.jsx";
import "../styles/Log.css";
import { useLogs } from "../contexts/UserLogsContext.jsx";
import { useBookLogs } from "../contexts/UserBookLogsContext.jsx";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import BookLogCard from "../components/BookLogCard.jsx";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookInfo } from "../utils/bookInfo.js";
//
function Log() {
  const { userLogs, userLogsLoaded } = useLogs();
  const { bookLogs, bookLogsLoaded } = useBookLogs();
  const { userRatings } = useRatings();
  const { findRatingForBook } = useBookRatings();
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

  const goToRatings = () => {
    navigate("/ratings", {
      state: { searchTerm, ratingFilter, mediaTypeFilter },
    });
  };

  const goToWatchlist = () => {
    navigate("/watchlist", {
      state: { searchTerm, mediaTypeFilter },
    });
  };

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

  if (needsMovieData && !userLogsLoaded) {
    return (
      <>
        <h1 style={{ alignSelf: "center", marginTop: "-20px" }}>Your Log</h1>
        <div style={{ alignSelf: "center" }}>Loading log...</div>
      </>
    );
  }

  if (needsBookData && !bookLogsLoaded) {
    return (
      <>
        <h1 style={{ alignSelf: "center", marginTop: "-20px" }}>Your Log</h1>
        <div style={{ alignSelf: "center" }}>Loading book logs...</div>
      </>
    );
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
  const filteredBookLogs = needsBookData
    ? bookLogs
        .filter((bookLog) => {
          if (searchTerm.trim()) {
            const info = getBookInfo(bookLog);
            const title = info.title || "";
            const author = info.author || "";
            if (
              !title.toLowerCase().includes(searchTerm.toLowerCase()) &&
              !author.toLowerCase().includes(searchTerm.toLowerCase())
            ) {
              return false;
            }
          }
          if (ratingFilter !== "all") {
            const rating = findRatingForBook(bookLog)?.book_rating ?? null;
            if (rating == null) return false;
            if (Number(rating) !== Number(ratingFilter)) return false;
          }
          return true;
        })
        .sort((a, b) => getMostRecentBookDate(b) - getMostRecentBookDate(a))
    : [];

  const filteredLogs = needsMovieData
    ? userLogs
        .filter((log) => {
          const type = (log.movie_object?.type || "").toLowerCase();
          const titleType = (log.movie_object?.titleType || "").toLowerCase();
          const isTV =
            type.includes("tv") ||
            titleType.includes("tv") ||
            log.movie_object?.episodes;
          if (mediaTypeFilter === "movies" && isTV) return false;
          if (mediaTypeFilter === "tv" && !isTV) return false;
          // "all" and "moviesAndTV" include both movies and TV
          if (searchTerm.trim()) {
            const title = log.movie_object?.primaryTitle || "";
            if (!title.toLowerCase().includes(searchTerm.toLowerCase()))
              return false;
          }
          if (ratingFilter !== "all") {
            let ratingValue = null;
            if (log.movie_object && log.movie_object.id) {
              const found = userRatings.find(
                (r) => r.imdb_movie_id === log.movie_object.id,
              );
              if (found) ratingValue = found.rating;
            }
            if (ratingValue === null) return false;
            if (Number(ratingValue) !== Number(ratingFilter)) return false;
          }
          return true;
        })
        .sort((a, b) => getMostRecentDate(b) - getMostRecentDate(a))
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
          })),
          ...filteredBookLogs.map((bookLog) => ({
            kind: "book",
            id: `book-${bookLog.id}`,
            data: bookLog,
            date: getMostRecentBookDate(bookLog),
          })),
        ].sort((a, b) => b.date - a.date)
      : null;

  const displayCount =
    mediaTypeFilter === "all"
      ? combinedAllItems.length
      : mediaTypeFilter === "books"
        ? filteredBookLogs.length
        : filteredLogs.length;

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
      <h1 style={{ textAlign: "center", marginTop: "-20px" }}>Your Log</h1>
      <div style={{ height: "18px" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          gap: "8px",
          flexWrap: "wrap",
          padding: "0 10px",
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
              width: "min(180px, 40vw)",
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
          onChange={(e) => setRatingFilter(e.target.value)}
          style={{
            height: "32px",
            padding: "0 10px",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            backgroundColor: "#3b3b3b",
            color: "#ffffff",
            fontSize: "0.8rem",
            fontweight: "bold",
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
      {mediaTypeFilter === "all" ? (
        // Combined view: movies, TV, and books interleaved by date
        <>
          {combinedAllItems.length === 0 && (
            <div style={{ textAlign: "center" }}>
              No logs match your applied filters
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
            {combinedAllItems.map((item) =>
              item.kind === "log" ? (
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
                  <LogComponent
                    log_id={item.data.id}
                    created_at={item.data.created_at}
                    movie={item.data.movie_object}
                    logtext={item.data.log}
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
            <div style={{ textAlign: "center" }}>
              {bookLogs.length === 0
                ? "No book logs yet. Add your first book!"
                : "No book logs match your applied filters"}
            </div>
          )}
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            {filteredBookLogs.map((bookLog) => (
              <BookLogCard key={bookLog.id} bookLog={bookLog} />
            ))}
          </div>
        </>
      ) : (
        // Movie/TV logs section
        <>
          {filteredLogs.length === 0 && (
            <div style={{ textAlign: "center" }}>
              No logs match your applied filters
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
            {filteredLogs.map((log) =>
              log.id ? (
                <div
                  key={log.id}
                  style={{
                    marginBottom: "1rem",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <LogComponent
                    log_id={log.id}
                    created_at={log.created_at}
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

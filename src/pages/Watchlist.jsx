import WatchlistComponent from "../components/WatchlistComponent.jsx";
import BookTbrComponent from "../components/BookTbrComponent.jsx";
import "../styles/Log.css";
import { useEffect, useMemo, useState } from "react";
import { useWatchlist } from "../contexts/UserWatchlistContext.jsx";
import { useBookTbr } from "../contexts/UserBookTbrContext.jsx";

function Watchlist() {
  const { userWatchlist, userWatchlistLoaded } = useWatchlist();
  const { userBookTbr, userBookTbrLoaded } = useBookTbr();
  const [searchTerm, setSearchTerm] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [newSeasonFilter, setNewSeasonFilter] = useState(false);

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
    return userWatchlist.filter((item) => {
      if (newSeasonFilter && !item.new_season_to_watch) return false;
      const type = (item.movie_object?.type || "").toLowerCase();
      const titleType = (item.movie_object?.titleType || "").toLowerCase();
      const isTV =
        type.includes("tv") ||
        titleType.includes("tv") ||
        item.movie_object?.episodes;
      if (mediaTypeFilter === "movies" && isTV) return false;
      if (mediaTypeFilter === "tv" && !isTV) return false;
      if (!searchTerm.trim()) return true;
      const title = item.movie_object?.primaryTitle || "";
      return title.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [userWatchlist, newSeasonFilter, mediaTypeFilter, searchTerm, needsMovieData]);

  const filteredBookTbr = useMemo(() => {
    if (!needsBookData) return [];
    if (newSeasonFilter) return [];
    return userBookTbr.filter((item) => {
      if (!searchTerm.trim()) return true;
      const search = searchTerm.toLowerCase();
      const title = (item.title || "").toLowerCase();
      const author = (item.author || "").toLowerCase();
      return title.includes(search) || author.includes(search);
    });
  }, [userBookTbr, newSeasonFilter, searchTerm, needsBookData]);

  const isAllView = mediaTypeFilter === "all";
  const isBooksView = mediaTypeFilter === "books";

  const combinedAll = useMemo(() => {
    if (!isAllView) return null;
    const movieItems = filteredWatchlist.map((item) => ({
      kind: "movie",
      id: `movie-${item.id}`,
      data: item,
      date: new Date(item.created_at),
    }));
    const bookItems = filteredBookTbr.map((item) => ({
      kind: "book",
      id: `book-${item.id}`,
      data: item,
      date: new Date(item.created_at),
    }));
    return [...movieItems, ...bookItems].sort((a, b) => b.date - a.date);
  }, [isAllView, filteredWatchlist, filteredBookTbr]);

  const displayCount = isAllView
    ? combinedAll.length
    : isBooksView
      ? filteredBookTbr.length
      : filteredWatchlist.length;

  if (isLoading) {
    return (
      <>
        <h1 style={{ alignSelf: "center", marginTop: "-20px" }}>
          Your Watchlist
        </h1>
        <div style={{ alignSelf: "center" }}>Loading watchlist...</div>
      </>
    );
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
        Your Watchlist
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
            {"★"} New Season
          </button>
        )}
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

import WatchlistComponent from "../components/WatchlistComponent.jsx";
import "../styles/Log.css";
import { useEffect, useState } from "react";
import { useWatchlist } from "../contexts/UserWatchlistContext.jsx";

function Watchlist() {
  const { userWatchlist, userWatchlistLoaded } = useWatchlist();
  const [searchTerm, setSearchTerm] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [newSeasonFilter, setNewSeasonFilter] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  if (!userWatchlistLoaded) {
    return (
      <>
        <h1 style={{ alignSelf: "center", marginTop: "-20px" }}>
          Your Watchlist
        </h1>
        <div style={{ alignSelf: "center" }}>Loading watchlist...</div>
      </>
    );
  }

  const filteredWatchlist = userWatchlist.filter((item) => {
    // Filter by new season
    if (newSeasonFilter && !item.new_season_to_watch) return false;
    // Filter by media type
    if (mediaTypeFilter !== "all") {
      const type = (item.movie_object?.type || "").toLowerCase();
      const titleType = (item.movie_object?.titleType || "").toLowerCase();
      const isTV =
        type.includes("tv") ||
        titleType.includes("tv") ||
        item.movie_object?.episodes;
      if (mediaTypeFilter === "movies" && isTV) return false;
      if (mediaTypeFilter === "tv" && !isTV) return false;
    }
    if (!searchTerm.trim()) return true;
    const title = item.movie_object?.primaryTitle || "";
    return title.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
              ✕
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
        </select>
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
          {"\u2605"} New Season
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
          {filteredWatchlist.length}
        </span>
      </div>
      {filteredWatchlist.length === 0 && (
        <div style={{ textAlign: "center" }}>
          No watchlist items found for "{searchTerm}"!
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
        {filteredWatchlist.map((watchlist_entry) =>
          watchlist_entry.id ? (
            <div
              style={{
                marginBottom: "1rem",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <WatchlistComponent
                key={watchlist_entry.id}
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

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSearch } from "../contexts/SearchContext";
import "../styles/Search.css";
import MovieCard from "../components/MovieCard.jsx";
import BookCard from "../components/BookCard.jsx";
import Loader from "../components/Loader.jsx";
import { searchMovies } from "../services/api";
import {
  searchBookEntries,
  getAllBookEntries,
} from "../services/ratingsfromtable.js";

function parseSeries(title) {
  const match = (title || "").match(
    /^(.*?)\s*\(([^()]+?)[,\s]*#([^()]+?)\)\s*$/,
  );
  if (!match) return { name: null, indexNum: Number.POSITIVE_INFINITY };
  const idxRaw = match[3].trim();
  const idxNum = parseFloat(idxRaw);
  return {
    name: match[2].trim(),
    indexNum: Number.isFinite(idxNum) ? idxNum : Number.POSITIVE_INFINITY,
  };
}

function compareStrings(a, b) {
  return (a || "").localeCompare(b || "", undefined, { sensitivity: "base" });
}

function Search() {
  const {
    searchResults,
    setSearchResults,
    searchError,
    setSearchError,
    searchLoading,
    setSearchLoading,
    setSearchQuery,
    setSearchMode,
  } = useSearch();

  const location = useLocation();
  const [resultsMode, setResultsMode] = useState(null);
  const [bookSort, setBookSort] = useState("series");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("q") || "";
    const mode = params.get("mode") === "books" ? "books" : "movies";
    setSearchQuery(query);
    setSearchMode(mode);

    const trimmed = query.trim();
    if (trimmed || mode === "books") {
      setSearchLoading(true);
      const fetcher =
        mode === "books"
          ? trimmed
            ? searchBookEntries(trimmed)
            : getAllBookEntries()
          : searchMovies(trimmed);
      Promise.resolve(fetcher)
        .then((results) => {
          setSearchResults(results || []);
          setResultsMode(mode);
          setSearchError(null);
        })
        .catch(() => {
          setSearchResults([]);
          setResultsMode(mode);
          setSearchError(
            mode === "books"
              ? "Failed to search books"
              : "Failed to search movies",
          );
        })
        .finally(() => {
          setSearchLoading(false);
        });
    } else {
      setSearchResults([]);
      setResultsMode(null);
    }
  }, [
    location.search,
    setSearchQuery,
    setSearchResults,
    setSearchLoading,
    setSearchError,
    setSearchMode,
  ]);

  const isBooks = resultsMode === "books";

  const sortedBooks = useMemo(() => {
    if (!isBooks || !searchResults) return searchResults || [];
    const arr = [...searchResults];
    if (bookSort === "author") {
      arr.sort((a, b) => compareStrings(a.author, b.author) || compareStrings(a.title, b.title));
    } else if (bookSort === "dateAddedNewest" || bookSort === "dateAddedOldest") {
      const newestFirst = bookSort === "dateAddedNewest";
      arr.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return newestFirst ? db - da : da - db;
      });
    } else if (bookSort === "series") {
      arr.sort((a, b) => {
        const sa = parseSeries(a.title);
        const sb = parseSeries(b.title);
        if (sa.name && sb.name) {
          const byName = compareStrings(sa.name, sb.name);
          if (byName !== 0) return byName;
          return sa.indexNum - sb.indexNum;
        }
        if (sa.name && !sb.name) return -1;
        if (!sa.name && sb.name) return 1;
        return compareStrings(a.title, b.title);
      });
    } else {
      arr.sort((a, b) => compareStrings(a.title, b.title));
    }
    return arr;
  }, [isBooks, searchResults, bookSort]);

  return (
    <div className="search">
      {searchError && <div className="error-message">{searchError}</div>}
      {isBooks && !searchLoading && searchResults && searchResults.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0 0 1rem 0",
          }}
        >
          <select
            value={bookSort}
            onChange={(e) => setBookSort(e.target.value)}
            aria-label="Sort books"
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
            <option value="title">Sort: Title (A-Z)</option>
            <option value="author">Sort: Author (A-Z)</option>
            <option value="series">Sort: Series</option>
            <option value="dateAddedNewest">Sort: Date Added (newest)</option>
            <option value="dateAddedOldest">Sort: Date Added (oldest)</option>
          </select>
        </div>
      )}
      {searchLoading ? (
        <Loader />
      ) : searchResults && searchResults.length > 0 ? (
        <div className="movies-grid movies-grid--posters">
          {isBooks
            ? sortedBooks.map((book) => (
                <BookCard book={book} posterOnly key={book.id} />
              ))
            : searchResults.map((movie) => (
                <MovieCard
                  movie={movie}
                  posterOnly={true}
                  key={`${movie.media_type}-${movie.tmdb_id}`}
                />
              ))}
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          {isBooks
            ? "Use the search bar to search your book library!"
            : "Use the search bar to search for movies or shows!"}
        </div>
      )}
    </div>
  );
}

export default Search;

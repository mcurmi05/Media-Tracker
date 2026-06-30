import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSearch } from "../contexts/SearchContext";
import "../styles/Search.css";
import MovieCard from "../components/MovieCard.jsx";
import BookCard from "../components/BookCard.jsx";
import Loader from "../components/Loader.jsx";
import {
  combineSearchResults,
  searchBooksHardcover,
  searchMovies,
} from "../services/api";

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("q") || "";
    const requestedMode = params.get("mode");
    const mode = ["all", "books", "movies", "tv"].includes(requestedMode)
      ? requestedMode
      : "all";
    setSearchQuery(query);
    setSearchMode(mode);

    const trimmed = query.trim();
    if (trimmed) {
      setSearchLoading(true);
      const fetcher =
        mode === "all"
          ? Promise.all([
              searchBooksHardcover(trimmed),
              searchMovies(trimmed, "movie"),
              searchMovies(trimmed, "tv"),
            ]).then(([books, movies, tv]) =>
              combineSearchResults(trimmed, books, movies, tv),
            )
          : mode === "books"
            ? searchBooksHardcover(trimmed)
            : searchMovies(trimmed, mode);
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
              : `Failed to search ${mode === "tv" ? "TV shows" : "movies"}`,
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

  return (
    <div className="search">
      {searchError && <div className="error-message">{searchError}</div>}
      {searchLoading ? (
        <Loader />
      ) : searchResults && searchResults.length > 0 ? (
        <div className="movies-grid movies-grid--posters">
          {searchResults.map((item) =>
            item.hardcover_id != null ? (
                <BookCard
                  book={item}
                  posterOnly
                  key={`book-${item.hardcover_id || item.id}`}
                />
              ) : (
                <MovieCard
                  movie={item}
                  posterOnly={true}
                  key={`${item.media_type}-${item.tmdb_id}`}
                />
              ),
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          {isBooks
            ? "Use the search bar to search Hardcover!"
            : "Use the search bar to search for movies or shows!"}
        </div>
      )}
    </div>
  );
}

export default Search;

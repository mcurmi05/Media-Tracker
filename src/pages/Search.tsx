import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSearch } from "../contexts/SearchContext";
import "../styles/search/Search.css";
import MovieCard from "../components/media/MovieCard";
import BookCard from "../components/books/BookCard";
import Loader from "../components/layout/Loader";
import { useLoggedLookup } from "../hooks/useLoggedLookup";
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
  const { isLogged } = useLoggedLookup();
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
    // A trailing 4-digit year filters results to just that year. The year is
    // stripped from the term that's actually searched (e.g. "Dune 2021").
    const yearMatch = trimmed.match(/^(.*\S)\s+((?:19|20)\d{2})$/);
    const yearFilter = yearMatch ? Number(yearMatch[2]) : null;
    const term = yearMatch ? yearMatch[1].trim() : trimmed;
    const matchesYear = (it) => {
      if (yearFilter == null) return true;
      const y = it.hardcover_id != null ? it.release_year : it.startYear;
      return Number(y) === yearFilter;
    };
    if (term) {
      setSearchLoading(true);
      const fetcher =
        mode === "all"
          ? Promise.all([
              searchBooksHardcover(term),
              searchMovies(term, "movie"),
              searchMovies(term, "tv"),
            ]).then(([books, movies, tv]) =>
              combineSearchResults(term, books, movies, tv),
            )
          : mode === "books"
            ? searchBooksHardcover(term)
            : searchMovies(term, mode);
      Promise.resolve(fetcher)
        .then((results) => {
          setSearchResults((results || []).filter(matchesYear));
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
                  logged={isLogged(item)}
                  key={`book-${item.hardcover_id || item.id}`}
                />
              ) : (
                <MovieCard
                  movie={item}
                  posterOnly={true}
                  logged={isLogged(item)}
                  key={`${item.media_type}-${item.tmdb_id}`}
                />
              ),
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div>
            {isBooks
              ? "Use the search bar to search Hardcover!"
              : "Use the search bar to search for movies or shows!"}
          </div>
          <div
            style={{
              marginTop: "8px",
              fontSize: "0.85rem",
              color: "var(--muted-foreground)",
            }}
          >
            Tip: add a year to filter to it, e.g. “Dune 2021”.
          </div>
        </div>
      )}
    </div>
  );
}

export default Search;

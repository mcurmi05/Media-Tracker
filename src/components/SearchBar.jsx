import { useState, useEffect, useRef } from "react";
import {
  searchBooksHardcoverFIRSTFIVEONLY,
  searchMoviesFIRSTFIVEONLY,
  combineSearchResults,
  findByImdbId,
} from "../services/api.js";
import { useSearch } from "../contexts/SearchContext";
import { useNavigate } from "react-router-dom";
import "../styles/SearchBar.css";

export default function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    searchLoading,
    setSearchLoading,
    searchMode,
    setSearchMode,
  } = useSearch();

  const [dropdownResults, setDropdownResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (searchQuery.trim().length > 1 && !searchSubmitted) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const delay = searchMode === "books" ? 300 : 1000;
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          let results;
          if (searchMode === "all") {
            const [books, movies, tv] = await Promise.all([
              searchBooksHardcoverFIRSTFIVEONLY(searchQuery),
              searchMoviesFIRSTFIVEONLY(searchQuery, "movie"),
              searchMoviesFIRSTFIVEONLY(searchQuery, "tv"),
            ]);
            results = combineSearchResults(
              searchQuery,
              books,
              movies,
              tv,
            ).slice(0, 5);
          } else {
            results =
              searchMode === "books"
                ? await searchBooksHardcoverFIRSTFIVEONLY(searchQuery)
                : await searchMoviesFIRSTFIVEONLY(searchQuery, searchMode);
          }
          if (cancelled) return;
          setDropdownResults(results || []);
          setShowDropdown(true);
        } catch (err) {
          if (cancelled) return;
          console.log("Search error:", err);
          setDropdownResults([]);
          setShowDropdown(true);
        }
      }, delay);
    } else {
      setShowDropdown(false);
      setDropdownResults([]);
    }

    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchSubmitted, searchMode, setSearchLoading]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    setShowDropdown(false);
    setSearchSubmitted(true);

    if (searchMode !== "books") {
      const imdbIdMatch = searchQuery
        .trim()
        .match(/(?:imdb\.com\/title\/)?(tt\d+)/i);
      if (imdbIdMatch) {
        const found = await findByImdbId(imdbIdMatch[1]);
        if (found?.tmdb_id) {
          navigate(`/mediadetails/${found.media_type}/${found.tmdb_id}`);
          return;
        }
      }
    }

    setSearchLoading(true);
    navigate(
      `/search?q=${encodeURIComponent(searchQuery)}&mode=${searchMode}`,
    );
  };

  const handleDropdownClick = (item) => {
    setShowDropdown(false);
    if (item.hardcover_id != null) {
      navigate(`/bookdetails/hardcover/${item.hardcover_id}`, {
        state: { book: item },
      });
      return;
    }
    navigate(`/mediadetails/${item.media_type}/${item.tmdb_id}`);
  };

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim() === "") {
      setShowDropdown(false);
    }
    setSearchSubmitted(false);
  };

  const selectMode = (event) => {
    setSearchMode(event.target.value);
    setShowDropdown(false);
    setDropdownResults([]);
    setSearchSubmitted(false);
  };

  return (
    <div className="search-container" ref={dropdownRef}>
      <form onSubmit={handleSearch} className="search-form">
        <select
          className="search-mode-select"
          aria-label="Search category"
          value={searchMode}
          onChange={selectMode}
        >
          <option value="all">All</option>
          <option value="books">Books</option>
          <option value="movies">Movies</option>
          <option value="tv">TV</option>
        </select>
        <input
          type="text"
          placeholder="Search..."
          className="search-input"
          value={searchQuery}
          onChange={handleInputChange}
        />
        <button type="submit" className="search-button">
          <img src="/search.png" className="search-button-img"></img>
        </button>
      </form>

      {showDropdown && (
        <div className="search-dropdown">
          {searchLoading ? (
            <div className="dropdown-loading">Searching...</div>
          ) : dropdownResults.length > 0 ? (
            dropdownResults.map((item) =>
              item.hardcover_id != null ? (
                  <div
                    key={`book-${item.hardcover_id}`}
                    className="dropdown-item"
                    onClick={() => handleDropdownClick(item)}
                  >
                    <img
                      src={item.cover_image || "/placeholderimage.jpg"}
                      alt={item.title}
                      className="dropdown-poster"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/placeholderimage.jpg";
                      }}
                    />
                    <div className="dropdown-info">
                      <h4>{item.title}</h4>
                      <p>{item.author} · Book</p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`${item.media_type}-${item.tmdb_id}`}
                    className="dropdown-item"
                    onClick={() => handleDropdownClick(item)}
                  >
                    <img
                      src={item.primaryImage || "/placeholderimage.jpg"}
                      alt={item.primaryTitle}
                      className="dropdown-poster"
                    />
                    <div className="dropdown-info">
                      <h4>{item.primaryTitle}</h4>
                      <p>
                        {item.startYear}
                        {item.startYear ? " · " : ""}
                        {item.media_type === "tv" ? "TV" : "Movie"}
                      </p>
                    </div>
                  </div>
                ),
            )
          ) : (
            <div className="dropdown-no-results">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

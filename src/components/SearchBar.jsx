import { useState, useEffect, useRef } from "react";
import { searchMoviesFIRSTFIVEONLY, findByImdbId } from "../services/api.js";
import { searchBookEntries } from "../services/ratingsfromtable.js";
import { useSearch } from "../contexts/SearchContext";
import { useNavigate } from "react-router-dom";
import AddBookLog from "./AddBookLog.jsx";
import { bookDetailsRoute } from "../utils/goodreads.js";
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
  const [showAddBook, setShowAddBook] = useState(false);

  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (searchQuery.trim().length > 1 && !searchSubmitted) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const delay = searchMode === "books" ? 300 : 1000;
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          if (searchMode === "books") {
            const results = await searchBookEntries(searchQuery, 5);
            setDropdownResults(results);
          } else {
            const results = await searchMoviesFIRSTFIVEONLY(searchQuery);
            setDropdownResults(results);
          }
          setShowDropdown(true);
        } catch (err) {
          console.log("Search error:", err);
          setDropdownResults([]);
        }
      }, delay);
    } else {
      setShowDropdown(false);
      setDropdownResults([]);
    }

    return () => {
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

    if (searchMode === "movies" && !searchQuery.trim()) return;

    setShowDropdown(false);
    setSearchSubmitted(true);

    if (searchMode === "movies") {
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
    if (searchMode === "books") {
      const route = bookDetailsRoute(item.goodreads_link);
      if (route) {
        navigate(route, { state: { book: item } });
      } else if (item.goodreads_link) {
        window.open(item.goodreads_link, "_blank", "noopener,noreferrer");
      }
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

  const toggleMode = () => {
    setSearchMode(searchMode === "books" ? "movies" : "books");
    setShowDropdown(false);
    setDropdownResults([]);
    setSearchSubmitted(false);
  };

  return (
    <div className="search-container" ref={dropdownRef}>
      <form onSubmit={handleSearch} className="search-form">
        <button
          type="button"
          className="search-mode-toggle"
          onClick={toggleMode}
          aria-label="Toggle search type"
          title={
            searchMode === "books"
              ? "Switch to Movies/TV"
              : "Switch to Books"
          }
        >
          <img
            className="search-mode-icon"
            src={searchMode === "books" ? "/book.png" : "/movie.png"}
            alt={searchMode === "books" ? "Books" : "Movies/TV"}
          />
        </button>
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
        <button
          type="button"
          className={`search-add-book ${
            searchMode === "books" ? "books-mode" : "movies-mode"
          }`}
          onClick={() => setShowAddBook(true)}
          title="Add Book to Library"
          aria-label="Add Book to Library"
          style={{
            visibility: searchMode === "books" ? "visible" : "hidden",
            pointerEvents: searchMode === "books" ? "auto" : "none",
          }}
        >
          <img src="/addbookicon.png" alt="Add Book" />
        </button>
      </form>

      {showDropdown && (
        <div className="search-dropdown">
          {searchLoading ? (
            <div className="dropdown-loading">Searching...</div>
          ) : dropdownResults.length > 0 ? (
            searchMode === "books"
              ? dropdownResults.map((book) => (
                  <div
                    key={book.id}
                    className="dropdown-item"
                    onClick={() => handleDropdownClick(book)}
                  >
                    <img
                      src={book.cover_image || "/placeholderimage.jpg"}
                      alt={book.title}
                      className="dropdown-poster"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/placeholderimage.jpg";
                      }}
                    />
                    <div className="dropdown-info">
                      <h4>{book.title}</h4>
                      <p>{book.author}</p>
                    </div>
                  </div>
                ))
              : dropdownResults.map((movie) => (
                  <div
                    key={`${movie.media_type}-${movie.tmdb_id}`}
                    className="dropdown-item"
                    onClick={() => handleDropdownClick(movie)}
                  >
                    <img
                      src={movie.primaryImage || "/placeholderimage.jpg"}
                      alt={movie.primaryTitle}
                      className="dropdown-poster"
                    />
                    <div className="dropdown-info">
                      <h4>{movie.primaryTitle}</h4>
                      <p>{movie.startYear}</p>
                    </div>
                  </div>
                ))
          ) : (
            <div className="dropdown-no-results">No results found</div>
          )}
        </div>
      )}

      <AddBookLog
        isOpen={showAddBook}
        onClose={() => setShowAddBook(false)}
        title="Add Book to Library"
        submitLabel="Add Book"
        onCreate={() => {}}
      />
    </div>
  );
}

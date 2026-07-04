import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import {
  searchBooksHardcoverFIRSTFIVEONLY,
  searchMoviesFIRSTFIVEONLY,
  combineSearchResults,
  findByImdbId,
} from "../../services/api";
import { useSearch } from "../../contexts/SearchContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SEARCH_MODES = [
  { value: "all", label: "All" },
  { value: "movies", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "books", label: "Books" },
];

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

  // Switching mode keeps the dropdown open, clears stale results and lets the
  // debounced effect refetch for the new mode.
  const selectMode = (value: string) => {
    setSearchMode(value);
    setDropdownResults([]);
    setSearchSubmitted(false);
  };

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <form onSubmit={handleSearch}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search movies, TV, books..."
          className="h-9 rounded-lg bg-secondary/40 pl-9 pr-12 focus-visible:bg-background"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (dropdownResults.length > 0) setShowDropdown(true);
          }}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
          {navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl"}K
        </kbd>
      </form>

      {showDropdown && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b border-border p-1.5">
            <Tabs value={searchMode} onValueChange={selectMode}>
              <TabsList className="grid h-8 w-full grid-cols-4">
                {SEARCH_MODES.map((mode) => (
                  <TabsTrigger
                    key={mode.value}
                    value={mode.value}
                    className="h-6 text-xs"
                  >
                    {mode.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {searchLoading ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : dropdownResults.length > 0 ? (
            <div className="p-1">
              {dropdownResults.map((item) =>
                item.hardcover_id != null ? (
                  <button
                    key={`book-${item.hardcover_id}`}
                    type="button"
                    data-slot="search-result"
                    className="flex w-full cursor-pointer items-center gap-3 rounded-md bg-transparent p-2 text-left hover:bg-accent"
                    onClick={() => handleDropdownClick(item)}
                  >
                    <img
                      src={item.cover_image || "/images/placeholderimage.jpg"}
                      alt={item.title}
                      className="h-14 w-9 shrink-0 rounded object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/images/placeholderimage.jpg";
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.author} · Book
                      </p>
                    </div>
                  </button>
                ) : (
                  <button
                    key={`${item.media_type}-${item.tmdb_id}`}
                    type="button"
                    data-slot="search-result"
                    className="flex w-full cursor-pointer items-center gap-3 rounded-md bg-transparent p-2 text-left hover:bg-accent"
                    onClick={() => handleDropdownClick(item)}
                  >
                    <img
                      src={item.primaryImage || "/images/placeholderimage.jpg"}
                      alt={item.primaryTitle}
                      className="h-14 w-9 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.primaryTitle}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.startYear}
                        {item.startYear ? " · " : ""}
                        {item.media_type === "tv" ? "TV" : "Movie"}
                      </p>
                    </div>
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

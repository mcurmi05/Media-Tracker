import { useState, useEffect, useRef } from "react";
import { Search, CircleCheck, User } from "lucide-react";
import {
  searchBooksHardcoverFIRSTFIVEONLY,
  searchMoviesFIRSTFIVEONLY,
  searchPeopleFIRSTFIVEONLY,
  combineSearchResults,
  findByImdbId,
} from "../../services/api";
import { useSearch } from "../../contexts/SearchContext";
import { useCovers } from "../../contexts/UserCoversContext";
import { useLoggedLookup } from "../../hooks/useLoggedLookup";
import { Spinner } from "../layout/Loader";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SEARCH_MODES = [
  { value: "all", label: "All" },
  { value: "movies", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "books", label: "Books" },
  { value: "people", label: "People" },
];

export default function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    setSearchLoading,
    searchMode,
    setSearchMode,
  } = useSearch();
  const { coverForTmdb, coverForHardcover } = useCovers();
  const { isLogged } = useLoggedLookup();

  const [dropdownResults, setDropdownResults] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  // Index of the arrow-key-highlighted result (-1 = none highlighted).
  const [activeIndex, setActiveIndex] = useState(-1);

  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (searchQuery.trim().length > 1 && !searchSubmitted) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      // Show the spinner from the moment a query is pending (debounce + fetch),
      // so the dropdown never flashes an empty "no results" first.
      setDropdownLoading(true);
      setShowDropdown(true);
      const delay =
        searchMode === "books" ? 300 : searchMode === "people" ? 500 : 1000;
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          // Trailing 4-digit year filters to just that year; it's stripped from
          // the searched term (e.g. "Dune 2021").
          const yearMatch = searchQuery
            .trim()
            .match(/^(.*\S)\s+((?:19|20)\d{2})$/);
          const yearFilter = yearMatch ? Number(yearMatch[2]) : null;
          const term = yearMatch ? yearMatch[1].trim() : searchQuery;
          const matchesYear = (it) => {
            if (yearFilter == null) return true;
            const y = it.hardcover_id != null ? it.release_year : it.startYear;
            return Number(y) === yearFilter;
          };
          let results;
          if (searchMode === "all") {
            const [books, movies, tv, people] = await Promise.all([
              searchBooksHardcoverFIRSTFIVEONLY(term),
              searchMoviesFIRSTFIVEONLY(term, "movie"),
              searchMoviesFIRSTFIVEONLY(term, "tv"),
              searchPeopleFIRSTFIVEONLY(term),
            ]);
            // People (top 3) join the merged ranking; person items carry a
            // `title` field so the shared ranker can score them by name.
            results = combineSearchResults(
              term,
              books,
              movies,
              tv,
              (people || []).slice(0, 3),
            )
              .filter((it) => it.person_id != null || matchesYear(it))
              .slice(0, 6);
          } else if (searchMode === "people") {
            results = (await searchPeopleFIRSTFIVEONLY(term)) || [];
          } else {
            const raw =
              searchMode === "books"
                ? await searchBooksHardcoverFIRSTFIVEONLY(term)
                : await searchMoviesFIRSTFIVEONLY(term, searchMode);
            results = (raw || []).filter(matchesYear);
          }
          if (cancelled) return;
          setDropdownResults(results || []);
          setActiveIndex(-1);
          setShowDropdown(true);
        } catch (err) {
          if (cancelled) return;
          console.log("Search error:", err);
          setDropdownResults([]);
          setShowDropdown(true);
        } finally {
          if (!cancelled) setDropdownLoading(false);
        }
      }, delay);
    } else {
      setShowDropdown(false);
      setDropdownResults([]);
      setDropdownLoading(false);
    }

    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchSubmitted, searchMode, setSearchLoading]);

  // Keep the arrow-highlighted row visible as it moves past the dropdown edge.
  useEffect(() => {
    if (activeIndex < 0 || !dropdownRef.current) return;
    const el = dropdownRef.current.querySelector('[data-search-active="true"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
    if (item.person_id != null) {
      navigate(`/person/${item.person_id}`);
      return;
    }
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

  // Tab / Shift+Tab cycles through the media categories (without needing any
  // search results first) and opens the dropdown so the active tab is visible.
  const cycleMode = (dir) => {
    const idx = SEARCH_MODES.findIndex((m) => m.value === searchMode);
    const next =
      SEARCH_MODES[(idx + dir + SEARCH_MODES.length) % SEARCH_MODES.length];
    selectMode(next.value);
    setShowDropdown(true);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      cycleMode(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }
    if (!showDropdown || dropdownResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % dropdownResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? dropdownResults.length - 1 : i - 1,
      );
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // Highlighted a result: open it instead of running the full search.
      e.preventDefault();
      handleDropdownClick(dropdownResults[activeIndex]);
    }
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
          onKeyDown={handleInputKeyDown}
          onFocus={() => setShowDropdown(true)}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
          {navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl"}K
        </kbd>
      </form>

      {showDropdown && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b border-border p-1.5">
            <Tabs
              value={searchMode}
              onValueChange={selectMode}
              className="flex-1"
            >
              <TabsList className="grid h-8 w-full grid-cols-5">
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
            <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              Tab
            </kbd>
          </div>

          {dropdownLoading ? (
            <div className="flex items-center justify-center px-3 py-6">
              <Spinner />
            </div>
          ) : dropdownResults.length > 0 ? (
            <div className="p-1">
              {dropdownResults.map((item, idx) => {
                const active = idx === activeIndex;
                const rowClass = `flex w-full cursor-pointer items-center gap-3 rounded-md p-2 text-left hover:bg-accent${
                  active ? " bg-accent" : " bg-transparent"
                }`;
                if (item.person_id != null) {
                  return (
                    <button
                      key={`person-${item.person_id}`}
                      type="button"
                      data-slot="search-result"
                      data-search-active={active}
                      className={rowClass}
                      onClick={() => handleDropdownClick(item)}
                    >
                      {item.profile ? (
                        <img
                          src={item.profile}
                          alt={item.name}
                          className="h-14 w-9 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-9 shrink-0 items-center justify-center rounded bg-muted">
                          <User className="size-4 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.department || "Person"}
                          {item.known_for?.length
                            ? ` · ${item.known_for.join(", ")}`
                            : ""}
                        </p>
                      </div>
                    </button>
                  );
                }
                if (item.hardcover_id != null) {
                  return (
                    <button
                      key={`book-${item.hardcover_id}`}
                      type="button"
                      data-slot="search-result"
                      data-search-active={active}
                      className={rowClass}
                      onClick={() => handleDropdownClick(item)}
                    >
                      <img
                        src={
                          coverForHardcover(item.hardcover_id) ||
                          item.cover_image ||
                          "/images/placeholderimage.jpg"
                        }
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
                      {isLogged(item) && (
                        <CircleCheck className="ml-auto size-4 shrink-0 text-green-500" />
                      )}
                    </button>
                  );
                }
                return (
                  <button
                    key={`${item.media_type}-${item.tmdb_id}`}
                    type="button"
                    data-slot="search-result"
                    data-search-active={active}
                    className={rowClass}
                    onClick={() => handleDropdownClick(item)}
                  >
                    <img
                      src={
                        coverForTmdb(item.media_type, item.tmdb_id) ||
                        item.primaryImage ||
                        "/images/placeholderimage.jpg"
                      }
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
                    {isLogged(item) && (
                      <CircleCheck className="ml-auto size-4 shrink-0 text-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : searchQuery.trim().length > 1 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Type to search · Tab to switch category
              <br />
              Add a year to filter, e.g. “Dune 2021”
            </div>
          )}
        </div>
      )}
    </div>
  );
}

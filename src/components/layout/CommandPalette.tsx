import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  TrendingUp,
  Bookmark,
  List,
  BookOpen,
  Star,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import {
  searchBooksHardcoverFIRSTFIVEONLY,
  searchMoviesFIRSTFIVEONLY,
  combineSearchResults,
} from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useSearch } from "../../contexts/SearchContext";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export const OPEN_PALETTE_EVENT = "mt:open-palette";

const SEARCH_MODES = [
  { value: "all", label: "All" },
  { value: "movies", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "books", label: "Books" },
];

const discoverItems = [
  { title: "Home", url: "/", icon: Home, authOnly: false },
  { title: "Trending", url: "/trending", icon: TrendingUp, authOnly: false },
];

const libraryItems = [
  { title: "Watchlist", url: "/watchlist", icon: Bookmark, authOnly: true },
  { title: "Lists", url: "/lists", icon: List, authOnly: true },
  { title: "Log", url: "/log", icon: BookOpen, authOnly: true },
  { title: "Ratings", url: "/ratings", icon: Star, authOnly: true },
];

function matches(title: string, query: string) {
  return title.toLowerCase().includes(query.trim().toLowerCase());
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, signOut } = useAuth();
  const { clearSearch } = useSearch();
  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const handleOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, handleOpenEvent);
    };
  }, []);

  // Same debounced fetch as SearchBar's "all" mode, feeding CommandItems.
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!open || query.trim().length <= 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let fetched;
        if (mode === "all") {
          const [books, movies, tv] = await Promise.all([
            searchBooksHardcoverFIRSTFIVEONLY(query),
            searchMoviesFIRSTFIVEONLY(query, "movie"),
            searchMoviesFIRSTFIVEONLY(query, "tv"),
          ]);
          fetched = combineSearchResults(query, books, movies, tv);
        } else {
          fetched =
            mode === "books"
              ? await searchBooksHardcoverFIRSTFIVEONLY(query)
              : await searchMoviesFIRSTFIVEONLY(query, mode);
        }
        if (!cancelled) setResults(fetched || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
    };
  }, [open, query, mode]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setMode("all");
      setResults([]);
    }
  };

  const selectMode = (value: string) => {
    setMode(value);
    setResults([]);
  };

  // Tab / Shift+Tab cycles search mode without leaving the input.
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const idx = SEARCH_MODES.findIndex((m) => m.value === mode);
    const next =
      SEARCH_MODES[
        (idx + (e.shiftKey ? -1 : 1) + SEARCH_MODES.length) %
          SEARCH_MODES.length
      ];
    selectMode(next.value);
  };

  const runCommand = useCallback((action: () => void) => {
    handleOpenChange(false);
    action();
  }, []);

  const goTo = (url: string, authOnly: boolean) => {
    runCommand(() => {
      clearSearch();
      navigate(authOnly && !isAuthenticated ? "/signin" : url);
    });
  };

  const openResult = (item) => {
    runCommand(() => {
      if (item.hardcover_id != null) {
        navigate(`/bookdetails/hardcover/${item.hardcover_id}`, {
          state: { book: item },
        });
        return;
      }
      navigate(`/mediadetails/${item.media_type}/${item.tmdb_id}`);
    });
  };

  const visibleDiscover = discoverItems.filter((i) => matches(i.title, query));
  const visibleLibrary = libraryItems.filter((i) => matches(i.title, query));

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search movies, TV, books, or jump to a page..."
        value={query}
        onValueChange={setQuery}
        onKeyDown={handleInputKeyDown}
      />
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {SEARCH_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => selectMode(m.value)}
            className={`cursor-pointer rounded-md px-2 py-0.5 text-xs transition-colors ${
              mode === m.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          Tab
        </kbd>
        <span className="text-[10px] text-muted-foreground">switch</span>
      </div>
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching..." : "No results found."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((item) =>
              item.hardcover_id != null ?
                <CommandItem
                  key={`book-${item.hardcover_id}`}
                  value={`book-${item.hardcover_id}`}
                  onSelect={() => openResult(item)}
                >
                  <img
                    src={item.cover_image || "/images/placeholderimage.jpg"}
                    alt=""
                    className="h-10 w-7 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.author} · Book
                    </p>
                  </div>
                </CommandItem>
              : <CommandItem
                  key={`${item.media_type}-${item.tmdb_id}`}
                  value={`${item.media_type}-${item.tmdb_id}`}
                  onSelect={() => openResult(item)}
                >
                  <img
                    src={item.primaryImage || "/images/placeholderimage.jpg"}
                    alt=""
                    className="h-10 w-7 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.primaryTitle}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.startYear}
                      {item.startYear ? " · " : ""}
                      {item.media_type === "tv" ? "TV" : "Movie"}
                    </p>
                  </div>
                </CommandItem>,
            )}
          </CommandGroup>
        )}
        {visibleDiscover.length > 0 && (
          <CommandGroup heading="Discover">
            {visibleDiscover.map((item) => (
              <CommandItem
                key={item.url}
                value={item.title}
                onSelect={() => goTo(item.url, item.authOnly)}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {visibleLibrary.length > 0 && (
          <CommandGroup heading="Library">
            {visibleLibrary.map((item) => (
              <CommandItem
                key={item.url}
                value={item.title}
                onSelect={() => goTo(item.url, item.authOnly)}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Account">
          {isAuthenticated ?
            <>
              {matches("Account Settings", query) && (
                <CommandItem
                  value="account-settings"
                  onSelect={() => goTo("/account", true)}
                >
                  <Settings />
                  Account Settings
                </CommandItem>
              )}
              {matches("Sign Out", query) && (
                <CommandItem
                  value="sign-out"
                  onSelect={() =>
                    runCommand(async () => {
                      clearSearch();
                      navigate("/");
                      await signOut();
                    })
                  }
                >
                  <LogOut />
                  Sign Out
                </CommandItem>
              )}
            </>
          : matches("Sign In", query) && (
              <CommandItem
                value="sign-in"
                onSelect={() => goTo("/signin", false)}
              >
                <LogIn />
                Sign In
              </CommandItem>
            )
          }
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

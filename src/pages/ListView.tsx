import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCovers } from "../contexts/UserCoversContext";
import { bookDetailsRouteForBook } from "../utils/goodreads";
import { getBookInfo } from "../utils/bookInfo";
import { useDebouncedValue } from "../utils/useDebouncedValue";
import {
  searchMovies,
  searchBooksHardcover,
  combineSearchResults,
  getMovieById,
  getBookByHardcoverId,
} from "../services/api";
import { findOrCreateBookEntry } from "../services/ratingsfromtable";
import {
  getListWithItems,
  updateList,
  deleteList,
  addMediaToList,
  removeListItem,
  movieToListItem,
  bookToListItem,
  mediaKey,
  isListSaved,
  saveList,
  unsaveList,
  setListMagic,
  bulkAddListItems,
  bulkRemoveListItems,
} from "../services/lists";
import {
  computeMagicSnapshots,
  computeGlobalSnapshots,
  diffMagicItems,
  describeRule,
} from "../utils/magicLists";
import { useMagicLibrary } from "../hooks/useMagicLibrary";
import { useImdbRatings } from "../contexts/ImdbRatingsContext";
import { useLetterboxdRatings } from "../contexts/LetterboxdRatingsContext";
import { useGoodreadsRatings } from "../contexts/GoodreadsRatingsContext";
import {
  compareNums,
  imdbRatingFor,
  letterboxdRatingFor,
  goodreadsRatingFor,
} from "../utils/mediaFilters";
import SortByMenu from "../components/filters/SortByMenu";
import MagicListModal from "../components/common/MagicListModal";
import ListComponent from "../components/common/ListComponent";
import AddToList from "../components/common/AddToList";
import BookRatingStar from "../components/books/BookRatingStar";
import AddBookWatchlist from "../components/books/AddBookWatchlist";
import AddBookLogButton from "../components/books/AddBookLogButton";
import GoodreadsInfo from "../components/books/GoodreadsInfo";
import StorygraphInfo from "../features/ratings/storygraph/StorygraphInfo";
import Loader, { Spinner } from "../components/layout/Loader";
import "../styles/pages/Rating.css";
import "../styles/common/LogComponent.css";
import "../styles/search/Toolbar.css";
import "../styles/pages/Lists.css";

// The ✕ that owners get on every row, slotted in with the other row actions.
function RemoveButton({ onRemove, removing }) {
  return (
    <button
      className="lv-item-remove"
      onClick={onRemove}
      disabled={removing}
      title="Remove from list"
      aria-label="Remove from list"
    >
      {removing ? <Spinner /> : String.fromCharCode(0x2715)}
    </button>
  );
}

// Rich book row — the book twin of ListComponent, modeled on BookTbrComponent
// but driven by the list item's snapshot (plus fetched extras) instead of a
// TBR row. Shows Goodreads/StoryGraph ratings, author, year and the usual
// rate/watchlist/log actions.
function BookListRow({ book, isOwner, onRemove, removing }) {
  const navigate = useNavigate();
  const { coverForHardcover } = useCovers();
  const b = getBookInfo(book);
  const cover = coverForHardcover(b.hardcover_id) || b.cover_image;

  const openBookDetails = () => {
    const route = bookDetailsRouteForBook(b);
    if (route) navigate(route, { state: { book } });
  };

  const handleAuthorSearch = () => {
    const formattedAuthor = (b.author || "").replace(/\s+/g, "+");
    if (!formattedAuthor) return;
    window.open(
      `https://www.google.com/search?q=${formattedAuthor}+books`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="div-wrapper-rating-testing">
      <div className="container">
        <div className="top-stuff">
          <img
            className="rating-poster"
            src={cover || "/images/placeholderimage.jpg"}
            alt={`${b.title} cover`}
            onClick={openBookDetails}
            style={{ cursor: "pointer" }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/placeholderimage.jpg";
            }}
          />
          <div className="right-stuff book-right-stuff">
            <div className="title-and-star">
              <p
                className="movie-title"
                onClick={openBookDetails}
                style={{ cursor: "pointer" }}
              >
                {b.title}{" "}
              </p>
              <div className="rating-actions" style={{ display: "flex" }}>
                <div className="rating-star-div">
                  <BookRatingStar book={book} />
                </div>
                <div className="rating-action-spacer" style={{ margin: "5px" }}></div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <AddBookWatchlist book={b} />
                  <AddToList book={b} />
                  <AddBookLogButton book={b} />
                  {isOwner && (
                    <RemoveButton onRemove={onRemove} removing={removing} />
                  )}
                </div>
              </div>
            </div>

            <div
              className="rating-page-subtitle"
              style={{ display: "flex", alignItems: "baseline", gap: "24px" }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.95em",
                  }}
                >
                  {b.release_year ? <span>{b.release_year}</span> : null}
                  <GoodreadsInfo book={b} />
                  <StorygraphInfo book={b} />
                </span>
                {b.author && (
                  <span className="book-by-line" style={{ fontSize: "0.95em" }}>
                    <span className="bold-span">By</span>{" "}
                    <span
                      onClick={handleAuthorSearch}
                      style={{ cursor: "pointer" }}
                    >
                      {b.author}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Placeholder row shown for a movie/TV item while its full title (cast,
// directors, IMDb id, ...) is still being fetched, and the fallback if that
// fetch fails.
function PendingMovieRow({ item, pending }) {
  const navigate = useNavigate();
  const { coverForTmdb } = useCovers();
  const d = item.item_data || {};
  const cover = coverForTmdb(d.media_type, d.tmdb_id) || d.primaryImage;
  const goTo = () =>
    d.tmdb_id != null && navigate(`/mediadetails/${d.media_type}/${d.tmdb_id}`);

  return (
    <div className="div-wrapper-rating-testing">
      <div className="container">
        <div className="top-stuff">
          <img
            className="rating-poster"
            src={cover || "/images/placeholderimage.jpg"}
            alt=""
            onClick={goTo}
            style={{ cursor: "pointer" }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/placeholderimage.jpg";
            }}
          />
          <div className="right-stuff">
            <div className="title-and-star">
              <p
                className="movie-title"
                onClick={goTo}
                style={{ cursor: "pointer" }}
              >
                {d.primaryTitle || "Untitled"}{" "}
              </p>
            </div>
            <div className="rating-page-subtitle">
              {d.startYear ? <span>{d.startYear}</span> : null}
              {pending && <Spinner />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One search hit in the owner's add-items panel. Covers honour the user's
// custom poster overrides, same as everywhere else.
function AddResultRow({ result, added, busy, onAdd }) {
  const { coverForTmdb, coverForHardcover } = useCovers();
  const isBook = result.hardcover_id != null;
  const cover = isBook
    ? coverForHardcover(result.hardcover_id) || result.cover_image
    : coverForTmdb(result.media_type, result.tmdb_id) || result.primaryImage;
  const title = isBook ? result.title : result.primaryTitle;
  const year = isBook ? result.release_year : result.startYear;
  const type = isBook ? "book" : result.media_type === "tv" ? "TV" : "movie";

  return (
    <button
      type="button"
      className={`lv-add-row${added ? " is-added" : ""}`}
      onClick={onAdd}
      disabled={added || busy}
    >
      <img
        className="lv-add-poster"
        src={cover || "/images/placeholderimage.jpg"}
        alt=""
        loading="lazy"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/images/placeholderimage.jpg";
        }}
      />
      <span className="lv-add-info">
        <span className="lv-add-title">{title || "Untitled"}</span>
        <span className="lv-add-sub">
          {year ? `${year} · ` : ""}
          {type}
        </span>
      </span>
      <span className="lv-add-action">
        {busy ? <Spinner /> : added ? "Added ✓" : "Add"}
      </span>
    </button>
  );
}

export default function ListView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [copied, setCopied] = useState(false);

  const [editing, setEditing] = useState(false);
  // Inline rename of the title, owner only.
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Full title/book objects fetched per item so rows can show the same detail
  // as the ratings/watchlist components (cast, directors, IMDb id, slugs...).
  const [movieDetails, setMovieDetails] = useState(new Map());
  const [bookDetails, setBookDetails] = useState(new Map());
  const requestedRef = useRef(new Set());

  // Magic list machinery: the user library the rules run against, plus
  // sync/edit state. Syncing is always explicit — the owner presses Sync.
  const { universe, ready: magicLibraryReady } = useMagicLibrary();
  const [syncing, setSyncing] = useState(false);
  const [editingMagic, setEditingMagic] = useState(false);
  const [savingMagic, setSavingMagic] = useState(false);
  // Pending sync whose removals need the owner's OK: { toAdd, toRemove }.
  const [syncPrompt, setSyncPrompt] = useState(null);

  // View controls: filter + sort the items without touching stored order.
  const { ratings: imdbTable } = useImdbRatings();
  const { ratings: lbTable } = useLetterboxdRatings();
  const { ratings: grTable } = useGoodreadsRatings();
  const [itemSearch, setItemSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("position");
  const [sortDir, setSortDir] = useState("asc");

  // Owner add-items search panel.
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const debouncedQuery = useDebouncedValue(addQuery, 350);
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addingKey, setAddingKey] = useState(null);

  const isOwner = isAuthenticated && list && user?.id === list.owner_id;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getListWithItems(id);
        if (!active) return;
        if (!data) {
          setNotFound(true);
        } else {
          setList(data);
          setEditTitle(data.title);
          setEditDesc(data.description || "");
          // Magic lists have no meaningful hand-picked order (syncs just
          // append), so default their view to release date.
          if (data.magic) {
            setSortKey("year");
            setSortDir("desc");
          }
        }
      } catch (err) {
        console.error("Failed to load list:", err);
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Fetch the full objects behind each item (once per item). Movie/TV rows
  // need them for cast/directors/live ratings; book rows use them to fill in
  // fields the slim snapshot doesn't carry (slugs for StoryGraph etc.).
  // No cancellation on purpose: items change whenever a magic sync or manual
  // add lands, and requestedRef already marked in-flight ids — dropping their
  // results would leave those rows on a spinner forever.
  useEffect(() => {
    if (!list?.items?.length) return;
    list.items.forEach(async (it) => {
      if (requestedRef.current.has(it.id)) return;
      requestedRef.current.add(it.id);
      try {
        if (it.media_type === "book") {
          const hid = it.item_data?.hardcover_id;
          if (!hid) return;
          const full = await getBookByHardcoverId(hid);
          if (!full) return;
          // Snapshot first, then any non-null fresh fields on top.
          const merged = {
            ...it.item_data,
            ...Object.fromEntries(
              Object.entries(full).filter(([, v]) => v != null),
            ),
          };
          setBookDetails((prev) => new Map(prev).set(it.id, merged));
        } else {
          const d = it.item_data;
          if (d?.tmdb_id == null) return;
          const full = await getMovieById(d.media_type, d.tmdb_id);
          // ListComponent renders cast/directors unguarded — only hand over
          // objects that actually carry them. A null marks the fetch as done
          // so the row settles on the simple fallback instead of a spinner.
          const ok = full?.tmdb_id != null && Array.isArray(full.cast);
          setMovieDetails((prev) => new Map(prev).set(it.id, ok ? full : null));
        }
      } catch (err) {
        console.error("Failed to load item details:", err);
        if (it.media_type !== "book") {
          setMovieDetails((prev) => new Map(prev).set(it.id, null));
        }
      }
    });
  }, [list?.items]);

  // Whether the current (non-owner) user has already saved this list.
  useEffect(() => {
    if (!isAuthenticated || !user || !list || user.id === list.owner_id) return;
    let active = true;
    isListSaved(user.id, list.id)
      .then((s) => active && setSaved(s))
      .catch((err) => console.error("Failed to check saved state:", err));
    return () => {
      active = false;
    };
  }, [isAuthenticated, user, list]);

  // Combined movie + TV + book search for the add panel.
  useEffect(() => {
    const term = debouncedQuery.trim();
    if (!addOpen || !term) {
      setAddResults([]);
      setAddSearching(false);
      return;
    }
    let active = true;
    setAddSearching(true);
    Promise.all([
      searchMovies(term, "movie").catch(() => []),
      searchMovies(term, "tv").catch(() => []),
      searchBooksHardcover(term).catch(() => []),
    ])
      .then(([movies, tv, books]) => {
        if (!active) return;
        setAddResults(combineSearchResults(term, movies, tv, books).slice(0, 12));
      })
      .finally(() => {
        if (active) setAddSearching(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, addOpen]);

  // Items as currently viewed: text/type filters plus sort. "position" keeps
  // the stored list order (what reordering/syncs produce).
  const visibleItems = useMemo(() => {
    let arr = list?.items || [];
    if (typeFilter !== "all") {
      arr = arr.filter((it) => {
        if (typeFilter === "books") return it.media_type === "book";
        if (it.media_type === "book") return false;
        return (it.item_data?.media_type || "") === (typeFilter === "tv" ? "tv" : "movie");
      });
    }
    const q = itemSearch.trim().toLowerCase();
    if (q) {
      arr = arr.filter((it) =>
        (it.item_data?.primaryTitle || it.item_data?.title || "")
          .toLowerCase()
          .includes(q),
      );
    }
    if (sortKey === "position") {
      return sortDir === "asc" ? arr : [...arr].reverse();
    }
    const titleOf = (it) =>
      it.item_data?.primaryTitle || it.item_data?.title || "";
    const valueOf = (it) => {
      const d = it.item_data || {};
      switch (sortKey) {
        case "year": {
          const y = Number(d.startYear ?? d.release_year);
          return Number.isFinite(y) && y > 0 ? y : null;
        }
        case "imdb":
          return it.media_type === "book"
            ? null
            : imdbRatingFor(imdbTable, movieDetails.get(it.id) || d);
        case "letterboxd":
          return it.media_type === "book" ? null : letterboxdRatingFor(lbTable, d);
        case "goodreads":
          return it.media_type === "book" ? goodreadsRatingFor(grTable, d) : null;
        case "added":
          return it.created_at ? new Date(it.created_at).getTime() : null;
        default:
          return null;
      }
    };
    return [...arr].sort((a, b) =>
      sortKey === "title"
        ? sortDir === "asc"
          ? titleOf(a).localeCompare(titleOf(b))
          : titleOf(b).localeCompare(titleOf(a))
        : compareNums(valueOf(a), valueOf(b), sortDir),
    );
  }, [
    list?.items,
    typeFilter,
    itemSearch,
    sortKey,
    sortDir,
    imdbTable,
    lbTable,
    grTable,
    movieDetails,
  ]);

  // Media keys of everything already in the list, for "Added ✓" states.
  const existingKeys = useMemo(() => {
    if (!list?.items) return new Set();
    return new Set(
      list.items.map((it) =>
        mediaKey({ media_type: it.media_type, item_data: it.item_data }),
      ),
    );
  }, [list?.items]);

  const resultKey = (result) =>
    mediaKey(
      result.hardcover_id != null
        ? bookToListItem(result)
        : movieToListItem(result),
    );

  const handleAddResult = async (result) => {
    const key = resultKey(result);
    if (existingKeys.has(key) || addingKey) return;
    setAddingKey(key);
    try {
      let snapshot;
      if (result.hardcover_id != null) {
        // Same flow as the AddToList modal: make sure the book exists in
        // book_entries so ratings/logs elsewhere link up to the same row.
        const entry = await findOrCreateBookEntry(getBookInfo(result));
        snapshot = bookToListItem(entry);
      } else {
        snapshot = movieToListItem(result);
      }
      const row = await addMediaToList(list.id, snapshot);
      setList((prev) => ({ ...prev, items: [...prev.items, row] }));
    } catch (err) {
      console.error("Failed to add to list:", err);
    } finally {
      setAddingKey(null);
    }
  };

  // Apply a computed diff: optionally remove what stopped matching, append
  // what's new.
  const runSync = async (toAdd, toRemove) => {
    setSyncing(true);
    try {
      if (toRemove.length) {
        await bulkRemoveListItems(toRemove.map((it) => it.id));
      }
      let added = [];
      if (toAdd.length) {
        const maxPos = Math.max(
          -1,
          ...list.items.map((it) => Number(it.position) || 0),
        );
        added = await bulkAddListItems(list.id, toAdd, maxPos + 1);
      }
      const removedIds = new Set(toRemove.map((it) => it.id));
      setList((prev) => ({
        ...prev,
        items: [...prev.items.filter((it) => !removedIds.has(it.id)), ...added],
      }));
    } catch (err) {
      console.error("Failed to sync magic list:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Sync button: if anything in the list no longer fits the rules, ask
  // whether to only add new matches or also remove the misfits. Global lists
  // recompute against TMDB/Hardcover, which takes a moment; the header shows
  // a syncing indicator meanwhile.
  const syncMagic = async (magicCfg) => {
    if (!list || syncing) return;
    const isGlobal = magicCfg?.scope === "global";
    if (!isGlobal && !magicLibraryReady) return;
    let snapshots;
    if (isGlobal) {
      setSyncing(true);
      try {
        ({ snapshots } = await computeGlobalSnapshots(magicCfg));
      } catch (err) {
        console.error("Failed to compute global magic list:", err);
        return;
      } finally {
        setSyncing(false);
      }
    } else {
      ({ snapshots } = computeMagicSnapshots(universe, magicCfg));
    }
    const { toAdd, toRemove } = diffMagicItems(list.items, snapshots);
    if (!toAdd.length && !toRemove.length) return;
    if (toRemove.length) {
      setSyncPrompt({ toAdd, toRemove });
    } else {
      runSync(toAdd, []);
    }
  };

  // Saving new rules redefines the list, so the full diff (adds + removals)
  // applies immediately without prompting. The modal already computed the
  // matching snapshots for its preview, so reuse them here.
  const handleSaveMagicRules = async ({ magic, snapshots }) => {
    if (savingMagic) return;
    setSavingMagic(true);
    try {
      const updated = await setListMagic(list.id, magic);
      setList((prev) => ({ ...prev, ...updated }));
      setEditingMagic(false);
      const { toAdd, toRemove } = diffMagicItems(list.items, snapshots);
      await runSync(toAdd, toRemove);
    } catch (err) {
      console.error("Failed to save magic rules:", err);
    } finally {
      setSavingMagic(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const toggleSave = async () => {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    if (saveBusy) return;
    setSaveBusy(true);
    try {
      if (saved) {
        await unsaveList(user.id, list.id);
        setSaved(false);
      } else {
        await saveList(user.id, list.id);
        setSaved(true);
      }
    } catch (err) {
      console.error("Failed to update saved state:", err);
    } finally {
      setSaveBusy(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    setRemovingId(itemId);
    try {
      await removeListItem(itemId);
      setList((prev) => ({
        ...prev,
        items: prev.items.filter((it) => it.id !== itemId),
      }));
    } catch (err) {
      console.error("Failed to remove item:", err);
    } finally {
      setRemovingId(null);
    }
  };

  const startRename = () => {
    if (!isOwner) return;
    setRenameValue(list.title);
    setRenaming(true);
  };

  const commitRename = async () => {
    const title = renameValue.trim();
    if (!title || title === list.title) {
      setRenaming(false);
      return;
    }
    if (savingRename) return;
    setSavingRename(true);
    try {
      const updated = await updateList(list.id, { title });
      setList((prev) => ({ ...prev, ...updated }));
      setEditTitle(title);
      setRenaming(false);
    } catch (err) {
      console.error("Failed to rename list:", err);
    } finally {
      setSavingRename(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await updateList(list.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
      });
      setList((prev) => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      console.error("Failed to update list:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteList(list.id);
      navigate("/lists");
    } catch (err) {
      console.error("Failed to delete list:", err);
      setDeleting(false);
    }
  };

  if (loading) return <Loader />;
  if (notFound) {
    return (
      <div className="page-stack">
        <div className="empty-msg">This list doesn't exist or was removed.</div>
      </div>
    );
  }

  return (
    <div className="page-stack lv-page">
      <button
        type="button"
        className="lv-back"
        onClick={() => navigate("/lists")}
        title="Back to lists"
        aria-label="Back to lists"
      >
        <img src="/images/promote.png" alt="" aria-hidden="true" />
      </button>
      <header className="lv-header">
        <div className="lv-title-row">
          {renaming ? (
            <input
              className="lv-title-input"
              value={renameValue}
              maxLength={100}
              autoFocus
              disabled={savingRename}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
            />
          ) : (
            <>
              <h1
                className={`lv-title${isOwner ? " lv-title-editable" : ""}`}
                onClick={startRename}
                title={isOwner ? "Click to rename" : undefined}
              >
                {list.title}
              </h1>
              {isOwner && (
                <button
                  type="button"
                  className="lv-title-edit"
                  title="Edit name & description"
                  aria-label="Edit list"
                  onClick={() => setEditing(true)}
                >
                  <img src="/images/pencil.png" alt="" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
        {list.owner_name && <p className="lv-owner">by {list.owner_name}</p>}
        {list.description && <p className="lv-desc">{list.description}</p>}
        <p className="lv-count">
          <span
            className="toolbar-count"
            title={`${list.items.length} ${list.items.length === 1 ? "item" : "items"}`}
          >
            {list.items.length}
          </span>
        </p>

        {list.magic && (
          <div className="lv-magic">
            <div className="lv-magic-head">
              <span className="list-card-magic">✨ Magic</span>
              {list.magic.scope === "global" && (
                <span className="list-card-magic lv-magic-global">Global</span>
              )}
              {syncing && (
                <span className="lv-magic-syncing">
                  <Spinner /> Syncing...
                </span>
              )}
            </div>
            <div className="lv-magic-rules">
              {(list.magic.rules || []).map((r, i) => {
                const join = (r.join || list.magic.combinator || "and").toUpperCase();
                return (
                  <span key={i} className="lv-magic-chip-group">
                    {i > 0 && (
                      <span
                        className={`lv-magic-join${join === "OR" ? " lv-magic-join-or" : ""}`}
                      >
                        {join}
                      </span>
                    )}
                    <span className="lv-magic-chip">{describeRule(r)}</span>
                  </span>
                );
              })}
            </div>
            {isOwner && (
              <div className="lv-magic-actions">
                <button
                  className="lv-btn lv-btn-sm"
                  onClick={() => syncMagic(list.magic)}
                  disabled={
                    syncing ||
                    (list.magic.scope !== "global" && !magicLibraryReady)
                  }
                  title={
                    list.magic.scope === "global"
                      ? "Re-run the rules against TMDB & Hardcover: new matches are added, stale ones removed"
                      : "Re-run the rules against your library: new matches are added, stale ones removed"
                  }
                >
                  Sync
                </button>
                <button
                  className="lv-btn lv-btn-sm"
                  onClick={() => setEditingMagic(true)}
                  disabled={savingMagic}
                >
                  Edit rules
                </button>
              </div>
            )}
          </div>
        )}

        <div className="lv-actions">
          <button className="lv-btn" onClick={copyLink}>
            {copied ? "Link copied!" : "Copy share link"}
          </button>

          {isOwner ? (
            <>
              <button
                className={`lv-btn${addOpen ? " lv-btn-active" : ""}`}
                onClick={() => setAddOpen((v) => !v)}
              >
                + Add items
              </button>
              <button
                className="lv-btn lv-btn-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            </>
          ) : isAuthenticated ? (
            <button
              className={`lv-btn${saved ? " lv-btn-active" : ""}`}
              onClick={toggleSave}
              disabled={saveBusy}
            >
              {saveBusy ? <Spinner /> : saved ? "Saved ✓" : "Save list"}
            </button>
          ) : (
            <button className="lv-btn" onClick={() => navigate("/signin")}>
              Sign in to save
            </button>
          )}
        </div>
      </header>

      {confirmingDelete && (
        <div
          className="lists-modal-overlay"
          onClick={() => !deleting && setConfirmingDelete(false)}
        >
          <div className="lists-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lists-modal-head">
              <h3>Delete list</h3>
              <button
                className="lists-modal-close"
                onClick={() => setConfirmingDelete(false)}
                aria-label="Close"
                disabled={deleting}
              >
                {String.fromCharCode(0x2715)}
              </button>
            </div>
            <p className="lists-confirm-text">
              Delete <strong>{list.title}</strong>? This can't be undone.
            </p>
            <div className="lists-confirm-actions">
              <button
                className="lv-btn"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="lv-btn lists-confirm-delete"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Spinner /> : "Delete list"}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncPrompt && (
        <div
          className="lists-modal-overlay"
          onClick={() => !syncing && setSyncPrompt(null)}
        >
          <div className="lists-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lists-modal-head">
              <h3>Sync magic list</h3>
              <button
                className="lists-modal-close"
                onClick={() => setSyncPrompt(null)}
                aria-label="Close"
                disabled={syncing}
              >
                {String.fromCharCode(0x2715)}
              </button>
            </div>
            <p className="lists-confirm-text">
              {syncPrompt.toAdd.length > 0 && (
                <>
                  <strong>{syncPrompt.toAdd.length}</strong> new{" "}
                  {syncPrompt.toAdd.length === 1 ? "match" : "matches"} to add.{" "}
                </>
              )}
              <strong>{syncPrompt.toRemove.length}</strong>{" "}
              {syncPrompt.toRemove.length === 1 ? "item" : "items"} in the list
              no longer {syncPrompt.toRemove.length === 1 ? "fits" : "fit"} the
              rules. Remove {syncPrompt.toRemove.length === 1 ? "it" : "them"}{" "}
              too, or only add?
            </p>
            <div className="lists-confirm-actions">
              <button
                className="lv-btn"
                onClick={() => setSyncPrompt(null)}
                disabled={syncing}
              >
                Cancel
              </button>
              {syncPrompt.toAdd.length > 0 && (
                <button
                  className="lv-btn"
                  onClick={async () => {
                    await runSync(syncPrompt.toAdd, []);
                    setSyncPrompt(null);
                  }}
                  disabled={syncing}
                >
                  Add only
                </button>
              )}
              <button
                className="lv-btn lists-confirm-delete"
                onClick={async () => {
                  await runSync(syncPrompt.toAdd, syncPrompt.toRemove);
                  setSyncPrompt(null);
                }}
                disabled={syncing}
              >
                {syncing ? (
                  <Spinner />
                ) : syncPrompt.toAdd.length > 0 ? (
                  "Add & remove"
                ) : (
                  `Remove ${syncPrompt.toRemove.length}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMagic && (
        <MagicListModal
          mode="edit"
          initialMagic={list.magic}
          saving={savingMagic}
          onClose={() => setEditingMagic(false)}
          onSubmit={handleSaveMagicRules}
        />
      )}

      {isOwner && addOpen && (
        <div className="lv-add-panel">
          <div className="toolbar-search lv-add-search">
            <input
              className="toolbar-input"
              type="text"
              placeholder="Search movies, TV & books..."
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              autoFocus
            />
            {addQuery && (
              <button
                className="toolbar-clear"
                onClick={() => setAddQuery("")}
                aria-label="Clear search"
              >
                {String.fromCharCode(0x2715)}
              </button>
            )}
          </div>
          {addSearching ? (
            <div className="lv-add-loading">
              <Spinner />
            </div>
          ) : addResults.length > 0 ? (
            <div className="lv-add-results">
              {addResults.map((r) => {
                const key = resultKey(r);
                return (
                  <AddResultRow
                    key={key}
                    result={r}
                    added={existingKeys.has(key)}
                    busy={addingKey === key}
                    onAdd={() => handleAddResult(r)}
                  />
                );
              })}
            </div>
          ) : debouncedQuery.trim() ? (
            <p className="lists-modal-empty">No results.</p>
          ) : null}
        </div>
      )}

      {list.items.length > 1 && (
        <div className="toolbar">
          <div className="toolbar-search">
            <input
              className="toolbar-input"
              type="text"
              placeholder="Search..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
            {itemSearch && (
              <button
                className="toolbar-clear"
                onClick={() => setItemSearch("")}
                aria-label="Clear search"
              >
                {String.fromCharCode(0x2715)}
              </button>
            )}
          </div>
          <select
            className="toolbar-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="movies">Movies</option>
            <option value="tv">TV</option>
            <option value="books">Books</option>
          </select>
          <SortByMenu
            sortKey={sortKey}
            sortDir={sortDir}
            onChange={(k, d) => {
              setSortKey(k);
              setSortDir(d);
            }}
            options={[
              { value: "position", label: "List Order" },
              { value: "added", label: "Date Added" },
              { value: "title", label: "Title" },
              { value: "year", label: "Release Date" },
              { value: "imdb", label: "IMDb Rating" },
              { value: "letterboxd", label: "Letterboxd Rating" },
              { value: "goodreads", label: "Goodreads Rating" },
            ]}
          />
          <span className="toolbar-count">{visibleItems.length}</span>
        </div>
      )}

      {list.items.length === 0 ? (
        <div className="empty-msg">This list is empty.</div>
      ) : visibleItems.length === 0 ? (
        <div className="empty-msg">No items match this filter.</div>
      ) : (
        <div className="list-col">
          {visibleItems.map((item) => {
            const removeProps = {
              isOwner,
              onRemove: () => handleRemoveItem(item.id),
              removing: removingId === item.id,
            };
            if (item.media_type === "book") {
              return (
                <div className="list-row" key={item.id}>
                  <BookListRow
                    book={bookDetails.get(item.id) || item.item_data}
                    {...removeProps}
                  />
                </div>
              );
            }
            const full = movieDetails.get(item.id);
            return (
              <div className="list-row" key={item.id}>
                {full ? (
                  <div className="div-wrapper-rating-testing">
                    <ListComponent
                      movie_object={full}
                      ratingDate={null}
                      betweenSlot={<AddToList movie={full} />}
                      actionSlot={
                        isOwner ? <RemoveButton {...removeProps} /> : null
                      }
                    />
                  </div>
                ) : (
                  <PendingMovieRow
                    item={item}
                    pending={!movieDetails.has(item.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="lists-modal-overlay" onClick={() => setEditing(false)}>
          <div className="lists-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lists-modal-head">
              <h3>Edit list</h3>
              <button
                className="lists-modal-close"
                onClick={() => setEditing(false)}
                aria-label="Close"
              >
                {String.fromCharCode(0x2715)}
              </button>
            </div>
            <form className="lists-create-form" onSubmit={handleSaveEdit}>
              <input
                type="text"
                placeholder="List name"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <button type="submit" disabled={!editTitle.trim() || savingEdit}>
                {savingEdit ? <Spinner /> : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

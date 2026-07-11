import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCovers } from "../contexts/UserCoversContext";
import { getDisplayName } from "../utils/profile";
import {
  getMyLists,
  getSavedLists,
  getListItemPreviews,
  createList,
  setListMagic,
  bulkAddListItems,
} from "../services/lists";
import MagicListModal from "../components/common/MagicListModal";
import { SignIn } from "./SignIn";
import Loader, { Spinner } from "../components/layout/Loader";
import "../styles/search/Toolbar.css";
import "../styles/pages/Lists.css";

function itemCount(list) {
  // PostgREST returns the aggregate as list_items: [{ count: N }]
  return list.list_items?.[0]?.count ?? 0;
}

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const day = 86400000;
  if (diff < 0) return "soon";
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "title", label: "Title (A–Z)" },
  { value: "author", label: "Author (A–Z)" },
  { value: "items", label: "Most items" },
];

function ListCard({ list, previews, saved }) {
  const { coverForTmdb, coverForHardcover } = useCovers();
  const count = itemCount(list);

  // User's per-title cover override wins over the stored snapshot image,
  // matching how ListView renders the same items.
  const coverOf = (it) =>
    it.media_type === "book"
      ? coverForHardcover(it.item_data?.hardcover_id) || it.item_data?.cover_image
      : coverForTmdb(it.item_data?.media_type, it.item_data?.tmdb_id) ||
        it.item_data?.primaryImage;

  return (
    <Link to={`/lists/${list.id}`} className="list-card">
      <div className="list-card-covers">
        {count === 0 ? (
          <div className="list-card-covers-blank">
            <img src="/images/lists.png" alt="" aria-hidden="true" />
          </div>
        ) : (
          Array.from({ length: 4 }, (_, i) => {
            const it = previews[i];
            if (!it) return <div key={i} className="list-card-cover-empty" />;
            return (
              <div key={i} className="list-card-cover">
                <img
                  src={coverOf(it) || "/images/placeholderimage.jpg"}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/images/placeholderimage.jpg";
                  }}
                />
              </div>
            );
          })
        )}
      </div>
      <div className="list-card-body">
        <h3 className="list-card-title">{list.title}</h3>
        <p className="list-card-owner">by {list.owner_name || "Unknown"}</p>
        {list.description && (
          <p className="list-card-desc">{list.description}</p>
        )}
      </div>
      <div className="list-card-foot">
        <span
          className="toolbar-count list-card-count"
          title={`${count} ${count === 1 ? "item" : "items"}`}
        >
          {count}
        </span>
        {list.magic && (
          <span className="list-card-magic-stack">
            <span
              className="list-card-magic"
              title={
                list.magic.scope === "global"
                  ? "Magic list, built from rules over TMDB & Hardcover"
                  : "Magic list, built from rules over your library"
              }
            >
              ✨ Magic
            </span>
            <span
              className={`list-card-magic${
                list.magic.scope === "global"
                  ? " lv-magic-global"
                  : " list-card-scope-library"
              }`}
            >
              {list.magic.scope === "global" ? "Global" : "Library"}
            </span>
          </span>
        )}
        {saved && <span className="list-card-saved">Saved</span>}
        <span className="list-card-updated">
          updated {timeAgo(list.updated_at)}
        </span>
      </div>
    </Link>
  );
}

export default function Lists() {
  const { user, isAuthenticated, loading } = useAuth();

  const [myLists, setMyLists] = useState([]);
  const [savedLists, setSavedLists] = useState([]);
  const [previews, setPreviews] = useState(new Map());
  const [dataLoading, setDataLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all"); // "all" | "mine" | "saved"
  const [authorFilter, setAuthorFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent");

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [showMagic, setShowMagic] = useState(false);
  const [creatingMagic, setCreatingMagic] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let active = true;
    (async () => {
      setDataLoading(true);
      try {
        const [mine, saved] = await Promise.all([
          getMyLists(user.id),
          getSavedLists(user.id),
        ]);
        if (!active) return;
        setMyLists(mine);
        setSavedLists(saved);
        const ids = [...new Set([...mine, ...saved].map((l) => l.id))];
        const prev = await getListItemPreviews(ids);
        if (active) setPreviews(prev);
      } catch (err) {
        console.error("Failed to load lists:", err);
      } finally {
        if (active) setDataLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  const savedIds = useMemo(
    () => new Set(savedLists.map((l) => l.id)),
    [savedLists],
  );

  // All lists (owned + saved) together, deduped, each tagged with the date used
  // for the "recent" sort (own lists by update time, saved ones by save time).
  const allLists = useMemo(() => {
    const owned = myLists.map((l) => ({ ...l, sortDate: l.updated_at }));
    const saved = savedLists.map((l) => ({
      ...l,
      sortDate: l.saved_at || l.updated_at,
    }));
    const map = new Map();
    [...owned, ...saved].forEach((l) => {
      if (!map.has(l.id)) map.set(l.id, l);
    });
    return Array.from(map.values());
  }, [myLists, savedLists]);

  const authors = useMemo(() => {
    const set = new Set();
    allLists.forEach((l) => l.owner_name && set.add(l.owner_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allLists]);

  const visibleLists = useMemo(() => {
    let arr = allLists;
    if (ownerFilter === "mine") {
      arr = arr.filter((l) => l.owner_id === user?.id);
    } else if (ownerFilter === "saved") {
      arr = arr.filter((l) => savedIds.has(l.id));
    }
    if (authorFilter !== "all") {
      arr = arr.filter((l) => l.owner_name === authorFilter);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (l) =>
          (l.title || "").toLowerCase().includes(q) ||
          (l.description || "").toLowerCase().includes(q) ||
          (l.owner_name || "").toLowerCase().includes(q),
      );
    }
    return [...arr].sort((a, b) => {
      if (sortKey === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortKey === "author") {
        return (a.owner_name || "").localeCompare(b.owner_name || "");
      }
      if (sortKey === "items") {
        return itemCount(b) - itemCount(a);
      }
      return new Date(b.sortDate) - new Date(a.sortDate);
    });
  }, [allLists, ownerFilter, authorFilter, searchTerm, sortKey, savedIds, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const list = await createList(user.id, {
        title: title.trim(),
        description: description.trim(),
        ownerName: getDisplayName(user),
      });
      setMyLists((prev) => [{ ...list, list_items: [{ count: 0 }] }, ...prev]);
      setTitle("");
      setDescription("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create list:", err);
    } finally {
      setCreating(false);
    }
  };

  // Create the list, store its rules and materialize the current matches in
  // one go, so the card lands populated.
  const handleCreateMagic = async ({ title, description, magic, snapshots }) => {
    if (creatingMagic) return;
    setCreatingMagic(true);
    try {
      const list = await createList(user.id, {
        title,
        description,
        ownerName: getDisplayName(user),
      });
      const withMagic = await setListMagic(list.id, magic);
      const rows = await bulkAddListItems(list.id, snapshots, 0);
      setMyLists((prev) => [
        { ...withMagic, list_items: [{ count: rows.length }] },
        ...prev,
      ]);
      setPreviews((prev) => {
        const next = new Map(prev);
        next.set(
          list.id,
          rows.slice(0, 4).map((r) => ({
            media_type: r.media_type,
            item_data: r.item_data,
          })),
        );
        return next;
      });
      setShowMagic(false);
    } catch (err) {
      console.error("Failed to create magic list:", err);
    } finally {
      setCreatingMagic(false);
    }
  };

  if (loading) return <Loader />;
  if (!isAuthenticated) return <SignIn />;

  return (
    <div className="page-stack">
      <div className="lists-header">
        <h1 className="page-title lists-page-title">Lists</h1>
        <div className="lists-header-actions">
          <button
            className="lists-create-btn lists-magic-btn"
            onClick={() => setShowMagic(true)}
          >
            ✨ Magic list
          </button>
          <button className="lists-create-btn" onClick={() => setShowCreate(true)}>
            + New list
          </button>
        </div>
      </div>

      {dataLoading ? (
        <Loader />
      ) : allLists.length === 0 ? (
        <div className="lists-empty-panel">
          <img src="/images/lists.png" alt="" aria-hidden="true" />
          <h2>No lists yet</h2>
          <p>
            Create a list to start collecting movies, TV and books to share.
            Any lists you save from other people will show up here too.
          </p>
          <div className="lists-empty-ctas">
            <button
              className="lists-create-btn lists-empty-cta"
              onClick={() => setShowCreate(true)}
            >
              + Create your first list
            </button>
            <button
              className="lists-create-btn lists-magic-btn lists-empty-cta"
              onClick={() => setShowMagic(true)}
            >
              ✨ Create a magic list
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="toolbar-search">
              <input
                className="toolbar-input"
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="toolbar-clear"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  {String.fromCharCode(0x2715)}
                </button>
              )}
            </div>
            <select
              className="toolbar-select"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="all">All lists</option>
              <option value="mine">My lists</option>
              <option value="saved">Saved lists</option>
            </select>
            {authors.length > 1 && (
              <select
                className="toolbar-select"
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
              >
                <option value="all">All authors</option>
                {authors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <select
              className="toolbar-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="toolbar-count">{visibleLists.length}</span>
          </div>

          {visibleLists.length === 0 ? (
            <p className="lists-empty">No lists match this filter.</p>
          ) : (
            <div className="lists-grid">
              {visibleLists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  previews={previews.get(list.id) || []}
                  saved={savedIds.has(list.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showMagic && (
        <MagicListModal
          mode="create"
          saving={creatingMagic}
          onClose={() => setShowMagic(false)}
          onSubmit={handleCreateMagic}
        />
      )}

      {showCreate && (
        <div className="lists-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="lists-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lists-modal-head">
              <h3>New list</h3>
              <button
                className="lists-modal-close"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                {String.fromCharCode(0x2715)}
              </button>
            </div>
            <form className="lists-create-form" onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="List name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <button type="submit" disabled={!title.trim() || creating}>
                {creating ? <Spinner /> : "Create list"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

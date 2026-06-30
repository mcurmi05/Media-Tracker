import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getDisplayName } from "../utils/profile";
import { getMyLists, getSavedLists, createList } from "../services/lists";
import { SignIn } from "./SignIn";
import Loader, { Spinner } from "../components/layout/Loader";
import "../styles/pages/Lists.css";

function itemCount(list) {
  // PostgREST returns the aggregate as list_items: [{ count: N }]
  return list.list_items?.[0]?.count ?? 0;
}

function ListCard({ list }) {
  const count = itemCount(list);
  return (
    <Link to={`/lists/${list.id}`} className="list-card">
      <h3 className="list-card-title">{list.title}</h3>
      <p className="list-card-owner">by {list.owner_name || "Unknown"}</p>
      {list.description && <p className="list-card-desc">{list.description}</p>}
      <span className="list-card-count">
        {count} {count === 1 ? "item" : "items"}
      </span>
    </Link>
  );
}

export default function Lists() {
  const { user, isAuthenticated, loading } = useAuth();

  const [myLists, setMyLists] = useState([]);
  const [savedLists, setSavedLists] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [authorFilter, setAuthorFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent"); // "recent" | "author"

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

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
    if (authorFilter !== "all") {
      arr = arr.filter((l) => l.owner_name === authorFilter);
    }
    return [...arr].sort((a, b) => {
      if (sortKey === "author") {
        return (a.owner_name || "").localeCompare(b.owner_name || "");
      }
      return new Date(b.sortDate) - new Date(a.sortDate);
    });
  }, [allLists, authorFilter, sortKey]);

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

  if (loading) return <Loader />;
  if (!isAuthenticated) return <SignIn />;

  return (
    <div className="page-stack">
      <div className="lists-header">
        <h1 className="page-title lists-page-title">Lists</h1>
        <button className="lists-create-btn" onClick={() => setShowCreate(true)}>
          + New list
        </button>
      </div>

      {dataLoading ? (
        <Loader />
      ) : allLists.length === 0 ? (
        <p className="lists-empty">
          No lists yet. Create one to start collecting movies, TV and books to
          share — and any lists you save from other people will show up here too.
        </p>
      ) : (
        <>
          <div className="lists-filter-bar">
            <label>
              Author
              <select
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
            </label>
            <label>
              Sort by
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="recent">Most recent</option>
                <option value="author">Author (A–Z)</option>
              </select>
            </label>
          </div>

          {visibleLists.length === 0 ? (
            <p className="lists-empty">No lists match this filter.</p>
          ) : (
            <div className="lists-grid">
              {visibleLists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          )}
        </>
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

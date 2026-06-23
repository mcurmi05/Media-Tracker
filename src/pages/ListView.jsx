import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { bookDetailsRoute } from "../utils/goodreads.js";
import {
  getListWithItems,
  updateList,
  deleteList,
  removeListItem,
  isListSaved,
  saveList,
  unsaveList,
} from "../services/lists.js";
import Loader, { Spinner } from "../components/Loader.jsx";
import "../styles/Lists.css";

function ListItemCard({ item, isOwner, onRemove, removing }) {
  const navigate = useNavigate();
  const d = item.item_data || {};

  const goTo = () => {
    if (item.media_type === "book") {
      const route = bookDetailsRoute(d.goodreads_link);
      if (route) navigate(route);
      else if (d.goodreads_link)
        window.open(d.goodreads_link, "_blank", "noopener,noreferrer");
      return;
    }
    if (d.tmdb_id != null) {
      navigate(`/mediadetails/${d.media_type}/${d.tmdb_id}`);
    }
  };

  const title = item.media_type === "book" ? d.title : d.primaryTitle;
  const image = item.media_type === "book" ? d.cover_image : d.primaryImage;
  const year = item.media_type === "book" ? d.release_year : d.startYear;
  const subtitle = item.media_type === "book" ? d.author : null;

  return (
    <div className="li-card">
      <button className="li-card-main" onClick={goTo}>
        <img
          className="li-poster"
          src={image || "/placeholderimage.jpg"}
          alt=""
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/placeholderimage.jpg";
          }}
        />
        <div className="li-info">
          <h3 className="li-title">{title || "Untitled"}</h3>
          {subtitle && <p className="li-subtitle">{subtitle}</p>}
          {year && <p className="li-year">{year}</p>}
          <span className={`li-type li-type-${item.media_type}`}>
            {item.media_type === "tv" ? "TV" : item.media_type}
          </span>
        </div>
      </button>
      {isOwner && (
        <button
          className="li-remove"
          onClick={() => onRemove(item.id)}
          disabled={removing}
          title="Remove from list"
          aria-label="Remove from list"
        >
          {String.fromCharCode(0x2715)}
        </button>
      )}
    </div>
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
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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
    if (!window.confirm("Delete this list? This can't be undone.")) return;
    try {
      await deleteList(list.id);
      navigate("/lists");
    } catch (err) {
      console.error("Failed to delete list:", err);
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
      <header className="lv-header">
        <h1 className="lv-title">{list.title}</h1>
        {list.owner_name && <p className="lv-owner">by {list.owner_name}</p>}
        {list.description && <p className="lv-desc">{list.description}</p>}
        <p className="lv-count">
          {list.items.length} {list.items.length === 1 ? "item" : "items"}
        </p>

        <div className="lv-actions">
          <button className="lv-btn" onClick={copyLink}>
            {copied ? "Link copied!" : "Copy share link"}
          </button>

          {isOwner ? (
            <>
              <button className="lv-btn" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="lv-btn lv-btn-danger" onClick={handleDelete}>
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

      {list.items.length === 0 ? (
        <div className="empty-msg">This list is empty.</div>
      ) : (
        <div className="li-grid">
          {list.items.map((item) => (
            <ListItemCard
              key={item.id}
              item={item}
              isOwner={isOwner}
              onRemove={handleRemoveItem}
              removing={removingId === item.id}
            />
          ))}
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

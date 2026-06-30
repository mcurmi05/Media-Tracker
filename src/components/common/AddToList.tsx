import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getDisplayName } from "../../utils/profile";
import { getBookInfo } from "../../utils/bookInfo";
import { findOrCreateBookEntry } from "../../services/ratingsfromtable";
import {
  getMyLists,
  createList,
  addMediaToList,
  listsContainingMedia,
  movieToListItem,
  bookToListItem,
} from "../../services/lists";
import { Spinner } from "../layout/Loader";
import "../../styles/pages/Lists.css";

// Icon button (reused on the media/book detail pages) that opens a modal for
// adding the current item to one of the user's lists, or to a brand new list.
export default function AddToList({ movie, book }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState([]);
  const [addedIds, setAddedIds] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [newTitle, setNewTitle] = useState("");

  const snapshot = book ? bookToListItem(book) : movieToListItem(movie);

  const openModal = async () => {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const mine = await getMyLists(user.id);
      setLists(mine);
      const contained = await listsContainingMedia(
        mine.map((l) => l.id),
        snapshot,
      );
      setAddedIds(contained);
    } catch (err) {
      console.error("Failed to load lists:", err);
    } finally {
      setLoading(false);
    }
  };

  const addTo = async (listId) => {
    if (addedIds.has(listId) || busyId) return;
    setBusyId(listId);
    try {
      const entry = book
        ? await findOrCreateBookEntry(getBookInfo(book))
        : null;
      const itemSnapshot = entry ? bookToListItem(entry) : snapshot;
      await addMediaToList(listId, itemSnapshot);
      setAddedIds((prev) => new Set(prev).add(listId));
    } catch (err) {
      console.error("Failed to add to list:", err);
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || busyId) return;
    setBusyId("new");
    try {
      const entry = book
        ? await findOrCreateBookEntry(getBookInfo(book))
        : null;
      const itemSnapshot = entry ? bookToListItem(entry) : snapshot;
      const list = await createList(user.id, {
        title,
        ownerName: getDisplayName(user),
      });
      await addMediaToList(list.id, itemSnapshot);
      setLists((prev) => [{ ...list, list_items: [{ count: 1 }] }, ...prev]);
      setAddedIds((prev) => new Set(prev).add(list.id));
      setNewTitle("");
    } catch (err) {
      console.error("Failed to create list:", err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="white-highlight add-to-list-btn" title="Add to list">
        <img src="/images/lists.png" className="addlog-icon" onClick={openModal} alt="Add to list" />
      </div>

      {open && createPortal(
        <div className="lists-modal-overlay" onClick={() => setOpen(false)}>
          <div className="lists-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lists-modal-head">
              <h3>Add to list</h3>
              <button
                className="lists-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                {String.fromCharCode(0x2715)}
              </button>
            </div>

            {loading ? (
              <div className="lists-modal-loading">
                <Spinner />
              </div>
            ) : (
              <>
                <form className="lists-modal-new" onSubmit={createAndAdd}>
                  <input
                    type="text"
                    placeholder="New list name..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={100}
                  />
                  <button type="submit" disabled={!newTitle.trim() || busyId === "new"}>
                    {busyId === "new" ? <Spinner /> : "Create"}
                  </button>
                </form>

                <div className="lists-modal-list">
                  {lists.length === 0 ? (
                    <p className="lists-modal-empty">
                      You don't have any lists yet — create one above.
                    </p>
                  ) : (
                    lists.map((list) => {
                      const added = addedIds.has(list.id);
                      return (
                        <button
                          key={list.id}
                          className={`lists-modal-row${added ? " is-added" : ""}`}
                          onClick={() => addTo(list.id)}
                          disabled={added || busyId === list.id}
                        >
                          <span className="lists-modal-row-title">{list.title}</span>
                          <span className="lists-modal-row-action">
                            {busyId === list.id ? (
                              <Spinner />
                            ) : added ? (
                              "Added ✓"
                            ) : (
                              "Add"
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

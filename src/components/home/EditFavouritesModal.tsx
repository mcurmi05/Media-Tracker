import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase-client";

const CATS = [
  { key: "movies", label: "Movies" },
  { key: "tv", label: "TV Shows" },
  { key: "books", label: "Books" },
];

// Pick-your-own 4 favourites editor. Selections live in auth user_metadata
// (favourites_v1), so no extra tables: { manual, movies: [], tv: [], books: [] }
// holding entry ids in pick order. When manual is off the home page keeps
// using the top-ranked titles.
export default function EditFavouritesModal({
  onClose,
  options, // { movies: [{id,title,cover,rating}], tv: [...], books: [...] }
  initial,
}) {
  const [manual, setManual] = useState(!!initial?.manual);
  const [sel, setSel] = useState({
    movies: initial?.movies || [],
    tv: initial?.tv || [],
    books: initial?.books || [],
  });
  const [tab, setTab] = useState("movies");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSearch("");
  }, [tab]);

  const list = useMemo(() => {
    const items = options[tab] || [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) => (o.title || "").toLowerCase().includes(q));
  }, [options, tab, search]);

  const picked = sel[tab];

  const toggle = (id) => {
    setSel((prev) => {
      const cur = prev[tab];
      if (cur.includes(id))
        return { ...prev, [tab]: cur.filter((x) => x !== id) };
      if (cur.length >= 4) return prev;
      return { ...prev, [tab]: [...cur, id] };
    });
  };

  async function save() {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        favourites_v1: {
          manual,
          movies: sel.movies,
          tv: sel.tv,
          books: sel.books,
        },
      },
    });
    setSaving(false);
    if (error) {
      console.error("Failed to save favourites:", error);
      alert("Failed to save favourites. Please try again.");
      return;
    }
    onClose();
  }

  return (
    <div className="hp-rec-modal-backdrop" onClick={onClose} role="button" tabIndex={-1}>
      <div
        className="hp-rec-modal hp-fav-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="hp-rec-close"
          onClick={onClose}
          aria-label="Close"
        >
          {String.fromCharCode(0x00d7)}
        </button>
        <div className="hp-fav-title">Edit 4 Favourites</div>

        <button
          type="button"
          className={`hp-toggle hp-fav-manual${manual ? " hp-toggle-on" : ""}`}
          onClick={() => setManual((v) => !v)}
          aria-pressed={manual}
        >
          <span className="hp-toggle-box">
            {manual && (
              <svg className="hp-toggle-tick" viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M2.5 6.2l2.3 2.3 4.7-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="hp-toggle-label">Choose 4 favourites freely</span>
        </button>

        {manual ? (
          <>
            <div className="hp-fav-tabs">
              {CATS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`hp-fav-tab${tab === c.key ? " is-active" : ""}`}
                  onClick={() => setTab(c.key)}
                >
                  {c.label}
                  <span className="hp-fav-count">{sel[c.key].length}/4</span>
                </button>
              ))}
            </div>
            <input
              className="hp-fav-search"
              type="text"
              placeholder="Search your rated titles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {list.length === 0 ? (
              <p className="hp-empty">No rated titles found.</p>
            ) : (
              <div className="hp-fav-grid">
                {list.map((o) => {
                  const pos = picked.indexOf(o.id);
                  return (
                    <div
                      key={o.id}
                      className={`hp-fav-option${pos !== -1 ? " is-picked" : ""}`}
                      onClick={() => toggle(o.id)}
                      title={o.title}
                    >
                      <img
                        src={o.cover || "/images/placeholderimage.jpg"}
                        alt={o.title || ""}
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/images/placeholderimage.jpg";
                        }}
                      />
                      {pos !== -1 && (
                        <span className="hp-fav-pick-badge">{pos + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="hp-fav-hint">
            Your 4 favourites are taken from your top-ranked titles. Tick the
            box above to pick any 4 of your rated titles instead.
          </p>
        )}

        <div className="hp-fav-actions">
          <button
            type="button"
            className="hp-fav-save"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

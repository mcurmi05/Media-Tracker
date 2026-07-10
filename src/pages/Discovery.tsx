import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Plus, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useRatings } from "../contexts/UserRatingsContext";
import { useLogs } from "../contexts/UserLogsContext";
import { useWatchlist } from "../contexts/UserWatchlistContext";
import { useCovers } from "../contexts/UserCoversContext";
import {
  searchMovies,
  getRecommendations,
  getMovieById,
} from "../services/api";
import { supabase } from "../services/supabase-client";
import IMDBInfo from "../components/media/IMDBInfo";
import LetterboxdInfo from "../components/media/LetterboxdInfo";
import { SignIn } from "./SignIn";
import "../styles/pages/Home.css";
import "../styles/pages/Discovery.css";

const MAX_SEEDS = 8;

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

// Expand a TMDB genre name into the curated names above, so TV combo genres
// ("Sci-Fi & Fantasy", "Action & Adventure") still match single selections.
function genreTokens(name) {
  return (name || "")
    .split("&")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "sci-fi") return "science fiction";
      if (p === "kids") return "family";
      if (p === "politics") return null;
      return p;
    })
    .filter(Boolean);
}

function matchesGenres(item, selected) {
  if (!selected.length) return true;
  const tokens = new Set(
    (item.interests || []).flatMap((g) => genreTokens(g)),
  );
  return selected.some((g) => tokens.has(g.toLowerCase()));
}

const DEFAULT_FILTERS = {
  type: "all",
  minImdbRating: 0,
  maxImdbRating: 0, // 0 = no cap
  minImdbVotes: 0,
  maxImdbVotes: 0, // 0 = no cap
  genres: [],
  yearFrom: "",
  yearTo: "",
};

function loadTemplate() {
  try {
    const raw = JSON.parse(localStorage.getItem("discovery-template") || "{}");
    return {
      seeds: Array.isArray(raw.seeds) ? raw.seeds.slice(0, MAX_SEEDS) : [],
      filters: { ...DEFAULT_FILTERS, ...(raw.filters || {}) },
    };
  } catch {
    return { seeds: [], filters: { ...DEFAULT_FILTERS } };
  }
}

export default function Discovery() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { userRatings } = useRatings();
  const { userLogs } = useLogs();
  const { userWatchlist } = useWatchlist();
  const { coverForTmdb } = useCovers();

  const [{ seeds, filters }, setTemplate] = useState(loadTemplate);
  const setSeeds = (fn) =>
    setTemplate((t) => ({ ...t, seeds: fn(t.seeds) }));
  const setFilters = (fn) =>
    setTemplate((t) => ({ ...t, filters: fn(t.filters) }));
  useEffect(() => {
    localStorage.setItem(
      "discovery-template",
      JSON.stringify({ seeds, filters }),
    );
  }, [seeds, filters]);

  const [results, setResults] = useState(null); // null until first run
  const [searching, setSearching] = useState(false);

  // seed picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const searchTimer = useRef(null);

  // clicked result popup ("because you liked" + live ratings)
  const [recInfo, setRecInfo] = useState(null);
  const [recDetails, setRecDetails] = useState(null);
  useEffect(() => {
    if (!recInfo) {
      setRecDetails(null);
      return;
    }
    let live = true;
    setRecDetails(null);
    getMovieById(recInfo.media_type, recInfo.tmdb_id)
      .then((d) => live && setRecDetails(d || null))
      .catch(() => live && setRecDetails(null));
    return () => {
      live = false;
    };
  }, [recInfo]);

  useEffect(() => {
    if (!pickerOpen) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (!q) {
      setOptions([]);
      return;
    }
    setOptionsLoading(true);
    searchTimer.current = setTimeout(() => {
      searchMovies(q)
        .then((res) => {
          setOptions((res || []).filter((r) => r.tmdb_id != null).slice(0, 12));
        })
        .catch(() => setOptions([]))
        .finally(() => setOptionsLoading(false));
    }, 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [query, pickerOpen]);

  const addSeed = (item) => {
    setSeeds((prev) => {
      if (prev.length >= MAX_SEEDS) return prev;
      if (
        prev.some(
          (s) => s.tmdb_id === item.tmdb_id && s.media_type === item.media_type,
        )
      )
        return prev;
      return [
        ...prev,
        {
          tmdb_id: item.tmdb_id,
          media_type: item.media_type,
          primaryTitle: item.primaryTitle,
          primaryImage: item.primaryImage,
          startYear: item.startYear,
        },
      ];
    });
    setPickerOpen(false);
    setQuery("");
    setOptions([]);
  };

  const removeSeed = (idx) =>
    setSeeds((prev) => prev.filter((_, i) => i !== idx));

  const filtersActive =
    filters.type !== "all" ||
    filters.minImdbRating > 0 ||
    filters.maxImdbRating > 0 ||
    filters.minImdbVotes > 0 ||
    filters.maxImdbVotes > 0 ||
    filters.genres.length > 0 ||
    filters.yearFrom !== "" ||
    filters.yearTo !== "";

  // Watchlisted titles still surface (flagged with a watchlist mark); titles
  // already rated or logged are split into their own list under the results.
  const watchlisted = useMemo(() => {
    const key = (mt, id) => `${mt}:${id}`;
    return new Set(
      userWatchlist.map((w) =>
        key(w.movie_object?.media_type, w.movie_object?.tmdb_id),
      ),
    );
  }, [userWatchlist]);
  const seen = useMemo(() => {
    const key = (mt, id) => `${mt}:${id}`;
    return new Set([
      ...userRatings.map((r) =>
        key(r.movie_object?.media_type, r.movie_object?.tmdb_id),
      ),
      ...userLogs.map((l) =>
        key(l.movie_object?.media_type, l.movie_object?.tmdb_id),
      ),
    ]);
  }, [userRatings, userLogs]);

  async function discover() {
    if (!seeds.length || searching) return;
    setSearching(true);
    try {
      const lists = await Promise.all(
        seeds.map((s) => getRecommendations(s.media_type, s.tmdb_id)),
      );

      // Consensus scoring, same idea as the old home strip: candidates that
      // several seeds recommend rise; TMDB's per-list order breaks ties. Each
      // keeps the seeds that produced it ("because you liked X").
      const key = (mt, id) => `${mt}:${id}`;
      const seedKeys = new Set(seeds.map((s) => key(s.media_type, s.tmdb_id)));
      const scored = new Map();
      lists.forEach((list, i) => {
        const seed = seeds[i];
        (list || []).forEach((m, pos) => {
          const k = key(m.media_type, m.tmdb_id);
          if (seedKeys.has(k)) return;
          if (filters.type !== "all" && m.media_type !== filters.type) return;
          if (!matchesGenres(m, filters.genres)) return;
          const yf = Number(filters.yearFrom);
          const yt = Number(filters.yearTo);
          if (yf && (!m.startYear || m.startYear < yf)) return;
          if (yt && (!m.startYear || m.startYear > yt)) return;
          // Server-side blended score (sources + quality); positional decay
          // as a fallback for stale cached responses without rec_score.
          const s = m.rec_score ?? 1 / (1 + pos / 20);
          const e = scored.get(k);
          if (e) {
            e.count++;
            e.score += s;
            e.bestPos = Math.min(e.bestPos, pos);
            e.reasons.push(seed);
          } else {
            scored.set(k, {
              item: m,
              count: 1,
              score: s,
              bestPos: pos,
              reasons: [seed],
            });
          }
        });
      });

      // Summed scores already reward consensus (each seed adds its score);
      // count and position only break ties.
      let ranked = [...scored.values()].sort(
        (a, b) =>
          b.score - a.score || b.count - a.count || a.bestPos - b.bestPos,
      );

      // IMDb rating/vote bounds via the imdb_ratings dataset (by tconst).
      // With any bound set, titles missing from the dataset are excluded.
      const imdbActive =
        filters.minImdbRating > 0 ||
        filters.maxImdbRating > 0 ||
        filters.minImdbVotes > 0 ||
        filters.maxImdbVotes > 0;
      if (imdbActive) {
        const imdbMap = {};
        const tconsts = ranked
          .map((e) => e.item.id)
          .filter((t) => typeof t === "string" && t.startsWith("tt"));
        for (let i = 0; i < tconsts.length; i += 200) {
          const { data } = await supabase
            .from("imdb_ratings")
            .select("tconst, rating, votes")
            .in("tconst", tconsts.slice(i, i + 200));
          (data || []).forEach((r) => {
            imdbMap[r.tconst] = r;
          });
        }
        ranked = ranked.filter((e) => {
          const row = imdbMap[e.item.id];
          if (!row) return false;
          const rating = row.rating ?? 0;
          const votes = row.votes ?? 0;
          if (filters.minImdbRating > 0 && rating < filters.minImdbRating)
            return false;
          if (filters.maxImdbRating > 0 && rating > filters.maxImdbRating)
            return false;
          if (filters.minImdbVotes > 0 && votes < filters.minImdbVotes)
            return false;
          if (filters.maxImdbVotes > 0 && votes > filters.maxImdbVotes)
            return false;
          e.imdb = row;
          return true;
        });
      }

      // Everything that survives the filters is shown: fresh finds (with
      // watchlisted ones flagged) up top, titles already rated/logged below.
      const all = ranked.map((e) => {
        const k = `${e.item.media_type}:${e.item.tmdb_id}`;
        return {
          ...e.item,
          _reasons: e.reasons,
          _imdb: e.imdb || null,
          _watchlisted: watchlisted.has(k),
          _seen: seen.has(k),
        };
      });
      setResults({
        fresh: all.filter((m) => !m._seen),
        seen: all.filter((m) => m._seen),
      });
    } catch (err) {
      console.error("discover failed:", err);
      setResults({ fresh: [], seen: [] });
    } finally {
      setSearching(false);
    }
  }

  if (!loading && !isAuthenticated) return <SignIn />;

  const ratingOptions = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
  const voteOptions = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];

  return (
    <div className="dv-page">
      <h1 className="dv-title">Discovery</h1>

      <div className="dv-panel">
        <div className="dv-label">Because I liked...</div>
        <div className="dv-seeds">
          {seeds.map((s, i) => (
            <div key={`${s.media_type}-${s.tmdb_id}`} className="dv-seed">
              <img
                src={
                  coverForTmdb(s.media_type, s.tmdb_id) ||
                  s.primaryImage ||
                  "/images/placeholderimage.jpg"
                }
                alt={s.primaryTitle}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/images/placeholderimage.jpg";
                }}
              />
              <button
                type="button"
                className="dv-seed-remove"
                onClick={() => removeSeed(i)}
                aria-label={`Remove ${s.primaryTitle}`}
              >
                <X size={12} />
              </button>
              <span className="dv-seed-title">{s.primaryTitle}</span>
            </div>
          ))}
          {seeds.length < MAX_SEEDS && (
            <button
              type="button"
              className="dv-seed dv-seed-add"
              onClick={() => setPickerOpen(true)}
              aria-label="Add a title"
            >
              <Plus size={26} />
            </button>
          )}
        </div>

        <div className="dv-label">And I want...</div>
        <div className="dv-filters">
          <div className="dv-filter">
            <label htmlFor="dv-type">Type</label>
            <select
              id="dv-type"
              value={filters.type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, type: e.target.value }))
              }
            >
              <option value="all">Movies & TV</option>
              <option value="movie">Movies only</option>
              <option value="tv">TV only</option>
            </select>
          </div>
          <div className="dv-filter">
            <label htmlFor="dv-imdb-min">IMDb rating</label>
            <div className="dv-range">
              <select
                id="dv-imdb-min"
                value={filters.minImdbRating}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minImdbRating: Number(e.target.value),
                  }))
                }
              >
                <option value={0}>Min</option>
                {ratingOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}+
                  </option>
                ))}
              </select>
              <span className="dv-range-dash">–</span>
              <select
                aria-label="Maximum IMDb rating"
                value={filters.maxImdbRating}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxImdbRating: Number(e.target.value),
                  }))
                }
              >
                <option value={0}>Max</option>
                {ratingOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="dv-filter">
            <label htmlFor="dv-votes-min">IMDb votes</label>
            <div className="dv-range">
              <select
                id="dv-votes-min"
                value={filters.minImdbVotes}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minImdbVotes: Number(e.target.value),
                  }))
                }
              >
                <option value={0}>Min</option>
                {voteOptions.map((v) => (
                  <option key={v} value={v}>
                    {v.toLocaleString()}+
                  </option>
                ))}
              </select>
              <span className="dv-range-dash">–</span>
              <select
                aria-label="Maximum IMDb votes"
                value={filters.maxImdbVotes}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxImdbVotes: Number(e.target.value),
                  }))
                }
              >
                <option value={0}>Max</option>
                {voteOptions.map((v) => (
                  <option key={v} value={v}>
                    {v.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="dv-filter">
            <label htmlFor="dv-year-from">Released</label>
            <div className="dv-range">
              <input
                id="dv-year-from"
                type="number"
                placeholder="From"
                min="1900"
                max="2100"
                value={filters.yearFrom}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, yearFrom: e.target.value }))
                }
              />
              <span className="dv-range-dash">–</span>
              <input
                aria-label="Released before"
                type="number"
                placeholder="To"
                min="1900"
                max="2100"
                value={filters.yearTo}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, yearTo: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <div className="dv-genres">
          {GENRES.map((g) => {
            const on = filters.genres.includes(g);
            return (
              <button
                key={g}
                type="button"
                className={`dv-genre${on ? " is-on" : ""}`}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    genres: on
                      ? f.genres.filter((x) => x !== g)
                      : [...f.genres, g],
                  }))
                }
              >
                {g}
              </button>
            );
          })}
        </div>

        <div className="dv-actions">
          {filtersActive && (
            <button
              type="button"
              className="dv-clear"
              onClick={() => setFilters(() => ({ ...DEFAULT_FILTERS }))}
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            className="dv-go"
            onClick={discover}
            disabled={!seeds.length || searching}
          >
            {searching ? "Discovering..." : "Discover"}
          </button>
        </div>
      </div>

      {results !== null &&
        (() => {
          const card = (m) => (
            <div
              key={`${m.media_type}-${m.tmdb_id}`}
              className="dv-result"
              onClick={() => setRecInfo(m)}
            >
              <div className="dv-result-poster">
                <img
                  src={m.primaryImage || "/images/placeholderimage.jpg"}
                  alt={m.primaryTitle}
                  loading="lazy"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/images/placeholderimage.jpg";
                  }}
                />
                {m._imdb && (
                  <span className="dv-result-badge">
                    {Number(m._imdb.rating).toFixed(1)}
                  </span>
                )}
                {m._watchlisted && (
                  <span
                    className="dv-result-flag"
                    title="On your watchlist"
                    aria-label="On your watchlist"
                  >
                    <Bookmark size={13} />
                  </span>
                )}
              </div>
              <span className="dv-result-title">{m.primaryTitle}</span>
              <span className="dv-result-year">{m.startYear || ""}</span>
            </div>
          );
          return (
            <div className="dv-results">
              {results.fresh.length === 0 && results.seen.length === 0 ? (
                <p className="dv-empty">
                  Nothing fits this template. Loosen the filters or add more
                  titles.
                </p>
              ) : (
                <>
                  {results.fresh.length === 0 ? (
                    <p className="dv-empty">
                      Nothing new fits this template - everything it found is
                      already in your ratings or logs below.
                    </p>
                  ) : (
                    <div className="dv-grid">{results.fresh.map(card)}</div>
                  )}
                  {results.seen.length > 0 && (
                    <>
                      <h2 className="dv-seen-title">
                        Already in your ratings & logs
                      </h2>
                      <div className="dv-grid">{results.seen.map(card)}</div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })()}

      {/* seed search modal */}
      {pickerOpen && (
        <div
          className="hp-rec-modal-backdrop"
          onClick={() => setPickerOpen(false)}
          role="button"
          tabIndex={-1}
        >
          <div className="hp-rec-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hp-rec-close"
              onClick={() => setPickerOpen(false)}
              aria-label="Close"
            >
              {String.fromCharCode(0x00d7)}
            </button>
            <div className="hp-fav-title">Add a title you liked</div>
            <input
              className="hp-fav-search"
              type="text"
              autoFocus
              placeholder="Search movies and TV shows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {optionsLoading ? (
              <p className="dv-picker-note">Searching...</p>
            ) : options.length === 0 ? (
              <p className="dv-picker-note">
                {query.trim() ? "No results." : "Type to search."}
              </p>
            ) : (
              <div className="dv-picker-list">
                {options.map((o) => (
                  <button
                    key={`${o.media_type}-${o.tmdb_id}`}
                    type="button"
                    className="dv-picker-row"
                    onClick={() => addSeed(o)}
                  >
                    <img
                      src={o.primaryImage || "/images/placeholderimage.jpg"}
                      alt=""
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/images/placeholderimage.jpg";
                      }}
                    />
                    <span className="dv-picker-title">{o.primaryTitle}</span>
                    <span className="dv-picker-sub">
                      {o.startYear || ""}
                      {o.media_type === "tv" ? " · TV" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* result popup: live ratings + which seeds produced it */}
      {recInfo && (
        <div
          className="hp-rec-modal-backdrop"
          onClick={() => setRecInfo(null)}
          role="button"
          tabIndex={-1}
        >
          <div className="hp-rec-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hp-rec-close"
              onClick={() => setRecInfo(null)}
              aria-label="Close"
            >
              {String.fromCharCode(0x00d7)}
            </button>
            <div className="hp-rec-modal-head">
              <img
                className="hp-rec-modal-poster hp-rec-modal-clickable"
                src={recInfo.primaryImage || "/images/placeholderimage.jpg"}
                alt=""
                onClick={() =>
                  navigate(
                    `/mediadetails/${recInfo.media_type}/${recInfo.tmdb_id}`,
                  )
                }
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/images/placeholderimage.jpg";
                }}
              />
              <div className="hp-rec-modal-info">
                <div
                  className="hp-rec-modal-title hp-rec-modal-clickable"
                  onClick={() =>
                    navigate(
                      `/mediadetails/${recInfo.media_type}/${recInfo.tmdb_id}`,
                    )
                  }
                >
                  {recInfo.primaryTitle}
                </div>
                {recInfo.startYear && (
                  <div className="hp-rec-modal-year">{recInfo.startYear}</div>
                )}
                {recDetails && (
                  <>
                    <div className="hp-rec-ratings">
                      <IMDBInfo movie={recDetails} useLiveRating />
                      {recInfo.media_type === "movie" && (
                        <LetterboxdInfo movie={recDetails} live />
                      )}
                    </div>
                    {(() => {
                      const crew =
                        recInfo.media_type === "tv"
                          ? recDetails.creators
                          : recDetails.directors;
                      const label =
                        recInfo.media_type === "tv" ? "Creator" : "Director";
                      if (!crew || crew.length === 0) return null;
                      return (
                        <div className="hp-rec-crew">
                          <span className="hp-rec-crew-label">{label}</span>{" "}
                          {crew.map((c) => c.fullName).join(", ")}
                        </div>
                      );
                    })()}
                    {recDetails.cast?.length > 0 && (
                      <div className="hp-rec-crew">
                        <span className="hp-rec-crew-label">Cast</span>{" "}
                        {recDetails.cast
                          .filter(
                            (c) => c.job === "actor" || c.job === "actress",
                          )
                          .slice(0, 4)
                          .map((c) => c.fullName)
                          .join(", ")}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="hp-rec-because-label">Because you liked</div>
            <div className="hp-rec-seeds">
              {(recInfo._reasons || []).map((r) => (
                <div
                  key={`${r.media_type}-${r.tmdb_id}`}
                  className="hp-rec-seed"
                  onClick={() =>
                    navigate(`/mediadetails/${r.media_type}/${r.tmdb_id}`)
                  }
                >
                  <div className="hp-rec-seed-poster">
                    <img
                      src={
                        coverForTmdb(r.media_type, r.tmdb_id) ||
                        r.primaryImage ||
                        "/images/placeholderimage.jpg"
                      }
                      alt=""
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/images/placeholderimage.jpg";
                      }}
                    />
                  </div>
                  <div className="hp-rec-seed-title">{r.primaryTitle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

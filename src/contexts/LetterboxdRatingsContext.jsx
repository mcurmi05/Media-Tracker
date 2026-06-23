import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../services/supabase-client";

/* eslint-disable react-refresh/only-export-components */

// Live Letterboxd ratings, served from the `letterboxd_ratings` table that a
// daily GitHub Action refreshes (catalogue movies + current TMDB trending).
// Components ask for a single title's rating via useLetterboxdRating(tmdbId);
// the provider coalesces every id requested in a short window into one batched
// query, so a whole list/trending page costs a single request.
//
// Ratings are on Letterboxd's native 0–5 scale. Keyed by tmdb_id (movies only).

const LetterboxdRatingsContext = createContext(null);

const CHUNK = 300;
const FLUSH_DELAY_MS = 50;

export function LetterboxdRatingsProvider({ children }) {
  // tmdb_id -> { rating, ratingCount, slug } when found, or null
  // when looked up but absent (so we don't keep re-requesting it).
  const [ratings, setRatings] = useState({});
  const cacheRef = useRef(ratings);
  cacheRef.current = ratings;

  const pendingRef = useRef(new Set());
  const inflightRef = useRef(new Set());
  const timerRef = useRef(null);

  const flush = useCallback(async () => {
    timerRef.current = null;
    const ids = [...pendingRef.current];
    pendingRef.current.clear();
    if (ids.length === 0) return;
    ids.forEach((id) => inflightRef.current.add(id));

    const updates = {};
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("letterboxd_ratings")
        .select("tmdb_id, slug, rating, rating_count")
        .in("tmdb_id", slice);
      if (error) {
        console.error("letterboxd_ratings fetch error", error);
        slice.forEach((id) => inflightRef.current.delete(id));
        continue;
      }
      const found = new Set();
      (data || []).forEach((row) => {
        updates[row.tmdb_id] = {
          rating: row.rating,
          ratingCount: row.rating_count,
          slug: row.slug,
        };
        found.add(Number(row.tmdb_id));
      });
      slice.forEach((id) => {
        if (!found.has(Number(id))) updates[id] = null;
      });
    }
    if (Object.keys(updates).length > 0) {
      setRatings((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const request = useCallback(
    (tmdbId) => {
      const id = Number(tmdbId);
      if (!Number.isInteger(id) || id <= 0) return;
      if (id in cacheRef.current) return;
      if (inflightRef.current.has(id)) return;
      pendingRef.current.add(id);
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
      }
    },
    [flush],
  );

  // Force a fresh scrape of one title (used by the media details page) via the
  // serverless function, then merge the result into the cache.
  const refresh = useCallback(async (tmdbId) => {
    const id = Number(tmdbId);
    if (!Number.isInteger(id) || id <= 0) return;
    try {
      const res = await fetch(`/api/letterboxd?tmdb_id=${id}`);
      if (!res.ok) return;
      const d = await res.json();
      setRatings((prev) => ({
        ...prev,
        [id]: {
          rating: d.rating,
          ratingCount: d.ratingCount,
          slug: d.slug,
        },
      }));
    } catch {
      /* leave whatever the cache had */
    }
  }, []);

  return (
    <LetterboxdRatingsContext.Provider value={{ ratings, request, refresh }}>
      {children}
    </LetterboxdRatingsContext.Provider>
  );
}

// Whole cache map plus request fn, for pages that sort a list by Letterboxd
// rating. Reading `ratings` here makes the consumer re-render as batches arrive.
export function useLetterboxdRatings() {
  const ctx = useContext(LetterboxdRatingsContext);
  return ctx || { ratings: {}, request: () => {}, refresh: async () => {} };
}

// Returns: undefined while loading, null if the title has no Letterboxd rating,
// or { rating, ratingCount, slug } when available.
// Pass { live: true } to additionally trigger a fresh on-demand scrape.
export function useLetterboxdRating(tmdbId, { live = false } = {}) {
  const ctx = useContext(LetterboxdRatingsContext);
  const request = ctx?.request;
  const refresh = ctx?.refresh;
  useEffect(() => {
    if (request) request(tmdbId);
    if (live && refresh) refresh(tmdbId);
  }, [tmdbId, live, request, refresh]);
  if (!ctx) return undefined;
  return tmdbId in ctx.ratings ? ctx.ratings[tmdbId] : undefined;
}

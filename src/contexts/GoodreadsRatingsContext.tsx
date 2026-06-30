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

// Live Goodreads ratings, served from the `goodreads_ratings` table that a
// daily GitHub Action refreshes (every book in our catalogue). Components ask
// for a single book's rating via useGoodreadsRating(goodreadsId); the provider
// coalesces every id requested in a short window into one batched query, so a
// whole list/search page costs a single request.
//
// Ratings are on Goodreads' native 0–5 scale. Keyed by the numeric Goodreads
// book id (the books analogue of tmdb_id). This is the books twin of
// LetterboxdRatingsContext.

const GoodreadsRatingsContext = createContext(null);

const CHUNK = 300;
const FLUSH_DELAY_MS = 50;

export function GoodreadsRatingsProvider({ children }) {
  // goodreads_id -> { rating, ratingCount, slug } when found, or null
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
        .from("goodreads_ratings")
        .select("goodreads_id, slug, rating, rating_count")
        .in("goodreads_id", slice);
      if (error) {
        console.error("goodreads_ratings fetch error", error);
        slice.forEach((id) => inflightRef.current.delete(id));
        continue;
      }
      const found = new Set();
      (data || []).forEach((row) => {
        updates[row.goodreads_id] = {
          rating: row.rating,
          ratingCount: row.rating_count,
          slug: row.slug,
        };
        found.add(Number(row.goodreads_id));
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
    (goodreadsId) => {
      const id = Number(goodreadsId);
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

  // Force a fresh scrape of one book (used by the book details page) via the
  // serverless function, then merge the result into the cache.
  const refresh = useCallback(async (goodreadsId) => {
    const id = Number(goodreadsId);
    if (!Number.isInteger(id) || id <= 0) return;
    try {
      const res = await fetch(`/api/goodreads-rating?id=${id}`);
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
    <GoodreadsRatingsContext.Provider value={{ ratings, request, refresh }}>
      {children}
    </GoodreadsRatingsContext.Provider>
  );
}

// Whole cache map plus request fn, for pages that sort a list by Goodreads
// rating. Reading `ratings` here makes the consumer re-render as batches arrive.
export function useGoodreadsRatings() {
  const ctx = useContext(GoodreadsRatingsContext);
  return ctx || { ratings: {}, request: () => {}, refresh: async () => {} };
}

// Returns: undefined while loading, null if the book has no Goodreads rating,
// or { rating, ratingCount, slug } when available.
// Pass { live: true } to additionally trigger a fresh on-demand scrape.
export function useGoodreadsRating(goodreadsId, { live = false } = {}) {
  const ctx = useContext(GoodreadsRatingsContext);
  const request = ctx?.request;
  const refresh = ctx?.refresh;
  useEffect(() => {
    if (request) request(goodreadsId);
    if (live && refresh) refresh(goodreadsId);
  }, [goodreadsId, live, request, refresh]);
  if (!ctx) return undefined;
  return goodreadsId in ctx.ratings ? ctx.ratings[goodreadsId] : undefined;
}

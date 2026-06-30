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

// Live IMDb ratings, served from the `imdb_ratings` table that a daily
// GitHub Action refreshes from IMDb's public dataset. Components ask for a
// single title's rating via useImdbRating(tconst); the provider collects all
// the ids requested in a short window and fetches them in one batched query,
// so a whole list page only costs a single request no matter how long it is.

const ImdbRatingsContext = createContext(null);

// How many ids to put in a single `.in()` filter. Keeps the request URL well
// under length limits even on very long lists.
const CHUNK = 300;
// Wait this long after the first request before firing, so ids from every
// item on the page get coalesced into the same batch.
const FLUSH_DELAY_MS = 50;

export function ImdbRatingsProvider({ children }) {
  // tconst -> { rating, votes } when found, or null when looked up but absent
  // from the dataset (so we don't keep re-requesting it).
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
        .from("imdb_ratings")
        .select("tconst, rating, votes")
        .in("tconst", slice);
      if (error) {
        console.error("imdb_ratings fetch error", error);
        // Let these ids be retried on a later request.
        slice.forEach((id) => inflightRef.current.delete(id));
        continue;
      }
      const found = new Set();
      (data || []).forEach((row) => {
        updates[row.tconst] = { rating: row.rating, votes: row.votes };
        found.add(row.tconst);
      });
      // Cache misses as null so they aren't requested again.
      slice.forEach((id) => {
        if (!found.has(id)) updates[id] = null;
      });
    }
    if (Object.keys(updates).length > 0) {
      setRatings((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const request = useCallback(
    (tconst) => {
      if (typeof tconst !== "string" || !tconst.startsWith("tt")) return;
      if (tconst in cacheRef.current) return;
      if (inflightRef.current.has(tconst)) return;
      pendingRef.current.add(tconst);
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
      }
    },
    [flush],
  );

  return (
    <ImdbRatingsContext.Provider value={{ ratings, request }}>
      {children}
    </ImdbRatingsContext.Provider>
  );
}

// Whole cache map plus the request fn, for pages that need to sort a list by
// live IMDb rating / vote count. Reading `ratings` here makes the consumer
// re-render (and re-sort) as batches arrive.
export function useImdbRatings() {
  const ctx = useContext(ImdbRatingsContext);
  return ctx || { ratings: {}, request: () => {} };
}

// Returns: undefined while loading, null if the title has no dataset entry,
// or { rating, votes } when available.
export function useImdbRating(tconst) {
  const ctx = useContext(ImdbRatingsContext);
  const request = ctx?.request;
  useEffect(() => {
    if (request) request(tconst);
  }, [tconst, request]);
  if (!ctx) return undefined;
  return tconst in ctx.ratings ? ctx.ratings[tconst] : undefined;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../../../services/supabase-client";

/* eslint-disable react-refresh/only-export-components */

const StorygraphRatingsContext = createContext(null);
const CHUNK = 300;
const FLUSH_DELAY_MS = 50;

export function StorygraphRatingsProvider({ children }) {
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
    if (!ids.length) return;
    ids.forEach((id) => inflightRef.current.add(id));
    const updates = {};

    for (let index = 0; index < ids.length; index += CHUNK) {
      const slice = ids.slice(index, index + CHUNK);
      const { data, error } = await supabase
        .from("storygraph_ratings")
        .select("hardcover_id, slug, rating, rating_count, updated_at")
        .in("hardcover_id", slice);
      if (error) {
        console.error("storygraph ratings fetch error", error);
        slice.forEach((id) => inflightRef.current.delete(id));
        continue;
      }
      const found = new Set();
      (data || []).forEach((row) => {
        const id = String(row.hardcover_id);
        updates[id] = {
          rating: row.rating,
          ratingCount: row.rating_count,
          slug: row.slug,
          updatedAt: row.updated_at,
        };
        found.add(id);
      });
      slice.forEach((id) => {
        if (!found.has(id)) updates[id] = null;
        inflightRef.current.delete(id);
      });
    }
    if (Object.keys(updates).length) {
      setRatings((previous) => ({ ...previous, ...updates }));
    }
  }, []);

  const request = useCallback(
    (hardcoverId) => {
      const id = String(hardcoverId || "").trim();
      if (
        !id ||
        cacheRef.current[id] ||
        inflightRef.current.has(id) ||
        pendingRef.current.has(id)
      ) {
        return;
      }
      pendingRef.current.add(id);
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
      }
    },
    [flush],
  );

  const refresh = useCallback(async (hardcoverId) => {
    const id = String(hardcoverId || "").trim();
    if (!id) return;
    try {
      const response = await fetch(
        `/api/storygraph-rating?id=${encodeURIComponent(id)}`,
      );
      if (!response.ok) return;
      const data = await response.json();
      setRatings((previous) => ({
        ...previous,
        [id]: {
          rating: data.rating,
          ratingCount: data.ratingCount,
          slug: data.slug,
          updatedAt: data.updatedAt,
        },
      }));
    } catch {
      return;
    }
  }, []);

  return (
    <StorygraphRatingsContext.Provider value={{ ratings, request, refresh }}>
      {children}
    </StorygraphRatingsContext.Provider>
  );
}

export function useStorygraphRating(
  hardcoverId,
  { live = false } = {},
) {
  const context = useContext(StorygraphRatingsContext);
  const id = String(hardcoverId || "").trim();
  const request = context?.request;
  const refresh = context?.refresh;
  useEffect(() => {
    if (!id) return;
    request?.(id);
    if (live) refresh?.(id);
  }, [id, live, refresh, request]);
  const data =
    context && id && id in context.ratings
      ? context.ratings[id]
      : undefined;
  useEffect(() => {
    if (!id || data !== null) return;
    const timer = setTimeout(() => request?.(id), 60_000);
    return () => clearTimeout(timer);
  }, [data, id, request]);
  return data;
}

// Adapters between the shared `movies` metadata table and the app's internal
// "movie_object" shape that every component consumes. Keeping the shape stable
// means the UI is untouched whether a title comes fresh from TMDB or from a
// cached `movies` row.

import { supabase } from "./supabase-client";
import { getMovieById, findByImdbId } from "./api";

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Movie objects historically carried `type`/`titleType`/`episodes` instead of a
// clean media_type; derive a canonical "movie" | "tv" from whatever is present.
export function deriveMediaType(mo) {
  if (mo?.media_type === "tv" || mo?.media_type === "movie") return mo.media_type;
  const t = (mo?.type || "").toLowerCase();
  const tt = (mo?.titleType || "").toLowerCase();
  if (t.includes("tv") || tt.includes("tv") || mo?.episodes) return "tv";
  return "movie";
}

// `movies` table row -> movie_object shape used throughout the UI.
export function movieRowToMovieObject(row) {
  if (!row) return null;
  const isTV = row.media_type === "tv";
  return {
    tmdb_id: row.tmdb_id,
    media_type: row.media_type,
    id: row.imdb_id || null,
    primaryTitle: row.title,
    primaryImage: row.poster_url,
    startYear: row.start_year ?? null,
    endYear: row.end_year ?? null,
    type: isTV ? "tvSeries" : "movie",
    titleType: isTV ? "tvSeries" : "movie",
    episodes: isTV ? true : undefined,
    runtimeMinutes: row.runtime_minutes ?? null,
    averageRating: row.tmdb_vote_average ?? null,
    numVotes: row.tmdb_vote_count ?? null,
    url: row.imdb_id ? `https://www.imdb.com/title/${row.imdb_id}/` : null,
    description: row.overview || "",
    trailer: row.trailer_url || null,
    budget: row.budget ?? null,
    interests: row.genres || [],
    cast: row.cast_members || [],
    creators: row.creators || [],
    directors: row.directors || [],
    writers: row.writers || [],
    seasons: row.season_info || [],
    backdropImage: row.backdrop_url || null,
    backdropImageHD: row.backdrop_url || null,
  };
}

// movie_object (from TMDB or a legacy blob) -> `movies` table row for upsert.
export function movieObjectToMovieRow(mo) {
  return {
    tmdb_id: toInt(mo.tmdb_id),
    media_type: deriveMediaType(mo),
    imdb_id: mo.id || null,
    title: mo.primaryTitle ?? null,
    poster_url: mo.primaryImage ?? null,
    start_year: toInt(mo.startYear),
    end_year: toInt(mo.endYear),
    runtime_minutes: toInt(mo.runtimeMinutes),
    overview: mo.description ?? null,
    trailer_url: mo.trailer ?? null,
    budget: toInt(mo.budget),
    tmdb_vote_average: toNum(mo.averageRating),
    tmdb_vote_count: toInt(mo.numVotes),
    genres: mo.interests ?? [],
    cast_members: mo.cast ?? [],
    creators: mo.creators ?? [],
    directors: mo.directors ?? [],
    writers: mo.writers ?? [],
    season_info: mo.seasons?.length ? mo.seasons : null,
    backdrop_url: mo.backdropImage ?? null,
    updated_at: new Date().toISOString(),
  };
}

// Resolve a full TMDB detail object for a movie object that may only carry
// browse-level fields (tmdb_id + media_type, no tconst) or a legacy tconst
// (no tmdb_id). Returns the original object if it can't be resolved.
export async function resolveFullMovie(movie) {
  let mediaType = movie?.media_type;
  let tmdbId = movie?.tmdb_id;
  if ((!mediaType || tmdbId == null) && movie?.id) {
    const found = await findByImdbId(movie.id);
    if (found) {
      mediaType = found.media_type;
      tmdbId = found.tmdb_id;
    }
  }
  if (!mediaType || tmdbId == null) return movie;
  const full = await getMovieById(mediaType, tmdbId);
  return full || movie;
}

// Upsert a title's metadata into `movies` (keyed by tmdb_id + media_type) and
// return its uuid. Used when adding to a list/rating and when the details page
// refreshes from TMDB. Returns null if the object lacks a tmdb_id to key on.
export async function upsertMovie(movieObject) {
  const row = movieObjectToMovieRow(movieObject);
  if (row.tmdb_id == null) return null;
  const { data, error } = await supabase
    .from("movies_and_tv_entries")
    .upsert(row, { onConflict: "tmdb_id,media_type" })
    .select("id")
    .single();
  if (error) {
    console.error("upsertMovie failed", error);
    return null;
  }
  return data?.id ?? null;
}

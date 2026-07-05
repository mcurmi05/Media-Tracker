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

// movie_object -> unified media_entries row (type-specific fields packed
// into the details jsonb).
export function movieObjectToEntryRow(mo) {
  const row = movieObjectToMovieRow(mo);
  return {
    media_type: row.media_type,
    tmdb_id: row.tmdb_id,
    imdb_id: row.imdb_id,
    title: row.title ?? "Untitled",
    creator: row.directors?.[0] ?? row.creators?.[0] ?? null,
    cover_url: row.poster_url,
    backdrop_url: row.backdrop_url,
    start_year: row.start_year,
    end_year: row.end_year,
    description: row.overview,
    details: {
      runtime_minutes: row.runtime_minutes,
      trailer_url: row.trailer_url,
      budget: row.budget,
      tmdb_vote_average: row.tmdb_vote_average,
      tmdb_vote_count: row.tmdb_vote_count,
      genres: row.genres,
      cast_members: row.cast_members,
      directors: row.directors,
      writers: row.writers,
      creators: row.creators,
      season_info: row.season_info,
    },
    updated_at: row.updated_at,
  };
}

// Insert-or-update a title's metadata into media_entries (keyed by
// media_type + tmdb_id) and return its uuid. Used when adding to a list/rating
// and when the details page refreshes from TMDB. Returns null if the object
// lacks a tmdb_id to key on.
//
// Done as select-then-write rather than a PostgREST upsert: on_conflict can't
// target a partial unique index, and this keeps working regardless of how the
// media_entries indexes are defined.
export async function upsertMovie(movieObject) {
  const row = movieObjectToEntryRow(movieObject);
  if (row.tmdb_id == null) return null;

  const { data: existing, error: findErr } = await supabase
    .from("media_entries")
    .select("id")
    .eq("media_type", row.media_type)
    .eq("tmdb_id", row.tmdb_id)
    .limit(1);
  if (findErr) {
    console.error("upsertMovie lookup failed", findErr);
    return null;
  }

  if (existing && existing.length > 0) {
    const id = existing[0].id;
    // Don't clobber a user-chosen "everywhere" poster on a metadata refresh.
    // cover_url is only seeded on first insert; global overrides survive.
    const { cover_url: _ignored, ...updateRow } = row;
    const { error: updErr } = await supabase
      .from("media_entries")
      .update(updateRow)
      .eq("id", id);
    if (updErr) {
      console.error("upsertMovie update failed", updErr);
      return null;
    }
    return id;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("media_entries")
    .insert(row)
    .select("id")
    .single();
  if (insErr) {
    console.error("upsertMovie insert failed", insErr);
    return null;
  }
  return inserted?.id ?? null;
}

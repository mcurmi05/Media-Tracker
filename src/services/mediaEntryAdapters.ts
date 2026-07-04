// Adapters between unified media_entries rows and the legacy row shapes the
// UI still consumes (movies_and_tv_entries-style rows and book_entries-style
// objects). These let the data layer move to the unified tables without
// touching page/component code; they disappear as consumers migrate to
// src/features/media types.

// media_entries row -> movies_and_tv_entries-style row (details unpacked).
export function entryToMovieRow(entry) {
  if (!entry) return null;
  const d = entry.details || {};
  return {
    id: entry.id,
    tmdb_id: entry.tmdb_id,
    media_type: entry.media_type,
    imdb_id: entry.imdb_id,
    title: entry.title,
    poster_url: entry.cover_url,
    backdrop_url: entry.backdrop_url,
    start_year: entry.start_year,
    end_year: entry.end_year,
    overview: entry.description,
    runtime_minutes: d.runtime_minutes ?? null,
    trailer_url: d.trailer_url ?? null,
    budget: d.budget ?? null,
    tmdb_vote_average: d.tmdb_vote_average ?? null,
    tmdb_vote_count: d.tmdb_vote_count ?? null,
    genres: d.genres ?? [],
    cast_members: d.cast_members ?? [],
    directors: d.directors ?? [],
    writers: d.writers ?? [],
    creators: d.creators ?? [],
    season_info: d.season_info ?? null,
    updated_at: entry.updated_at,
  };
}

// media_entries row -> book_entries-style object.
export function entryToBookObject(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    title: entry.title,
    author: entry.creator,
    cover_image: entry.cover_url,
    release_year: entry.start_year,
    book_description: entry.description,
    goodreads_link: entry.goodreads_link,
    goodreads_id: entry.goodreads_id,
    hardcover_id: entry.hardcover_id,
    isbn13: entry.isbn13,
    storygraph_slug: entry.storygraph_slug,
    created_at: entry.created_at,
  };
}

// book_entries-style payload -> media_entries insert/update row.
export function bookPayloadToEntry(payload) {
  const row = { media_type: "book" };
  if ("title" in payload) row.title = payload.title || "Untitled";
  if ("author" in payload) row.creator = payload.author ?? null;
  if ("cover_image" in payload) row.cover_url = payload.cover_image ?? null;
  if ("release_year" in payload) row.start_year = payload.release_year ?? null;
  if ("book_description" in payload)
    row.description = payload.book_description ?? null;
  if ("goodreads_link" in payload)
    row.goodreads_link = payload.goodreads_link ?? null;
  if ("goodreads_id" in payload) row.goodreads_id = payload.goodreads_id ?? null;
  if ("hardcover_id" in payload)
    row.hardcover_id = String(payload.hardcover_id || "").trim() || null;
  if ("isbn13" in payload) row.isbn13 = payload.isbn13 ?? null;
  if ("storygraph_slug" in payload)
    row.storygraph_slug = payload.storygraph_slug ?? null;
  return row;
}

/* ---------- user activity row adapters ---------- */

// user_logs row (movie/tv, entry joined) -> legacy logs row.
// Old rows used created_at as the watch date; that now lives in started_at.
export function toMovieLogRow(row, movieObject) {
  return {
    id: row.id,
    user_id: row.user_id,
    movie_entry_id: row.entry_id,
    log: row.log,
    created_at: row.started_at ?? row.created_at,
    movie_end_date: row.ended_at,
    multi_day: row.multi_day ?? row.ended_at != null,
    dnf: row.dnf,
    season_info: row.season_info,
    movie_object: movieObject,
  };
}

// user_logs row (book) -> legacy book_logs row.
export function toBookLogRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.entry_id,
    log: row.log,
    start_date: row.started_at,
    end_date: row.ended_at,
    dnf: row.dnf,
    created_at: row.created_at,
    book_entries: entryToBookObject(row.entry),
  };
}

// Legacy book_logs field names -> user_logs column names.
export function bookLogUpdatesToLog(updates) {
  const out = {};
  if ("log" in updates) out.log = updates.log;
  if ("start_date" in updates) out.started_at = updates.start_date;
  if ("end_date" in updates) out.ended_at = updates.end_date;
  if ("dnf" in updates) out.dnf = updates.dnf;
  if ("book_id" in updates) out.entry_id = updates.book_id;
  return out;
}

// user_ratings row -> legacy ratings row (movie) / book_ratings row (book).
export function toMovieRatingRow(row, movieObject) {
  return {
    id: row.id,
    user_id: row.user_id,
    movie_entry_id: row.entry_id,
    rating: row.rating,
    previous_rating: row.previous_rating,
    ranking: row.ranking,
    accurate: row.accurate,
    created_at: row.created_at,
    updated_at: row.updated_at,
    movie_object: movieObject,
  };
}

export function toBookRatingRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.entry_id,
    book_rating: row.rating,
    previous_rating: row.previous_rating,
    ranking: row.ranking,
    accurate: row.accurate,
    created_at: row.created_at,
    updated_at: row.updated_at,
    book_entries: entryToBookObject(row.entry),
  };
}

// Legacy book_ratings field names -> user_ratings column names.
export function bookRatingUpdatesToRating(updates) {
  const out = {};
  if ("book_rating" in updates) out.rating = updates.book_rating;
  if ("previous_rating" in updates) out.previous_rating = updates.previous_rating;
  if ("ranking" in updates) out.ranking = updates.ranking;
  if ("accurate" in updates) out.accurate = updates.accurate;
  if ("book_id" in updates) out.entry_id = updates.book_id;
  return out;
}

// user_saves row -> legacy watchlist row (movie/tv) / book_tbr row (book).
export function toWatchlistRow(row, movieObject) {
  return {
    id: row.id,
    user_id: row.user_id,
    movie_entry_id: row.entry_id,
    new_season_to_watch: row.new_season_to_watch,
    created_at: row.created_at,
    movie_object: movieObject,
  };
}

export function toBookTbrRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.entry_id,
    created_at: row.created_at,
    book_entries: entryToBookObject(row.entry),
  };
}

// user_saves row with queue_rank -> legacy watchlist-queue row. The save row
// id doubles as the queue id AND the watchlist/book_tbr id (row ids were
// preserved by the migration), which is exactly how consumers join them.
export function toQueueRow(row) {
  const isBook = row.entry?.media_type === "book";
  return {
    id: row.id,
    user_id: row.user_id,
    queue_rank: row.queue_rank,
    watchlist_id: isBook ? null : row.id,
    book_tbr_id: isBook ? row.id : null,
    created_at: row.created_at,
  };
}

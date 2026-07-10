// Data access for user activity (logs / ratings / saves) on the unified
// schema. Exported signatures and returned row shapes are unchanged from the
// per-media-type era: rows come back looking like the old logs/ratings/
// watchlist/book_* tables via mediaEntryAdapters, so consumers are untouched.
import { supabase } from "./supabase-client";
import { movieRowToMovieObject } from "./movieMetadata";
import {
  entryToMovieRow,
  entryToBookObject,
  bookPayloadToEntry,
  toMovieLogRow,
  toBookLogRow,
  bookLogUpdatesToLog,
  toMovieRatingRow,
  toBookRatingRow,
  bookRatingUpdatesToRating,
  toWatchlistRow,
  toBookTbrRow,
  toQueueRow,
} from "./mediaEntryAdapters";

const ENTRY_JOIN = "*, entry:media_entries!inner(*)";

const movieObjectOf = (row) =>
  row?.entry ? movieRowToMovieObject(entryToMovieRow(row.entry)) : null;

// Movie/TV rows for a user from one of the unified activity tables.
const getScreenRows = async (table, userId) => {
  const { data, error } = await supabase
    .from(table)
    .select(ENTRY_JOIN)
    .eq("user_id", userId)
    .in("entry.media_type", ["movie", "tv"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// Book rows for a user from one of the unified activity tables.
const getBookRows = async (table, userId) => {
  const { data, error } = await supabase
    .from(table)
    .select(ENTRY_JOIN)
    .eq("user_id", userId)
    .eq("entry.media_type", "book")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/* ---------- ratings (movies / tv) ---------- */

// Update a user's rating. `previousRating` records the value the rating had
// before this change, so the UI can show what it was changed from.
export const updateUserRating = async (
  userId,
  movieEntryId,
  newRating,
  previousRating = null,
) => {
  // Append this change to the row's rating_history so the full set/change
  // timeline survives (created_at/updated_at only keep first and last).
  const { data: current } = await supabase
    .from("user_ratings")
    .select("rating_history")
    .eq("user_id", userId)
    .eq("entry_id", movieEntryId)
    .maybeSingle();
  const now = new Date().toISOString();
  const history = [
    ...(current?.rating_history ?? []),
    { rating: newRating, at: now },
  ];
  const { data, error } = await supabase
    .from("user_ratings")
    .update({
      rating: newRating,
      previous_rating: previousRating,
      updated_at: now,
      rating_history: history,
    })
    .eq("user_id", userId)
    .eq("entry_id", movieEntryId);
  if (error) throw error;
  return data;
};

// Overwrite a rating's history array (used when deleting a history event).
export const updateUserRatingHistory = async (userId, movieEntryId, history) => {
  const { error } = await supabase
    .from("user_ratings")
    .update({ rating_history: history })
    .eq("user_id", userId)
    .eq("entry_id", movieEntryId);
  if (error) throw error;
};

// Update a user's ranking (nullable).
export const updateUserRanking = async (userId, movieEntryId, ranking) => {
  const { data, error } = await supabase
    .from("user_ratings")
    .update({ ranking })
    .eq("user_id", userId)
    .eq("entry_id", movieEntryId);
  if (error) throw error;
  return data;
};

export const getUserRatings = async (user) => {
  if (!user) throw new Error("User must be authenticated to view ratings");
  const rows = await getScreenRows("user_ratings", user.id);
  return rows.map((r) => toMovieRatingRow(r, movieObjectOf(r)));
};

// Match a rating row to a movie object the same way the watchlist/log matchers
// do: by tmdb_id + media_type (so it also works for browse cards that only carry
// tmdb fields), falling back to the IMDb id for rows without tmdb metadata.
export const ratingMatchesMovie = (row, movie) =>
  (movie?.tmdb_id != null &&
    row?.movie_object?.tmdb_id === movie.tmdb_id &&
    row?.movie_object?.media_type === movie.media_type) ||
  (!!movie?.id && row?.movie_object?.id === movie.id);

// Find the rating row for a given movie object, or null if it isn't rated.
export const getRatingForMovie = (ratingsArray, movie) =>
  (ratingsArray || []).find((r) => ratingMatchesMovie(r, movie)) || null;

/* ---------- logs (movies / tv) ---------- */

export const getUserLogs = async (user) => {
  if (!user) throw new Error("User must be authenticated to view logs");
  const rows = await getScreenRows("user_logs", user.id);
  const mapped = rows.map((r) => toMovieLogRow(r, movieObjectOf(r)));
  // Old rows were ordered by watch date, which now lives in started_at.
  return mapped.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
};

/* ---------- watchlist (movies / tv) ---------- */

export const getUserWatchlist = async (user) => {
  if (!user) throw new Error("User must be authenticated to view watchlist");
  const rows = await getScreenRows("user_saves", user.id);
  return rows.map((r) => toWatchlistRow(r, movieObjectOf(r)));
};

/* ---------- watch-next queue ---------- */
// Queue position lives on user_saves.queue_rank; the save row id doubles as
// the legacy queue id / watchlist_id / book_tbr_id (ids were preserved).

export const getUserWatchlistQueue = async (user) => {
  if (!user)
    throw new Error("User must be authenticated to view watchlist queue");
  const { data, error } = await supabase
    .from("user_saves")
    .select(ENTRY_JOIN)
    .eq("user_id", user.id)
    .not("queue_rank", "is", null)
    .order("queue_rank", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toQueueRow);
};

// `refs` references the save row via { watchlistId } (movies/tv) or
// { bookTbrId } (books). Exactly one should be provided.
export const addToWatchlistQueue = async (userId, refs, queueRank) => {
  const saveId = refs.watchlistId ?? refs.bookTbrId;
  const { data, error } = await supabase
    .from("user_saves")
    .update({ queue_rank: queueRank })
    .eq("id", saveId)
    .select(ENTRY_JOIN)
    .single();
  if (error) throw error;
  return toQueueRow(data);
};

export const removeFromWatchlistQueue = async (queueId) => {
  const { error } = await supabase
    .from("user_saves")
    .update({ queue_rank: null })
    .eq("id", queueId);
  if (error) throw error;
};

export const updateWatchlistQueueRank = async (queueId, queueRank) => {
  const { data, error } = await supabase
    .from("user_saves")
    .update({ queue_rank: queueRank })
    .eq("id", queueId);
  if (error) throw error;
  return data;
};

/* ---------- book entries (shared metadata) ---------- */

export const createBookEntry = async (payload) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User must be authenticated to create a book entry");
  }
  const { data, error } = await supabase
    .from("media_entries")
    .insert(bookPayloadToEntry(payload))
    .select();
  if (error) throw error;
  return entryToBookObject(data[0]);
};

export const updateBookEntry = async (id, updates) => {
  const row = bookPayloadToEntry(updates);
  delete row.media_type;
  const { data, error } = await supabase
    .from("media_entries")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  if (error) throw error;
  return entryToBookObject(data[0]);
};

// Look up an existing book entry by hardcover id, goodreads link or
// title+author. If none is found, insert a new row. Returns the entry in the
// legacy book_entries shape.
export const findOrCreateBookEntry = async (bookData) => {
  const hardcoverId = String(bookData?.hardcover_id || "").trim();
  if (hardcoverId) {
    const { data, error } = await supabase
      .from("media_entries")
      .select("*")
      .eq("hardcover_id", hardcoverId)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return entryToBookObject(data[0]);
  }

  const link = (bookData?.goodreads_link || "").trim();
  if (link) {
    const { data, error } = await supabase
      .from("media_entries")
      .select("*")
      .eq("media_type", "book")
      .eq("goodreads_link", link)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return entryToBookObject(data[0]);
  }

  const title = (bookData?.title || "").trim();
  const author = (bookData?.author || "").trim();
  if (title && author) {
    const { data, error } = await supabase
      .from("media_entries")
      .select("*")
      .eq("media_type", "book")
      .ilike("title", title)
      .ilike("creator", author)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return entryToBookObject(data[0]);
  }

  return await createBookEntry({
    title,
    author,
    cover_image: bookData?.cover_image || null,
    release_year: bookData?.release_year
      ? Number(bookData.release_year) || null
      : null,
    goodreads_link: bookData?.goodreads_link || null,
    goodreads_id: bookData?.goodreads_id || null,
    hardcover_id: hardcoverId || null,
    isbn13: bookData?.isbn13 || null,
    book_description: bookData?.book_description || null,
  });
};

export const getBookEntryByHardcoverId = async (hardcoverId) => {
  const id = String(hardcoverId || "").trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("media_entries")
    .select("*")
    .eq("hardcover_id", id)
    .limit(1);
  if (error) throw error;
  return entryToBookObject((data && data[0]) || null);
};

// Search book entries by title or author (case-insensitive substring match).
export const searchBookEntries = async (query, limit = 100) => {
  const term = (query || "").trim();
  if (!term) return [];
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("media_entries")
    .select("*")
    .eq("media_type", "book")
    .or(`title.ilike.${pattern},creator.ilike.${pattern}`)
    .order("title", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(entryToBookObject);
};

// Look up a single book entry by the path portion of its Goodreads link
// (everything after "goodreads.com/"). Used by the book details page, where
// that path is the route identifier.
export const getBookEntryByGoodreadsPath = async (path) => {
  const term = (path || "").trim();
  if (!term) return null;
  const { data, error } = await supabase
    .from("media_entries")
    .select("*")
    .eq("media_type", "book")
    .ilike("goodreads_link", `%${term}%`)
    .limit(1);
  if (error) throw error;
  return entryToBookObject((data && data[0]) || null);
};

// Return every book entry.
export const getAllBookEntries = async () => {
  const { data, error } = await supabase
    .from("media_entries")
    .select("*")
    .eq("media_type", "book")
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(entryToBookObject);
};

/* ---------- book logs ---------- */

export const getUserBookLogs = async (user) => {
  if (!user) throw new Error("User must be authenticated to view book logs");
  const rows = await getBookRows("user_logs", user.id);
  return rows.map(toBookLogRow);
};

export const createBookLog = async (bookLog) => {
  const row = bookLogUpdatesToLog(bookLog);
  const { data, error } = await supabase
    .from("user_logs")
    .insert({ ...row, user_id: bookLog.user_id })
    .select("*, entry:media_entries(*)");
  if (error) throw error;
  return toBookLogRow(data[0]);
};

export const updateBookLog = async (logId, updates) => {
  const { data, error } = await supabase
    .from("user_logs")
    .update(bookLogUpdatesToLog(updates))
    .eq("id", logId)
    .select("*, entry:media_entries(*)");
  if (error) throw error;
  return toBookLogRow(data[0]);
};

export const deleteBookLog = async (logId) => {
  const { error } = await supabase.from("user_logs").delete().eq("id", logId);
  if (error) throw error;
};

/* ---------- book TBR (to-be-read watchlist) ---------- */

export const getUserBookTbr = async (user) => {
  if (!user) throw new Error("User must be authenticated to view TBR books");
  const rows = await getBookRows("user_saves", user.id);
  return rows.map(toBookTbrRow);
};

export const createBookTbr = async (bookTbr) => {
  const { data, error } = await supabase
    .from("user_saves")
    .insert({ user_id: bookTbr.user_id, entry_id: bookTbr.book_id })
    .select("*, entry:media_entries(*)");
  if (error) throw error;
  return toBookTbrRow(data[0]);
};

export const deleteBookTbr = async (tbrId) => {
  const { error } = await supabase.from("user_saves").delete().eq("id", tbrId);
  if (error) throw error;
};

export const updateBookTbr = async (tbrId, updates) => {
  const row = {};
  if ("book_id" in updates) row.entry_id = updates.book_id;
  const { data, error } = await supabase
    .from("user_saves")
    .update(row)
    .eq("id", tbrId)
    .select("*, entry:media_entries(*)");
  if (error) throw error;
  return toBookTbrRow(data[0]);
};

/* ---------- book ratings ---------- */

export const getUserBookRatings = async (user) => {
  if (!user) throw new Error("User must be authenticated to view book ratings");
  const rows = await getBookRows("user_ratings", user.id);
  return rows.map(toBookRatingRow);
};

export const createBookRating = async (payload) => {
  const row = bookRatingUpdatesToRating(payload);
  const { data, error } = await supabase
    .from("user_ratings")
    .insert({ ...row, user_id: payload.user_id })
    .select("*, entry:media_entries(*)");
  if (error) throw error;
  return toBookRatingRow(data[0]);
};

export const updateBookRating = async (id, updates) => {
  const { data, error } = await supabase
    .from("user_ratings")
    .update(bookRatingUpdatesToRating(updates))
    .eq("id", id)
    .select("*, entry:media_entries(*)");
  if (error) throw error;
  return toBookRatingRow(data[0]);
};

export const deleteBookRating = async (id) => {
  const { error } = await supabase.from("user_ratings").delete().eq("id", id);
  if (error) throw error;
};

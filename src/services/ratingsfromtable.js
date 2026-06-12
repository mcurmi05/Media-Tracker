// Update a user's rating in Supabase. `previousRating` records the value the
// rating had before this change, so the UI can show what it was changed from.
// Ratings reference shared metadata by movie_entry_id (the movies_and_tv_entries
// uuid), which is the per-(user, title) identity for a rating.
export const updateUserRating = async (
  userId,
  movieEntryId,
  newRating,
  previousRating = null,
) => {
  const { data, error } = await supabase
    .from("ratings")
    .update({
      rating: newRating,
      previous_rating: previousRating,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("movie_entry_id", movieEntryId);
  if (error) throw error;
  return data;
};
import { supabase } from "./supabase-client.js";
import { movieRowToMovieObject } from "./movieMetadata.js";

// Rows in logs/watchlist/ratings reference shared metadata in `movies` via
// movie_entry_id. Reconstruct each row's `movie_object` from the joined movies
// row, falling back to the legacy inline blob for rows not yet backfilled.
const withMovieObject = (rows) =>
  (rows || []).map((r) => ({
    ...r,
    movie_object: r.movies_and_tv_entries ? movieRowToMovieObject(r.movies_and_tv_entries) : r.movie_object,
  }));

// Update a user's ranking (nullable) in Supabase
export const updateUserRanking = async (userId, movieEntryId, ranking) => {
  const { data, error } = await supabase
    .from("ratings")
    .update({ ranking })
    .eq("user_id", userId)
    .eq("movie_entry_id", movieEntryId);
  if (error) throw error;
  return data;
};

export const getUserRatings = async (user) => {
  if (!user) throw new Error("User must be authenticated to view ratings");
  const { data, error } = await supabase
    .from("ratings")
    .select("*, movies_and_tv_entries(*)")
    .eq("user_id", user.id);
  if (error) throw error;
  return withMovieObject(data);
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

export const getUserLogs = async (user) => {
  if (!user) throw new Error("User must be authenticated to view logs");
  const { data, error } = await supabase
    .from("logs")
    .select("*, movies_and_tv_entries(*)")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return withMovieObject(data);
};

export const getUserWatchlist = async (user) => {
  if (!user) throw new Error("User must be authenticated to view watchlist");
  const { data, error } = await supabase
    .from("watchlist")
    .select("*, movies_and_tv_entries(*)")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return withMovieObject(data);
};

// Watchlist queue: the user's ordered "watch next" list, referencing watchlist
// rows by watchlist_id. queue_rank determines the display order (1 = next up).
export const getUserWatchlistQueue = async (user) => {
  if (!user)
    throw new Error("User must be authenticated to view watchlist queue");
  const { data, error } = await supabase
    .from("watchlist-queue")
    .select("*")
    .order("queue_rank", { ascending: true })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

// `refs` references either a watchlist row ({ watchlistId }) for movies/TV or a
// book_tbr row ({ bookTbrId }) for books. Exactly one should be provided.
export const addToWatchlistQueue = async (userId, refs, queueRank) => {
  const { watchlistId = null, bookTbrId = null } = refs;
  const { data, error } = await supabase
    .from("watchlist-queue")
    .insert({
      user_id: userId,
      watchlist_id: watchlistId,
      book_tbr_id: bookTbrId,
      queue_rank: queueRank,
    })
    .select();
  if (error) throw error;
  return data[0];
};

export const removeFromWatchlistQueue = async (queueId) => {
  const { error } = await supabase
    .from("watchlist-queue")
    .delete()
    .eq("id", queueId);
  if (error) throw error;
};

export const updateWatchlistQueueRank = async (queueId, queueRank) => {
  const { data, error } = await supabase
    .from("watchlist-queue")
    .update({ queue_rank: queueRank })
    .eq("id", queueId);
  if (error) throw error;
  return data;
};

// Book entries (per-user book metadata, referenced by that user's book child tables)
export const createBookEntry = async (payload) => {
  // Resolve the signed-in user so the row is stamped with its owner. This is
  // required by the book_entries INSERT policy (with check: auth.uid() = user_id).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User must be authenticated to create a book entry");
  }
  const { data, error } = await supabase
    .from("book_entries")
    .insert({ ...payload, user_id: user.id })
    .select();
  if (error) throw error;
  return data[0];
};

export const updateBookEntry = async (id, updates) => {
  const { data, error } = await supabase
    .from("book_entries")
    .update(updates)
    .eq("id", id)
    .select();
  if (error) throw error;
  return data[0];
};

// Look up an existing book_entries row by goodreads_link or title+author.
// If none is found, insert a new row. Returns the entry.
export const findOrCreateBookEntry = async (bookData) => {
  const link = (bookData?.goodreads_link || "").trim();
  if (link) {
    const { data: byLink, error: linkErr } = await supabase
      .from("book_entries")
      .select("*")
      .eq("goodreads_link", link)
      .limit(1);
    if (linkErr) throw linkErr;
    if (byLink && byLink.length > 0) return byLink[0];
  }

  const title = (bookData?.title || "").trim();
  const author = (bookData?.author || "").trim();
  if (title && author) {
    const { data: byPair, error: pairErr } = await supabase
      .from("book_entries")
      .select("*")
      .ilike("title", title)
      .ilike("author", author)
      .limit(1);
    if (pairErr) throw pairErr;
    if (byPair && byPair.length > 0) return byPair[0];
  }

  const payload = {
    title,
    author,
    cover_image: bookData?.cover_image || null,
    release_year: bookData?.release_year
      ? Number(bookData.release_year) || null
      : null,
    goodreads_link: bookData?.goodreads_link || null,
    book_description: bookData?.book_description || null,
  };
  return await createBookEntry(payload);
};

// Search book_entries by title or author (case-insensitive substring match).
export const searchBookEntries = async (query, limit = 100) => {
  const term = (query || "").trim();
  if (!term) return [];
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("book_entries")
    .select("*")
    .or(`title.ilike.${pattern},author.ilike.${pattern}`)
    .order("title", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

// Look up a single book_entries row by the path portion of its Goodreads
// link (everything after "goodreads.com/"). Used by the book details page,
// where that path is the route identifier.
export const getBookEntryByGoodreadsPath = async (path) => {
  const term = (path || "").trim();
  if (!term) return null;
  const { data, error } = await supabase
    .from("book_entries")
    .select("*")
    .ilike("goodreads_link", `%${term}%`)
    .limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
};

// Return every row in book_entries.
export const getAllBookEntries = async () => {
  const { data, error } = await supabase
    .from("book_entries")
    .select("*")
    .order("title", { ascending: true });
  if (error) throw error;
  return data || [];
};

// Book logs functions
export const getUserBookLogs = async (user) => {
  if (!user) throw new Error("User must be authenticated to view book logs");
  const { data, error } = await supabase
    .from("book_logs")
    .select("*, book_entries(*)")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const createBookLog = async (bookLog) => {
  const { data, error } = await supabase
    .from("book_logs")
    .insert(bookLog)
    .select("*, book_entries(*)");
  if (error) throw error;
  return data[0];
};

export const updateBookLog = async (logId, updates) => {
  const { data, error } = await supabase
    .from("book_logs")
    .update(updates)
    .eq("id", logId)
    .select("*, book_entries(*)");
  if (error) throw error;
  return data[0];
};

export const deleteBookLog = async (logId) => {
  const { error } = await supabase.from("book_logs").delete().eq("id", logId);
  if (error) throw error;
};

// Book TBR (to-be-read watchlist) functions
export const getUserBookTbr = async (user) => {
  if (!user) throw new Error("User must be authenticated to view TBR books");
  const { data, error } = await supabase
    .from("book_tbr")
    .select("*, book_entries(*)")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const createBookTbr = async (bookTbr) => {
  const { data, error } = await supabase
    .from("book_tbr")
    .insert(bookTbr)
    .select("*, book_entries(*)");
  if (error) throw error;
  return data[0];
};

export const deleteBookTbr = async (tbrId) => {
  const { error } = await supabase.from("book_tbr").delete().eq("id", tbrId);
  if (error) throw error;
};

export const updateBookTbr = async (tbrId, updates) => {
  const { data, error } = await supabase
    .from("book_tbr")
    .update(updates)
    .eq("id", tbrId)
    .select("*, book_entries(*)");
  if (error) throw error;
  return data[0];
};

// Book ratings (independent of book_logs / book_tbr)
export const getUserBookRatings = async (user) => {
  if (!user) throw new Error("User must be authenticated to view book ratings");
  const { data, error } = await supabase
    .from("book_ratings")
    .select("*, book_entries(*)")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const createBookRating = async (payload) => {
  const { data, error } = await supabase
    .from("book_ratings")
    .insert(payload)
    .select("*, book_entries(*)");
  if (error) throw error;
  return data[0];
};

export const updateBookRating = async (id, updates) => {
  const { data, error } = await supabase
    .from("book_ratings")
    .update(updates)
    .eq("id", id)
    .select("*, book_entries(*)");
  if (error) throw error;
  return data[0];
};

export const deleteBookRating = async (id) => {
  const { error } = await supabase.from("book_ratings").delete().eq("id", id);
  if (error) throw error;
};

// Update a user's rating in Supabase
export const updateUserRating = async (userId, imdbMovieId, newRating) => {
  const { data, error } = await supabase
    .from("ratings")
    .update({ rating: newRating, created_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("imdb_movie_id", imdbMovieId);
  if (error) throw error;
  return data;
};
import { supabase } from "./supabase-client.js";

// Update a user's ranking (nullable) in Supabase
export const updateUserRanking = async (userId, imdbMovieId, ranking) => {
  const { data, error } = await supabase
    .from("ratings")
    .update({ ranking })
    .eq("user_id", userId)
    .eq("imdb_movie_id", imdbMovieId);
  if (error) throw error;
  return data;
};

export const getUserRatings = async (user) => {
  if (!user) throw new Error("User must be authenticated to view ratings");
  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const getRatingFromArray = (ratingsArray, imdbMovieId) => {
  const rating = ratingsArray.find((r) => r.imdb_movie_id === imdbMovieId);
  return rating ? rating.rating : null;
};

export const getUserLogs = async (user) => {
  if (!user) throw new Error("User must be authenticated to view logs");
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const getUserWatchlist = async (user) => {
  if (!user) throw new Error("User must be authenticated to view watchlist");
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

// Book entries (canonical metadata, referenced by all book child tables)
export const createBookEntry = async (payload) => {
  const { data, error } = await supabase
    .from("book_entries")
    .insert(payload)
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

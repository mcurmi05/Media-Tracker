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

// Book logs functions
export const getUserBookLogs = async (user) => {
  if (!user) throw new Error("User must be authenticated to view book logs");
  const { data, error } = await supabase
    .from("book_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const createBookLog = async (bookLog) => {
  console.log("createBookLog called with:", bookLog);
  console.log("Inserting into table: book_logs");
  const { data, error } = await supabase
    .from("book_logs")
    .insert(bookLog)
    .select();
  console.log("Supabase response:", { data, error });
  if (error) {
    console.error("Database error:", error);
    throw error;
  }
  return data[0];
};

export const updateBookLog = async (logId, updates) => {
  const { data, error } = await supabase
    .from("book_logs")
    .update(updates)
    .eq("id", logId)
    .select();
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
    .select("*")
    .order("created_at", { ascending: false })
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
};

export const createBookTbr = async (bookTbr) => {
  const { data, error } = await supabase
    .from("book_tbr")
    .insert(bookTbr)
    .select();
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
    .select();
  if (error) throw error;
  return data[0];
};

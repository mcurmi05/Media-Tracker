// Per-user watch status for TV shows, stored once per (user, movies_and_tv_entries)
// row. `status` is a jsonb map of season_number -> array of watched episode
// numbers, e.g. { "1": [1, 2, 3], "2": [1] }. The shape is owned by the app; the
// column is a plain jsonb. Movies don't use this (no episodes).

import { supabase } from "./supabase-client";

// Returns the status object for a title, or {} if none/not signed in.
export async function getWatchStatus(userId, movieEntryId) {
  if (!userId || !movieEntryId) return {};
  const { data, error } = await supabase
    .from("watch_status")
    .select("status")
    .eq("user_id", userId)
    .eq("movie_entry_id", movieEntryId)
    .maybeSingle();
  if (error) {
    console.error("getWatchStatus failed", error);
    return {};
  }
  return data?.status || {};
}

// Upsert the full status object for a title (keyed on user_id + movie_entry_id).
export async function saveWatchStatus(userId, movieEntryId, status) {
  if (!userId || !movieEntryId) return;
  const { error } = await supabase.from("watch_status").upsert(
    {
      user_id: userId,
      movie_entry_id: movieEntryId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,movie_entry_id" }
  );
  if (error) console.error("saveWatchStatus failed", error);
}

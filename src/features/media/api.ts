// Data access for the unified media schema. All user-scoped reads join the
// media_entries metadata row as `entry`.
import { supabase } from "../../services/supabase-client";
import type {
  MediaEntry,
  MediaType,
  UserLog,
  UserRating,
  UserSave,
  UserWatchStatus,
} from "./types";

const ENTRY_JOIN = "*, entry:media_entries(*)";

/* ---------- media entries ---------- */

// Find an entry by its source identity (tmdb for movies/tv, hardcover for
// books, igdb for games). Returns null when the title was never stored.
export async function getEntryBySource(
  mediaType: MediaType,
  sourceId: string | number,
): Promise<MediaEntry | null> {
  let query = supabase.from("media_entries").select("*").limit(1);
  if (mediaType === "book") {
    query = query.eq("hardcover_id", String(sourceId));
  } else if (mediaType === "game") {
    query = query.eq("igdb_id", Number(sourceId));
  } else {
    query = query.eq("media_type", mediaType).eq("tmdb_id", Number(sourceId));
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data && (data[0] as MediaEntry)) || null;
}

export async function getEntryById(id: string): Promise<MediaEntry | null> {
  const { data, error } = await supabase
    .from("media_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as MediaEntry | null;
}

// Insert-or-fetch by source identity. `payload` must carry media_type, title
// and whichever external ids the source provides.
export async function findOrCreateEntry(
  payload: Partial<MediaEntry> & { media_type: MediaType; title: string },
): Promise<MediaEntry> {
  const sourceId =
    payload.media_type === "book"
      ? payload.hardcover_id
      : payload.media_type === "game"
        ? payload.igdb_id
        : payload.tmdb_id;
  if (sourceId != null) {
    const existing = await getEntryBySource(payload.media_type, sourceId);
    if (existing) return existing;
  }
  const { data, error } = await supabase
    .from("media_entries")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as MediaEntry;
}

export async function updateEntry(
  id: string,
  updates: Partial<MediaEntry>,
): Promise<MediaEntry> {
  const { data, error } = await supabase
    .from("media_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as MediaEntry;
}

/* ---------- generic user-scoped helpers ---------- */

type UserTable = "user_logs" | "user_ratings" | "user_saves";

async function listForUser<T>(table: UserTable, userId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select(ENTRY_JOIN)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
}

async function insertRow<T>(table: UserTable, row: object): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select(ENTRY_JOIN)
    .single();
  if (error) throw error;
  return data as T;
}

async function updateRow<T>(
  table: UserTable,
  id: string,
  updates: object,
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .select(ENTRY_JOIN)
    .single();
  if (error) throw error;
  return data as T;
}

async function deleteRow(table: UserTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

/* ---------- logs ---------- */

export const getLogs = (userId: string) => listForUser<UserLog>("user_logs", userId);
export const createLog = (row: Partial<UserLog>) => insertRow<UserLog>("user_logs", row);
export const updateLog = (id: string, updates: Partial<UserLog>) =>
  updateRow<UserLog>("user_logs", id, updates);
export const deleteLog = (id: string) => deleteRow("user_logs", id);

/* ---------- ratings ---------- */

export const getRatings = (userId: string) =>
  listForUser<UserRating>("user_ratings", userId);
export const createRating = (row: Partial<UserRating>) =>
  insertRow<UserRating>("user_ratings", row);
export const updateRating = (id: string, updates: Partial<UserRating>) =>
  updateRow<UserRating>("user_ratings", id, {
    ...updates,
    updated_at: new Date().toISOString(),
  });
export const deleteRating = (id: string) => deleteRow("user_ratings", id);

/* ---------- saves (watchlist / TBR / play-next) ---------- */

export const getSaves = (userId: string) => listForUser<UserSave>("user_saves", userId);
export const createSave = (row: Partial<UserSave>) =>
  insertRow<UserSave>("user_saves", row);
export const updateSave = (id: string, updates: Partial<UserSave>) =>
  updateRow<UserSave>("user_saves", id, updates);
export const deleteSave = (id: string) => deleteRow("user_saves", id);

/* ---------- watch status ---------- */

export async function getWatchStatuses(userId: string): Promise<UserWatchStatus[]> {
  const { data, error } = await supabase
    .from("user_watch_status")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as UserWatchStatus[];
}

export async function upsertWatchStatus(
  userId: string,
  entryId: string,
  status: unknown,
): Promise<UserWatchStatus> {
  const { data, error } = await supabase
    .from("user_watch_status")
    .upsert(
      {
        user_id: userId,
        entry_id: entryId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as UserWatchStatus;
}

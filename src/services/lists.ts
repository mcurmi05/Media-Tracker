import { supabase } from "./supabase-client";

// Shareable media lists. Each list_items row stores a self-contained snapshot
// (item_data) of the movie/TV/book so a list renders for anonymous visitors
// without touching any user-scoped table. See the lists/list_items/saved_lists
// tables and their RLS policies in Supabase.

/* ---------- snapshot builders ---------- */

// Build the { media_type, item_data } snapshot for a movie/TV object.
export function movieToListItem(movie) {
  return {
    media_type: movie.media_type, // "movie" | "tv"
    item_data: {
      tmdb_id: movie.tmdb_id ?? null,
      media_type: movie.media_type ?? null,
      primaryTitle: movie.primaryTitle ?? null,
      primaryImage: movie.primaryImage ?? null,
      startYear: movie.startYear ?? null,
    },
  };
}

// Build the snapshot for a book_entries-shaped object.
export function bookToListItem(book) {
  return {
    media_type: "book",
    item_data: {
      hardcover_id: book.hardcover_id ?? null,
      isbn13: book.isbn13 ?? null,
      goodreads_link: book.goodreads_link ?? null,
      title: book.title ?? null,
      author: book.author ?? null,
      cover_image: book.cover_image ?? null,
      release_year: book.release_year ?? null,
    },
  };
}

// The value that uniquely identifies a media item within a list, used for
// dedupe and membership checks.
export function mediaKey(snapshot) {
  if (snapshot.media_type !== "book") {
    return String(snapshot.item_data.tmdb_id);
  }
  return (
    snapshot.item_data.hardcover_id ||
    snapshot.item_data.goodreads_link ||
    `${snapshot.item_data.title}:${snapshot.item_data.author}`
  );
}

/* ---------- lists ---------- */

// Lists owned by the user, with an item count for the card badge.
export async function getMyLists(userId) {
  const { data, error } = await supabase
    .from("lists")
    .select("*, list_items(count)")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Lists the user has saved from other people (flattened, dropping any whose
// underlying list has since been deleted).
export async function getSavedLists(userId) {
  const { data, error } = await supabase
    .from("saved_lists")
    .select("saved_at, lists(*, list_items(count))")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.lists)
    .map((row) => ({ ...row.lists, saved_at: row.saved_at }));
}

// A single list plus its items, ordered for display. Public — works for
// anonymous visitors. Returns null if the list doesn't exist.
export async function getListWithItems(listId) {
  const { data: list, error } = await supabase
    .from("lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();
  if (error) throw error;
  if (!list) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", listId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemsErr) throw itemsErr;

  return { ...list, items: items ?? [] };
}

export async function createList(ownerId, { title, description, ownerName }) {
  const { data, error } = await supabase
    .from("lists")
    .insert({
      owner_id: ownerId,
      title,
      description: description || null,
      owner_name: ownerName || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateList(listId, fields) {
  const { data, error } = await supabase
    .from("lists")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", listId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteList(listId) {
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw error;
}

/* ---------- list items ---------- */

// Append a media snapshot to the end of a list.
export async function addMediaToList(listId, snapshot) {
  const { count } = await supabase
    .from("list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);

  const { data, error } = await supabase
    .from("list_items")
    .insert({
      list_id: listId,
      media_type: snapshot.media_type,
      item_data: snapshot.item_data,
      position: count ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeListItem(itemId) {
  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// Of the given lists, which already contain this media item. One query for the
// whole set so the add-to-list modal can show "Added" up front.
export async function listsContainingMedia(listIds, snapshot) {
  if (!listIds.length) return new Set();
  let query = supabase
    .from("list_items")
    .select("list_id")
    .in("list_id", listIds);

  if (snapshot.media_type === "book") {
    if (snapshot.item_data.hardcover_id) {
      query = query.eq(
        "item_data->>hardcover_id",
        String(snapshot.item_data.hardcover_id),
      );
    } else {
      query = query.eq(
        "item_data->>goodreads_link",
        snapshot.item_data.goodreads_link,
      );
    }
  } else {
    query = query
      .eq("media_type", snapshot.media_type)
      .eq("item_data->>tmdb_id", String(snapshot.item_data.tmdb_id));
  }

  const { data, error } = await query;
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.list_id));
}

// The user's lists with their items, used to build the home-page activity feed
// (list created + items added events).
export async function getListsActivity(userId) {
  const { data, error } = await supabase
    .from("lists")
    .select("id, title, created_at, list_items(id, item_data, media_type, created_at)")
    .eq("owner_id", userId);
  if (error) throw error;
  return data ?? [];
}

/* ---------- saving others' lists ---------- */

export async function isListSaved(userId, listId) {
  const { data, error } = await supabase
    .from("saved_lists")
    .select("list_id")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function saveList(userId, listId) {
  const { error } = await supabase
    .from("saved_lists")
    .insert({ user_id: userId, list_id: listId });
  if (error) throw error;
}

export async function unsaveList(userId, listId) {
  const { error } = await supabase
    .from("saved_lists")
    .delete()
    .eq("user_id", userId)
    .eq("list_id", listId);
  if (error) throw error;
}

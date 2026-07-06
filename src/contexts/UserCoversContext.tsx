import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabase-client";
import { useAuth } from "./AuthContext";

/* eslint-disable react-refresh/only-export-components */

// Per-user cover overrides. A user can pick their own poster/cover for a title;
// it applies everywhere they see that title (logs, ratings, watchlist, details,
// search, browse) without changing the shared media_entries.cover_url. Stored in
// user_media_covers (see docs/user-media-covers-migration.sql).
//
// Overrides are keyed on the media entry id, but browse/search cards only carry
// a tmdb_id (movies/tv) or hardcover_id (books). So we index the loaded rows
// three ways and expose a lookup for each.
const UserCoversContext = createContext();

export const useCovers = () => {
  const context = useContext(UserCoversContext);
  if (!context) {
    throw new Error("useCovers must be used within a UserCoversProvider");
  }
  return context;
};

const tmdbKey = (mediaType, tmdbId) =>
  mediaType != null && tmdbId != null ? `${mediaType}:${tmdbId}` : null;

export const UserCoversProvider = ({ children }) => {
  // Three indexes of the same overrides: by entry id, by media_type:tmdb_id,
  // and by hardcover_id.
  const [maps, setMaps] = useState({ byEntry: {}, byTmdb: {}, byHardcover: {} });
  const { user } = useAuth();
  const hasFetched = useRef(false);

  const coverFor = (entryId) =>
    entryId ? maps.byEntry[entryId] ?? null : null;
  const coverForTmdb = (mediaType, tmdbId) => {
    const k = tmdbKey(mediaType, tmdbId);
    return k ? maps.byTmdb[k] ?? null : null;
  };
  const coverForHardcover = (hardcoverId) =>
    hardcoverId != null ? maps.byHardcover[String(hardcoverId)] ?? null : null;

  // Set (or clear) the user's cover for a title. Optimistic: state updates
  // immediately so every surface repaints, then the row is upserted/deleted.
  // `keys` carries tmdb/hardcover ids so browse cards repaint too.
  const setCover = async (entryId, posterUrl, keys = {}) => {
    if (!user || !entryId) return;
    const k = tmdbKey(keys.mediaType, keys.tmdbId);
    const hc = keys.hardcoverId != null ? String(keys.hardcoverId) : null;
    setMaps((prev) => {
      const next = {
        byEntry: { ...prev.byEntry },
        byTmdb: { ...prev.byTmdb },
        byHardcover: { ...prev.byHardcover },
      };
      if (posterUrl) {
        next.byEntry[entryId] = posterUrl;
        if (k) next.byTmdb[k] = posterUrl;
        if (hc) next.byHardcover[hc] = posterUrl;
      } else {
        delete next.byEntry[entryId];
        if (k) delete next.byTmdb[k];
        if (hc) delete next.byHardcover[hc];
      }
      return next;
    });
    if (posterUrl) {
      const { error } = await supabase.from("user_media_covers").upsert(
        {
          user_id: user.id,
          entry_id: entryId,
          poster_url: posterUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,entry_id" },
      );
      if (error) console.error("Failed to save cover override:", error);
    } else {
      const { error } = await supabase
        .from("user_media_covers")
        .delete()
        .eq("user_id", user.id)
        .eq("entry_id", entryId);
      if (error) console.error("Failed to clear cover override:", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (user && !hasFetched.current) {
        hasFetched.current = true;
        const { data, error } = await supabase
          .from("user_media_covers")
          .select(
            "entry_id, poster_url, entry:media_entries(tmdb_id, media_type, hardcover_id)",
          )
          .eq("user_id", user.id);
        if (error) {
          console.error("Failed to load cover overrides:", error);
          return;
        }
        const byEntry = {};
        const byTmdb = {};
        const byHardcover = {};
        (data || []).forEach((r) => {
          byEntry[r.entry_id] = r.poster_url;
          const k = tmdbKey(r.entry?.media_type, r.entry?.tmdb_id);
          if (k) byTmdb[k] = r.poster_url;
          if (r.entry?.hardcover_id != null)
            byHardcover[String(r.entry.hardcover_id)] = r.poster_url;
        });
        setMaps({ byEntry, byTmdb, byHardcover });
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMaps({ byEntry: {}, byTmdb: {}, byHardcover: {} });
      hasFetched.current = false;
    }
  }, [user]);

  return (
    <UserCoversContext.Provider
      value={{ coverFor, coverForTmdb, coverForHardcover, setCover }}
    >
      {children}
    </UserCoversContext.Provider>
  );
};

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabase-client";
import { useAuth } from "./AuthContext";

/* eslint-disable react-refresh/only-export-components */

// Per-user cover overrides. A user can pick their own poster/cover for a title;
// it applies everywhere they see that title (logs, ratings, watchlist, details)
// without changing the shared media_entries.cover_url. Stored in
// user_media_covers (see docs/user-media-covers-migration.sql).
const UserCoversContext = createContext();

export const useCovers = () => {
  const context = useContext(UserCoversContext);
  if (!context) {
    throw new Error("useCovers must be used within a UserCoversProvider");
  }
  return context;
};

export const UserCoversProvider = ({ children }) => {
  // entry_id -> poster_url
  const [covers, setCovers] = useState({});
  const { user } = useAuth();
  const hasFetched = useRef(false);

  const coverFor = (entryId) => (entryId ? covers[entryId] ?? null : null);

  // Set (or clear) the user's cover for a title. Optimistic: state updates
  // immediately so every surface repaints, then the row is upserted/deleted.
  const setCover = async (entryId, posterUrl) => {
    if (!user || !entryId) return;
    setCovers((prev) => {
      const next = { ...prev };
      if (posterUrl) next[entryId] = posterUrl;
      else delete next[entryId];
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
          .select("entry_id, poster_url")
          .eq("user_id", user.id);
        if (error) {
          console.error("Failed to load cover overrides:", error);
          return;
        }
        const map = {};
        (data || []).forEach((r) => {
          map[r.entry_id] = r.poster_url;
        });
        setCovers(map);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCovers({});
      hasFetched.current = false;
    }
  }, [user]);

  return (
    <UserCoversContext.Provider value={{ covers, coverFor, setCover }}>
      {children}
    </UserCoversContext.Provider>
  );
};

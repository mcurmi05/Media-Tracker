import { createContext, useContext, useState } from "react";
import { getUserLogs } from "../services/ratingsfromtable.js";
import { useAuth } from "./AuthContext.jsx";
import { useEffect, useRef } from "react";
import { supabase } from "../services/supabase-client";

/* eslint-disable react-refresh/only-export-components */

const UserLogsContext = createContext();

export const useLogs = () => {
  const context = useContext(UserLogsContext);
  if (!context) {
    throw new Error("useLogs must be used within a UserLogsProvider");
  }
  return context;
};

export const UserLogsProvider = ({ children }) => {
  const [userLogs, setUserLogs] = useState([]);
  const [userLogsLoaded, setUserLogsLoaded] = useState(false);
  const { user } = useAuth();
  const hasFetched = useRef(false);

  const addLog = (movieId, log, movie, log_id) => {
    const newLog = {
      id: log_id,
      imdb_movie_id: movieId,
      user_id: user.id,
      log: log,
      movie_object: movie,
      created_at: new Date().toISOString(),
    };
    setUserLogs((prev) => [newLog, ...prev]);
  };

  // Add a new season to a log's season_info JSONB column
  const addSeason = async (log_id) => {
    // Capture the exact creation timestamp once and preserve it
    const creationTimestamp = new Date().toISOString();

    // Create the season object with the permanent creation date
    const createNewSeasonObject = (seasonNumber) => ({
      season: seasonNumber,
      start_date: creationTimestamp, // This date is set once and never auto-updated
      end_date: null,
      finished: false,
      finished_at: null,
      created_at: creationTimestamp, // Track when this season was originally created
    });

    setUserLogs((prev) => {
      const updated = prev.map((l) => {
        if (l.id !== log_id) return l;
        const current = l.season_info || [];
        const nextSeasonNumber = current.length + 1;
        const newSeason = createNewSeasonObject(nextSeasonNumber);
        const newSeasonInfo = [...current, newSeason];
        // optimistic local update
        return { ...l, season_info: newSeasonInfo };
      });
      return updated;
    });

    // Persist to Supabase
    try {
      const logRow = userLogs.find((x) => x.id === log_id);
      const current = logRow?.season_info || [];
      const nextSeasonNumber = current.length + 1;
      const newSeason = createNewSeasonObject(nextSeasonNumber);
      const newSeasonInfo = [...current, newSeason];
      const { error } = await supabase
        .from("logs")
        .update({ season_info: newSeasonInfo })
        .eq("id", log_id);
      if (error) console.error("Failed to persist new season:", error);
    } catch (err) {
      console.error("addSeason error:", err);
    }
  };

  // Mark or unmark a season as finished and persist
  const setSeasonFinished = async (log_id, seasonIndex, finished) => {
    setUserLogs((prev) => {
      return prev.map((l) => {
        if (l.id !== log_id) return l;
        const current = Array.isArray(l.season_info) ? [...l.season_info] : [];
        if (!current[seasonIndex]) return l;
        const now = finished ? new Date().toISOString() : null;
        current[seasonIndex] = {
          ...current[seasonIndex],
          finished: !!finished,
          finished_at: now,
          end_date: finished ? current[seasonIndex].end_date || now : null,
        };
        return { ...l, season_info: current };
      });
    });

    try {
      const logRow = userLogs.find((x) => x.id === log_id);
      const current = logRow?.season_info ? [...logRow.season_info] : [];
      if (!current[seasonIndex])
        current[seasonIndex] = {
          season: seasonIndex + 1,
          start_date: null,
          end_date: null,
          finished: false,
          finished_at: null,
        };
      const now = finished ? new Date().toISOString() : null;
      current[seasonIndex] = {
        ...current[seasonIndex],
        finished: !!finished,
        finished_at: now,
        end_date: finished ? current[seasonIndex].end_date || now : null,
      };
      const { error } = await supabase
        .from("logs")
        .update({ season_info: current })
        .eq("id", log_id);
      if (error) console.error("Failed to persist setSeasonFinished:", error);
    } catch (err) {
      console.error("setSeasonFinished error:", err);
    }
  };

  // Mark a season as DNF (did not finish), or clear that flag.
  // A DNF season is not "finished", so finished state is cleared alongside.
  const setSeasonDnf = async (log_id, seasonIndex, dnf) => {
    const applyUpdate = (current) => {
      if (!current[seasonIndex]) return current;
      current[seasonIndex] = {
        ...current[seasonIndex],
        dnf: !!dnf,
        finished: dnf ? false : current[seasonIndex].finished,
        finished_at: dnf ? null : current[seasonIndex].finished_at,
        end_date: dnf ? null : current[seasonIndex].end_date,
      };
      return current;
    };

    setUserLogs((prev) =>
      prev.map((l) => {
        if (l.id !== log_id) return l;
        const current = Array.isArray(l.season_info) ? [...l.season_info] : [];
        return { ...l, season_info: applyUpdate(current) };
      }),
    );

    try {
      const logRow = userLogs.find((x) => x.id === log_id);
      const current = logRow?.season_info ? [...logRow.season_info] : [];
      if (!current[seasonIndex]) return;
      applyUpdate(current);
      const { error } = await supabase
        .from("logs")
        .update({ season_info: current })
        .eq("id", log_id);
      if (error) console.error("Failed to persist setSeasonDnf:", error);
    } catch (err) {
      console.error("setSeasonDnf error:", err);
    }
  };

  // Update a single season date (start_date or end_date)
  const updateSeasonDate = async (log_id, seasonIndex, field, isoDate) => {
    // field should be 'start_date' or 'end_date'
    setUserLogs((prev) => {
      return prev.map((l) => {
        if (l.id !== log_id) return l;
        const current = Array.isArray(l.season_info) ? [...l.season_info] : [];
        if (!current[seasonIndex]) return l;
        current[seasonIndex] = { ...current[seasonIndex], [field]: isoDate };
        return { ...l, season_info: current };
      });
    });

    try {
      const logRow = userLogs.find((x) => x.id === log_id);
      const current = logRow?.season_info ? [...logRow.season_info] : [];
      if (!current[seasonIndex])
        current[seasonIndex] = {
          season: seasonIndex + 1,
          start_date: null,
          end_date: null,
        };
      current[seasonIndex] = { ...current[seasonIndex], [field]: isoDate };
      const { error } = await supabase
        .from("logs")
        .update({ season_info: current })
        .eq("id", log_id);
      if (error) console.error("Failed to persist season date update:", error);
    } catch (err) {
      console.error("updateSeasonDate error:", err);
    }
  };

  // Remove the newest season for a log (only removes the last season)
  const removeSeason = async (log_id) => {
    setUserLogs((prev) => {
      return prev.map((l) => {
        if (l.id !== log_id) return l;
        const current = Array.isArray(l.season_info) ? [...l.season_info] : [];
        if (current.length === 0) return l;
        current.pop();
        return { ...l, season_info: current };
      });
    });

    try {
      const logRow = userLogs.find((x) => x.id === log_id);
      const current = logRow?.season_info ? [...logRow.season_info] : [];
      if (current.length > 0) current.pop();
      const { error } = await supabase
        .from("logs")
        .update({ season_info: current })
        .eq("id", log_id);
      if (error) console.error("Failed to persist remove season:", error);
    } catch (err) {
      console.error("removeSeason error:", err);
    }
  };

  // Remove a season at a specific index for a log
  const removeSeasonAt = async (log_id, seasonIndex) => {
    setUserLogs((prev) => {
      return prev.map((l) => {
        if (l.id !== log_id) return l;
        const current = Array.isArray(l.season_info) ? [...l.season_info] : [];
        if (seasonIndex < 0 || seasonIndex >= current.length) return l;
        current.splice(seasonIndex, 1);
        // re-number seasons to keep season property consistent
        const renumbered = current.map((s, idx) => ({ ...s, season: idx + 1 }));
        return { ...l, season_info: renumbered };
      });
    });

    try {
      const logRow = userLogs.find((x) => x.id === log_id);
      const current = logRow?.season_info ? [...logRow.season_info] : [];
      if (seasonIndex < 0 || seasonIndex >= current.length) return;
      current.splice(seasonIndex, 1);
      const renumbered = current.map((s, idx) => ({ ...s, season: idx + 1 }));
      const { error } = await supabase
        .from("logs")
        .update({ season_info: renumbered })
        .eq("id", log_id);
      if (error) console.error("Failed to persist removeSeasonAt:", error);
    } catch (err) {
      console.error("removeSeasonAt error:", err);
    }
  };

  const updateLog = (log_id, newLog) => {
    setUserLogs((prev) =>
      prev.map((log) => (log.id === log_id ? { ...log, log: newLog } : log)),
    );
  };

  const updateDate = (log_id, newCreated_at) => {
    setUserLogs((prev) =>
      prev.map((log) =>
        log.id === log_id ? { ...log, created_at: newCreated_at } : log,
      ),
    );
  };

  // Update the multi-day end date for a movie log (null clears multi-day mode)
  const updateEndDate = (log_id, newEndDate) => {
    setUserLogs((prev) =>
      prev.map((log) =>
        log.id === log_id ? { ...log, movie_end_date: newEndDate } : log,
      ),
    );
  };

  // Merge an arbitrary set of fields into a log row (local state only).
  const patchLog = (log_id, updates) => {
    setUserLogs((prev) =>
      prev.map((log) =>
        log.id === log_id ? { ...log, ...updates } : log,
      ),
    );
  };

  const removeLog = (log_id) => {
    setUserLogs((prev) => prev.filter((log) => log.id !== log_id));
  };

  useEffect(() => {
    const loadLogs = async () => {
      if (user && !hasFetched.current) {
        hasFetched.current = true;
        try {
          setUserLogsLoaded(false);
          const logs = await getUserLogs(user);
          console.log(logs);
          setUserLogs(logs);
          setUserLogsLoaded(true);
        } catch (err) {
          setUserLogsLoaded(false);
          console.log(err);
        }
      }
    };
    loadLogs();
  }, [user]);

  return (
    <UserLogsContext.Provider
      value={{
        userLogs,
        userLogsLoaded,
        setUserLogs,
        addLog,
        addSeason,
        updateSeasonDate,
        removeSeason,
        removeSeasonAt,
        setSeasonFinished,
        setSeasonDnf,
        removeLog,
        updateLog,
        updateDate,
        updateEndDate,
        patchLog,
      }}
    >
      {children}
    </UserLogsContext.Provider>
  );
};

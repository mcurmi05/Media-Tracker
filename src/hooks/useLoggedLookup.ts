import { useMemo } from "react";
import { useLogs } from "../contexts/UserLogsContext";
import { useBookLogs } from "../contexts/UserBookLogsContext";

// Builds fast lookups for "has this title been logged" so search surfaces can
// show a logged tick. Movies/TV key on media_type:tmdb_id, books on
// hardcover_id.
export function useLoggedLookup() {
  const { userLogs } = useLogs();
  const { bookLogs } = useBookLogs();

  return useMemo(() => {
    const movieKeys = new Set();
    userLogs.forEach((l) => {
      const mo = l.movie_object;
      if (mo?.tmdb_id != null) movieKeys.add(`${mo.media_type}:${mo.tmdb_id}`);
    });

    const bookKeys = new Set();
    bookLogs.forEach((l) => {
      const id = l.book_entries?.hardcover_id;
      if (id != null) bookKeys.add(String(id));
    });

    const isLogged = (item) => {
      if (!item) return false;
      if (item.hardcover_id != null) return bookKeys.has(String(item.hardcover_id));
      if (item.tmdb_id != null) return movieKeys.has(`${item.media_type}:${item.tmdb_id}`);
      return false;
    };

    return { isLogged };
  }, [userLogs, bookLogs]);
}

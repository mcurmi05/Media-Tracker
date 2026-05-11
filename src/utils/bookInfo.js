// Returns the canonical book metadata for a row from book_logs, book_tbr,
// or book_ratings. Prefers the joined book_entries column (the source of truth)
// and falls back to the legacy columns on the row itself for safety during
// the migration window.
export function getBookInfo(row) {
  if (!row) {
    return {
      title: "",
      author: "",
      cover_image: null,
      release_year: null,
      goodreads_link: null,
    };
  }
  const entry = row.book_entries || {};
  return {
    title: entry.title ?? row.title ?? "",
    author: entry.author ?? row.author ?? "",
    cover_image: entry.cover_image ?? row.cover_image ?? null,
    release_year: entry.release_year ?? row.release_year ?? null,
    goodreads_link: entry.goodreads_link ?? row.goodreads_link ?? null,
  };
}

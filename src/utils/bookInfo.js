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
      goodreads_id: null,
      hardcover_id: null,
      isbn13: null,
      slug: null,
      book_description: null,
    };
  }
  const entry = row.book_entries || {};
  return {
    title: entry.title ?? row.title ?? "",
    author: entry.author ?? row.author ?? "",
    cover_image: entry.cover_image ?? row.cover_image ?? null,
    release_year: entry.release_year ?? row.release_year ?? null,
    goodreads_link: entry.goodreads_link ?? row.goodreads_link ?? null,
    goodreads_id: entry.goodreads_id ?? row.goodreads_id ?? null,
    hardcover_id: entry.hardcover_id ?? row.hardcover_id ?? null,
    isbn13: entry.isbn13 ?? row.isbn13 ?? null,
    slug: entry.slug ?? row.slug ?? null,
    hardcover_url: entry.hardcover_url ?? row.hardcover_url ?? null,
    book_description: entry.book_description ?? row.book_description ?? null,
  };
}

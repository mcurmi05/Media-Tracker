// Helpers for turning Goodreads links into the book details route and back.
// The book details route uses the Goodreads URL path (everything after
// "goodreads.com/") as its identifier, in place of an IMDb id.

// The path segment of a Goodreads URL, e.g.
// "https://www.goodreads.com/book/show/2767052-the-hunger-games"
// -> "book/show/2767052-the-hunger-games". Query strings are dropped.
export function goodreadsPath(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (!/(^|\.)goodreads\.com$/i.test(u.hostname)) return null;
    const path = u.pathname.replace(/^\/+/, "").trim();
    return path || null;
  } catch {
    const m = String(link).match(/goodreads\.com\/([^?#]+)/i);
    return m ? m[1].replace(/^\/+/, "").trim() : null;
  }
}

// The numeric Goodreads book id from a link or path, e.g.
// "https://www.goodreads.com/book/show/2767052-the-hunger-games" -> 2767052.
// This is the stable per-book identity (the slug part can change), and is the
// key the `goodreads_ratings` cache is stored under - the books equivalent of
// a movie's tmdb_id.
export function goodreadsId(link) {
  const path = goodreadsPath(link) || String(link || "");
  const m = path.match(/book\/show\/(\d+)/);
  return m ? Number(m[1]) : null;
}

// Route to a book's details page, or null when there is no usable link.
export function bookDetailsRoute(link) {
  const path = goodreadsPath(link);
  return path ? `/bookdetails/${path}` : null;
}

//hardcover is the canonical route
//goodreads remains as the legacy deep link fallback
export function bookDetailsRouteForBook(book) {
  const hardcoverId = book?.hardcover_id || book?.book_entries?.hardcover_id;
  if (hardcoverId != null && String(hardcoverId).trim()) {
    return `/bookdetails/hardcover/${encodeURIComponent(hardcoverId)}`;
  }
  return bookDetailsRoute(
    book?.goodreads_link || book?.book_entries?.goodreads_link,
  );
}

// Rebuild a full Goodreads URL from a route path (the splat param value).
export function goodreadsUrlFromPath(path) {
  if (!path) return null;
  return `https://www.goodreads.com/${String(path).replace(/^\/+/, "")}`;
}

// Split "Title (Series #N)" / "Title (Series, #N)" into its parts.
export function parseBookTitle(rawTitle) {
  const match = (rawTitle || "").match(
    /^(.*?)\s*\(([^()]+?)[,\s]*#([^()]+?)\)\s*$/,
  );
  if (!match) {
    return { mainTitle: rawTitle || "", seriesName: null, seriesIndex: null };
  }
  return {
    mainTitle: match[1].trim(),
    seriesName: match[2].trim(),
    seriesIndex: match[3].trim(),
  };
}

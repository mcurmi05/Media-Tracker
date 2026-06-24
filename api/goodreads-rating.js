// Vercel serverless function: on-demand Goodreads rating for one book.
// Used by the book details page to refresh a single title live. Scrapes the
// book page (resolved from the numeric Goodreads book id), upserts the result
// into the `goodreads_ratings` cache, and returns it.
//
// Ratings stay on Goodreads' native 0–5 scale. This is the books analogue of
// api/letterboxd.js (which does the same for movies, keyed by tmdb_id).

// URL can come from the dedicated server var or the existing client var (same
// value); the write requires the service-role key (anon key is read-only here).
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch a Goodreads book page, retrying transient rate-limit responses
// (503/429/5xx) with backoff - Goodreads throttles aggressively. Returns the
// ok response, or null.
async function fetchBook(goodreadsId, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(
      `https://www.goodreads.com/book/show/${goodreadsId}`,
      {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
      },
    );
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      await sleep(600 * (attempt + 1) + Math.floor(Math.random() * 400));
      continue;
    }
    return null;
  }
  return null;
}

// Pull the aggregate rating + count out of a Goodreads book page. Tries the
// JSON-LD block first, then the Apollo/__NEXT_DATA__ work stats, then the
// visible rating widget as a last resort.
function extractRating(html) {
  let rating = null;
  let rating_count = null;

  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        const t = c?.["@type"];
        const isBook = t === "Book" || (Array.isArray(t) && t.includes("Book"));
        if (isBook && c.aggregateRating) {
          const ar = c.aggregateRating;
          if (rating == null && ar.ratingValue != null)
            rating = Number(ar.ratingValue);
          if (rating_count == null && ar.ratingCount != null)
            rating_count = Number(ar.ratingCount);
        }
      }
    } catch {
      // ignore parse errors and keep scanning
    }
  }

  if (rating == null) {
    const a = html.match(/"averageRating":\s*([\d.]+)/);
    if (a) rating = parseFloat(a[1]);
  }
  if (rating_count == null) {
    const c = html.match(/"ratingsCount":\s*(\d+)/);
    if (c) rating_count = parseInt(c[1], 10);
  }
  if (rating == null) {
    const r = html.match(/RatingStatistics__rating[^>]*>\s*([\d.]+)/i);
    if (r) rating = parseFloat(r[1]);
  }
  if (rating_count == null) {
    const r = html.match(/([\d,]+)\s*ratings?/i);
    if (r) {
      const n = parseInt(r[1].replace(/,/g, ""), 10);
      if (!Number.isNaN(n)) rating_count = n;
    }
  }

  rating =
    typeof rating === "number" && !Number.isNaN(rating)
      ? Math.round(rating * 100) / 100
      : null;
  if (typeof rating_count !== "number" || Number.isNaN(rating_count))
    rating_count = null;

  return { rating, rating_count };
}

async function scrapeRating(goodreadsId) {
  const res = await fetchBook(goodreadsId);
  if (!res) return null;

  const html = await res.text();
  const { rating, rating_count } = extractRating(html);
  if (rating == null) return null;

  let slug = null;
  try {
    slug = new URL(res.url).pathname
      .replace(/^\/book\/show\//, "")
      .replace(/\/$/, "");
  } catch {
    /* leave slug null */
  }

  return { goodreads_id: goodreadsId, slug, rating, rating_count };
}

async function cacheRow(row) {
  if (!SUPABASE_URL || !SERVICE_KEY) return; // best-effort cache write
  const url =
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/goodreads_ratings` +
    `?on_conflict=goodreads_id`;
  await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ ...row, updated_at: new Date().toISOString() }]),
  }).catch(() => {});
}

export default async function handler(req, res) {
  const raw =
    req.query?.id ||
    (req.url && new URL(req.url, "http://x").searchParams.get("id"));
  const goodreadsId = Number(raw);
  if (!Number.isInteger(goodreadsId) || goodreadsId <= 0) {
    return res.status(400).json({ error: "Missing or invalid id" });
  }

  try {
    const row = await scrapeRating(goodreadsId);
    if (!row) return res.status(404).json({ error: "No rating found" });
    await cacheRow(row);
    return res.status(200).json({
      goodreads_id: row.goodreads_id,
      slug: row.slug,
      rating: row.rating,
      ratingCount: row.rating_count,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

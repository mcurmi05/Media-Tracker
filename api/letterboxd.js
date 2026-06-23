// Vercel serverless function: on-demand Letterboxd rating for one movie.
// Used by the media details page to refresh a single title live. Scrapes the
// film page (resolved via Letterboxd's /tmdb/{id}/ redirect), upserts the
// result into the `letterboxd_ratings` cache, and returns it.
//
// Ratings stay on Letterboxd's native 0–5 scale.

// URL can come from the dedicated server var or the existing client var (same
// value); the write requires the service-role key (anon key is read-only here).
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function scrapeRating(tmdbId) {
  const res = await fetch(`https://letterboxd.com/tmdb/${tmdbId}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok || !res.url.includes("/film/")) return null;

  const html = await res.text();
  const m = html.match(
    /<script type="application\/ld\+json">\s*\/\* <!\[CDATA\[ \*\/([\s\S]*?)\/\* \]\]> \*\/\s*<\/script>/,
  );
  if (!m) return null;

  let ld;
  try {
    ld = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const agg = ld.aggregateRating;
  if (!agg || agg.ratingValue == null) return null;

  let slug = null;
  try {
    slug = new URL(ld.url).pathname.replace(/^\/film\//, "").replace(/\/$/, "");
  } catch {
    /* leave slug null */
  }

  return {
    tmdb_id: tmdbId,
    slug,
    rating: Number(agg.ratingValue),
    rating_count: agg.ratingCount != null ? Number(agg.ratingCount) : null,
    review_count: agg.reviewCount != null ? Number(agg.reviewCount) : null,
  };
}

async function cacheRow(row) {
  if (!SUPABASE_URL || !SERVICE_KEY) return; // best-effort cache write
  const url =
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/letterboxd_ratings` +
    `?on_conflict=tmdb_id`;
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
    req.query?.tmdb_id ||
    (req.url && new URL(req.url, "http://x").searchParams.get("tmdb_id"));
  const tmdbId = Number(raw);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: "Missing or invalid tmdb_id" });
  }

  try {
    const row = await scrapeRating(tmdbId);
    if (!row) return res.status(404).json({ error: "No rating found" });
    await cacheRow(row);
    return res.status(200).json({
      tmdb_id: row.tmdb_id,
      slug: row.slug,
      rating: row.rating,
      ratingCount: row.rating_count,
      reviewCount: row.review_count,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

// Daily sync of Letterboxd ratings into the Supabase `letterboxd_ratings`
// table. Run by .github/workflows/sync-letterboxd-ratings.yml.
//
// Letterboxd has no bulk dataset (unlike IMDb), so we scrape one page per
// film. The set of films we refresh is:
//   1. every movie already in our `movies` table (media_type = 'movie'), and
//   2. the current TMDB trending movies (so the Home/Trending strips have
//      ratings for titles that aren't in our table yet) — mirroring how the
//      IMDb dataset already covers trending titles for free.
//
// Slug resolution is free: https://letterboxd.com/tmdb/{tmdb_id}/ 302-redirects
// straight to the canonical /film/{slug}/ page, so we never guess a slug.
//
// Talks to PostgREST directly with fetch (no @supabase/supabase-js), using the
// service-role key which bypasses RLS — same approach as sync-imdb-ratings.mjs.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const TMDB_BASE = "https://api.themoviedb.org/3";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Be polite to Letterboxd: a handful of requests in flight, with small gaps.
const CONCURRENCY = 6;
const UPSERT_BATCH = 500;
const TMDB_TRENDING_PAGES = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Letterboxd scrape ------------------------------------------------------

// Pull the JSON-LD block (CDATA-wrapped) and return { slug, rating,
// ratingCount } for a tmdb id, or null if the film can't be
// resolved or has no aggregate rating yet.
async function scrapeRating(tmdbId) {
  const res = await fetch(`https://letterboxd.com/tmdb/${tmdbId}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
  });
  // A bad/unmatched id never reaches a /film/ page.
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

  const slug = (() => {
    try {
      return new URL(ld.url).pathname.replace(/^\/film\//, "").replace(/\/$/, "");
    } catch {
      return null;
    }
  })();

  return {
    tmdb_id: tmdbId,
    slug,
    rating: Number(agg.ratingValue),
    rating_count: agg.ratingCount != null ? Number(agg.ratingCount) : null,
  };
}

// --- Supabase ---------------------------------------------------------------

async function upsert(rows) {
  if (rows.length === 0) return;
  const res = await fetch(`${REST}/letterboxd_ratings?on_conflict=tmdb_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Upsert failed: ${res.status} ${res.statusText} - ${detail}`);
  }
}

// Every movie tmdb_id already in our catalogue, paged to dodge PostgREST's
// default 1000-row ceiling.
async function moviesTmdbIds() {
  const ids = new Set();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const url =
      `${REST}/media_entries?select=tmdb_id&media_type=eq.movie` +
      `&tmdb_id=not.is.null&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`movies fetch failed: ${res.status}`);
    const rows = await res.json();
    rows.forEach((r) => r.tmdb_id != null && ids.add(Number(r.tmdb_id)));
    if (rows.length < PAGE) break;
  }
  return ids;
}

// --- TMDB trending ----------------------------------------------------------

async function tmdbTrendingIds() {
  if (!TMDB_KEY) {
    console.warn("No TMDB_API_KEY set; skipping trending pre-warm.");
    return new Set();
  }
  const isJwt = TMDB_KEY.split(".").length === 3;
  const ids = new Set();
  for (let page = 1; page <= TMDB_TRENDING_PAGES; page++) {
    const sp = new URLSearchParams({ page: String(page) });
    if (!isJwt) sp.set("api_key", TMDB_KEY);
    const res = await fetch(`${TMDB_BASE}/trending/movie/week?${sp}`, {
      headers: isJwt ? { Authorization: `Bearer ${TMDB_KEY}` } : {},
    });
    if (!res.ok) break;
    const json = await res.json();
    (json.results || []).forEach((r) => r.id != null && ids.add(Number(r.id)));
    if (page >= (json.total_pages || 1)) break;
  }
  return ids;
}

// --- main -------------------------------------------------------------------

async function main() {
  const [catalogue, trending] = await Promise.all([
    moviesTmdbIds(),
    tmdbTrendingIds(),
  ]);
  const ids = [...new Set([...catalogue, ...trending])];
  console.log(
    `Refreshing ${ids.length} films ` +
      `(${catalogue.size} catalogue + ${trending.size} trending, deduped).`,
  );

  const syncedAt = new Date().toISOString();
  let batch = [];
  let ok = 0;
  let miss = 0;

  // Simple fixed-size worker pool over the id list.
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const row = await scrapeRating(id);
        if (row) {
          batch.push({ ...row, updated_at: syncedAt });
          ok++;
        } else {
          miss++;
        }
      } catch (err) {
        miss++;
        console.warn(`  ${id}: ${err.message}`);
      }
      if (batch.length >= UPSERT_BATCH) {
        const toSend = batch;
        batch = [];
        await upsert(toSend);
        console.log(`  upserted ${ok} ratings so far`);
      }
      await sleep(80); // gentle pacing per worker
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await upsert(batch);

  console.log(`Done. Upserted ${ok} ratings, ${miss} skipped/missing.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

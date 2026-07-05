// Daily sync of Goodreads ratings into the Supabase `goodreads_ratings` table.
// Run by .github/workflows/sync-goodreads-ratings.yml.
//
// Goodreads has no bulk dataset (like Letterboxd, unlike IMDb), so we scrape
// one page per book. The set of books we refresh is every book already in our
// `media_entries` table (media_type=book) that has a parseable Goodreads id. There is no
// "trending" concept for books, so - unlike the Letterboxd sync - we only
// cover the catalogue.
//
// Talks to PostgREST directly with fetch (no @supabase/supabase-js), using the
// service-role key which bypasses RLS - same approach as the Letterboxd/IMDb
// syncs.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Be polite to Goodreads: a few requests in flight, with small gaps. Goodreads
// returns 503/429 when hit too fast, so keep this modest and lean on retries.
const CONCURRENCY = 4;
const UPSERT_BATCH = 500;
const MAX_ATTEMPTS = 4; // retry transient 503/429/5xx with backoff

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Goodreads scrape -------------------------------------------------------

// The numeric Goodreads book id from a link, e.g.
// ".../book/show/2767052-the-hunger-games" -> 2767052.
function goodreadsId(link) {
  const m = String(link || "").match(/book\/show\/(\d+)/);
  return m ? Number(m[1]) : null;
}

// Pull the aggregate rating + count out of a Goodreads book page. Mirrors the
// extractor in api/goodreads-rating.js.
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

// Fetch a Goodreads book page, retrying transient rate-limit responses
// (503/429/5xx) with exponential backoff. Returns the ok response, or null.
async function fetchBook(id) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`https://www.goodreads.com/book/show/${id}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
    });
    if (res.ok) return res;
    // 503/429/5xx are Goodreads throttling us - back off and try again.
    if (res.status === 429 || res.status >= 500) {
      await sleep(800 * (attempt + 1) + Math.floor(Math.random() * 500));
      continue;
    }
    return null; // 404 and other hard failures: don't retry
  }
  return null;
}

// Returns { goodreads_id, slug, rating, rating_count } for a book id, or null
// if the page can't be loaded or has no aggregate rating yet.
async function scrapeRating(id) {
  const res = await fetchBook(id);
  if (!res) return null;

  const html = await res.text();
  const { rating, rating_count } = extractRating(html);
  if (rating == null) return null;

  const slug = (() => {
    try {
      return new URL(res.url).pathname
        .replace(/^\/book\/show\//, "")
        .replace(/\/$/, "");
    } catch {
      return null;
    }
  })();

  return { goodreads_id: id, slug, rating, rating_count };
}

// --- Supabase ---------------------------------------------------------------

async function upsert(rows) {
  if (rows.length === 0) return;
  const res = await fetch(`${REST}/goodreads_ratings?on_conflict=goodreads_id`, {
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
    throw new Error(
      `Upsert failed: ${res.status} ${res.statusText} - ${detail}`,
    );
  }
}

// Every Goodreads id in our catalogue, paged to dodge PostgREST's default
// 1000-row ceiling.
async function catalogueIds() {
  const ids = new Set();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const url =
      `${REST}/media_entries?select=goodreads_link&media_type=eq.book` +
      `&goodreads_link=not.is.null&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`media_entries fetch failed: ${res.status}`);
    const rows = await res.json();
    rows.forEach((r) => {
      const id = goodreadsId(r.goodreads_link);
      if (id) ids.add(id);
    });
    if (rows.length < PAGE) break;
  }
  return ids;
}

// --- main -------------------------------------------------------------------

async function main() {
  const ids = [...(await catalogueIds())];
  console.log(`Refreshing ${ids.length} books.`);

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

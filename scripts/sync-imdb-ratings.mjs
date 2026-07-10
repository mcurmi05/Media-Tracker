// Daily sync of IMDb's public ratings dataset into the Supabase
// `imdb_ratings` table. Run by .github/workflows/sync-imdb-ratings.yml.
//
// Downloads title.ratings.tsv.gz (~7 MB, ~1.5M rows: tconst / averageRating /
// numVotes), streams + gunzips it line by line, and upserts in batches.
//
// Talks to PostgREST directly with fetch (no @supabase/supabase-js) so it has
// no WebSocket/realtime dependency and runs on any Node 18+. The service-role
// key is used, which bypasses RLS.

import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import readline from "node:readline";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATASET_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const BATCH_SIZE = 5000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const ENDPOINT = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/imdb_ratings`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ~320 batches per run means the odd dropped connection (ECONNRESET) is
// expected; retry with backoff instead of failing the whole sync.
async function upsert(rows, attempt = 1) {
  const MAX_ATTEMPTS = 4;
  try {
    const res = await fetch(`${ENDPOINT}?on_conflict=tconst`, {
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
      // Retry server-side hiccups; anything else (auth, schema) is fatal.
      if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
        throw new Error(`retryable: ${res.status}`);
      }
      throw new Error(
        `Upsert failed: ${res.status} ${res.statusText} - ${detail}`,
      );
    }
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS || String(err).includes("Upsert failed")) {
      throw err;
    }
    const backoff = 1000 * 2 ** (attempt - 1);
    console.warn(
      `  upsert attempt ${attempt} failed (${err.cause?.code || err.message}), retrying in ${backoff}ms`,
    );
    await wait(backoff);
    return upsert(rows, attempt + 1);
  }
}

async function main() {
  console.log("Downloading", DATASET_URL);
  const res = await fetch(DATASET_URL, {
    headers: { "User-Agent": "movie-library-ratings-sync/1.0" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const lines = readline.createInterface({
    input: Readable.fromWeb(res.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  const syncedAt = new Date().toISOString();
  let batch = [];
  let total = 0;
  let isHeader = true;

  async function flush() {
    if (batch.length === 0) return;
    await upsert(batch);
    total += batch.length;
    batch = [];
    if (total % 100000 < BATCH_SIZE) console.log(`  upserted ~${total} rows`);
  }

  for await (const line of lines) {
    if (isHeader) {
      isHeader = false; // skip the "tconst\taverageRating\tnumVotes" header
      continue;
    }
    const [tconst, averageRating, numVotes] = line.split("\t");
    if (!tconst) continue;
    const rating = parseFloat(averageRating);
    const votes = parseInt(numVotes, 10);
    if (Number.isNaN(rating)) continue;
    batch.push({
      tconst,
      rating,
      votes: Number.isNaN(votes) ? 0 : votes,
      updated_at: syncedAt,
    });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`Done. Upserted ${total} ratings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

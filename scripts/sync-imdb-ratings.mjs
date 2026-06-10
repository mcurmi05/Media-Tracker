// Daily sync of IMDb's public ratings dataset into the Supabase
// `imdb_ratings` table. Run by .github/workflows/sync-imdb-ratings.yml.
//
// Downloads title.ratings.tsv.gz (~7 MB, ~1.5M rows: tconst / averageRating /
// numVotes), streams + gunzips it line by line, and upserts in batches using
// the service-role key (which bypasses RLS).

import { createClient } from "@supabase/supabase-js";
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Downloading", DATASET_URL);
  const res = await fetch(DATASET_URL);
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
    const { error } = await supabase
      .from("imdb_ratings")
      .upsert(batch, { onConflict: "tconst" });
    if (error) throw error;
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

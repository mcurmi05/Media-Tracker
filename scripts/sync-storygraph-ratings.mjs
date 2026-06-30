import { chromium } from "playwright";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REST = `${String(SUPABASE_URL || "").replace(/\/$/, "")}/rest/v1`;
const CONCURRENCY = 2;
const PAGE_SIZE = 1000;
const STORYGRAPH_ORIGIN = "https://app.thestorygraph.com";

const supabaseHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function catalogue() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url =
      `${REST}/book_entries` +
      "?select=id,hardcover_id,isbn13,title,author,goodreads_id,storygraph_slug" +
      "&hardcover_id=not.is.null" +
      `&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, { headers: supabaseHeaders });
    if (!response.ok) {
      throw new Error(`book entries fetch failed ${response.status}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function persistSlug(entryId, slug) {
  const response = await fetch(
    `${REST}/book_entries?id=eq.${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ storygraph_slug: slug }),
    },
  );
  if (!response.ok) {
    throw new Error(`storygraph slug update failed ${response.status}`);
  }
}

async function resolveGoodreadsId(book) {
  if (book.goodreads_id || !book.isbn13) return book.goodreads_id || null;
  const response = await fetch(
    `https://openlibrary.org/isbn/${encodeURIComponent(book.isbn13)}.json`,
    { headers: { "User-Agent": "Movie-Library/1.0" } },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const value = data?.identifiers?.goodreads?.[0];
  if (!/^\d+$/.test(String(value || ""))) return null;
  const goodreadsId = Number(value);
  const update = await fetch(
    `${REST}/book_entries?id=eq.${encodeURIComponent(book.id)}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        goodreads_id: goodreadsId,
        goodreads_link: `https://www.goodreads.com/book/show/${goodreadsId}`,
      }),
    },
  );
  if (!update.ok) {
    throw new Error(`goodreads id update failed ${update.status}`);
  }
  return goodreadsId;
}

async function upsertRatings(rows) {
  if (!rows.length) return;
  const response = await fetch(
    `${REST}/storygraph_ratings?on_conflict=hardcover_id`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`storygraph upsert failed ${response.status} ${detail}`);
  }
}

function storygraphIdFromHref(href) {
  const match = String(href || "").match(/^\/books\/([0-9a-f-]{36})$/i);
  return match?.[1] || null;
}

async function resolveStorygraphId(page, book) {
  if (book.storygraph_slug) return book.storygraph_slug;
  const term = book.isbn13 || `${book.title || ""} ${book.author || ""}`;
  if (!term.trim()) return null;
  const url =
    `${STORYGRAPH_ORIGIN}/search?turbo_frame=search_results` +
    `&search_term=${encodeURIComponent(term.trim())}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const links = page.locator('a[href^="/books/"]');
  await links.first().waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
  const hrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href")).filter(Boolean),
  );
  const slug = hrefs.map(storygraphIdFromHref).find(Boolean) || null;
  if (slug) await persistSlug(book.id, slug);
  return slug;
}

async function scrapeRating(page, slug) {
  await page.goto(`${STORYGRAPH_ORIGIN}/books/${slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  const ratingNode = page.locator('[aria-label^="Book rating:"]').first();
  await ratingNode.waitFor({ state: "attached", timeout: 20000 });
  const label = await ratingNode.getAttribute("aria-label");
  const match = String(label || "").match(
    /book rating:\s*([\d.]+)\s*out of 5 stars based on\s*([\d,]+)\s*reviews/i,
  );
  if (!match) return null;
  return {
    slug,
    rating: Number(match[1]),
    rating_count: Number(match[2].replace(/,/g, "")),
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: false });
  } catch (error) {
    if (process.platform !== "darwin") throw error;
    return chromium.launch({ channel: "chrome", headless: false });
  }
}

async function main() {
  const spikeIndex = process.argv.indexOf("--spike-id");
  if (spikeIndex >= 0) {
    const slug = process.argv[spikeIndex + 1];
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      console.log(JSON.stringify(await scrapeRating(page, slug), null, 2));
    } finally {
      await browser.close();
    }
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("missing supabase url or service role key");
  }
  const books = await catalogue();
  console.log(`refreshing ${books.length} storygraph ratings`);
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
      "Chrome/124.0 Safari/537.36",
    locale: "en-US",
  });
  const pending = [];
  let cursor = 0;
  let synced = 0;
  let missed = 0;

  async function worker() {
    const page = await context.newPage();
    while (cursor < books.length) {
      const book = books[cursor++];
      try {
        await resolveGoodreadsId(book);
        const slug = await resolveStorygraphId(page, book);
        const rating = slug ? await scrapeRating(page, slug) : null;
        if (rating) {
          pending.push({
            hardcover_id: String(book.hardcover_id),
            ...rating,
            updated_at: new Date().toISOString(),
          });
          synced++;
        } else {
          missed++;
        }
      } catch (error) {
        missed++;
        console.warn(`${book.hardcover_id} ${error.message}`);
      }
      if (pending.length >= 100) {
        await upsertRatings(pending.splice(0, pending.length));
      }
      await sleep(500 + Math.floor(Math.random() * 500));
    }
    await page.close();
  }

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await upsertRatings(pending);
  } finally {
    await context.close();
    await browser.close();
  }
  console.log(`done synced ${synced} missed ${missed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

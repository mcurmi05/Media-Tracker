import { chromium } from "playwright";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HARDCOVER_TOKEN = process.env.HARDCOVER_API_TOKEN;
const REST = `${String(SUPABASE_URL || "").replace(/\/$/, "")}/rest/v1`;
const CONCURRENCY = 1;
const PAGE_SIZE = 1000;
const STORYGRAPH_ORIGIN = "https://app.thestorygraph.com";
const HARDCOVER_GRAPHQL = "https://api.hardcover.app/v1/graphql";
const HARDCOVER_DELAY_MS = 1100;
let nextHardcoverRequestAt = 0;

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
      "?select=id,hardcover_id,isbn13,title,author,release_year,goodreads_id,storygraph_slug" +
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

function normalizeIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryAuthor(value) {
  return normalizeIdentity(String(value || "").split(",")[0]).replace(
    /\s+/g,
    "",
  );
}

function baseTitle(value) {
  return String(value || "")
    .replace(/\s*\([^)]*#(?:\d|[ivxlcdm])[^)]*\)\s*$/i, "")
    .trim();
}

function contributorName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(contributorName).filter(Boolean).join(", ");
  }
  return (
    value.name ||
    value.author_name ||
    contributorName(value.author) ||
    contributorName(value.author_names) ||
    contributorName(value.contributors)
  );
}

function isbn13From(value) {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  for (const candidate of candidates) {
    const normalized = String(candidate).replace(/[^0-9X]/gi, "");
    if (/^\d{13}$/.test(normalized)) return normalized;
  }
  return null;
}

function parseHardcoverResults(search) {
  let results = search?.results;
  if (typeof results === "string") {
    try {
      results = JSON.parse(results);
    } catch {
      return [];
    }
  }
  if (Array.isArray(results?.hits)) {
    results = results.hits.map((hit) => hit?.document || hit).filter(Boolean);
  }
  if (!Array.isArray(results)) return [];
  const ids = Array.isArray(search?.ids) ? search.ids : [];
  return results.map((result, index) => ({
    hardcover_id: String(
      result.hardcover_id ?? result.book_id ?? result.id ?? ids[index] ?? "",
    ),
    title: result.title || "",
    author:
      contributorName(result.author_names) ||
      contributorName(result.cached_contributors) ||
      contributorName(result.contributions),
    release_year: Number(result.release_year) || null,
    isbn13:
      isbn13From(result.isbn13 || result.isbn_13 || result.isbns) ||
      isbn13From(result.default_physical_edition?.isbn_13),
  }));
}

async function hardcoverSearch(query) {
  const delay = Math.max(0, nextHardcoverRequestAt - Date.now());
  if (delay) await sleep(delay);
  nextHardcoverRequestAt = Date.now() + HARDCOVER_DELAY_MS;
  const authorization = /^Bearer\s/i.test(HARDCOVER_TOKEN)
    ? HARDCOVER_TOKEN
    : `Bearer ${HARDCOVER_TOKEN}`;
  const response = await fetch(HARDCOVER_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      "User-Agent": "Movie-Library/1.0",
    },
    body: JSON.stringify({
      query: `
        query SearchBooks($query: String!, $perPage: Int!, $page: Int!) {
          search(
            query: $query
            query_type: "Book"
            per_page: $perPage
            page: $page
          ) {
            ids
            results
          }
        }
      `,
      variables: { query, perPage: 25, page: 1 },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.errors?.length) {
    throw new Error(`hardcover search failed ${response.status}`);
  }
  return parseHardcoverResults(payload?.data?.search);
}

async function persistHardcoverMatch(entryId, match) {
  const response = await fetch(
    `${REST}/book_entries?id=eq.${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        hardcover_id: match.hardcover_id,
        ...(match.isbn13 ? { isbn13: match.isbn13 } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`hardcover match update failed ${response.status}`);
  }
}

async function resolveHardcoverBook(book) {
  if (book.hardcover_id) return book;
  const title = baseTitle(book.title);
  const author = String(book.author || "").trim();
  if (!title || !author) return null;
  const targetTitle = normalizeIdentity(title);
  const targetAuthor = primaryAuthor(author);
  const findMatches = (results) => results.filter((result) => {
    const resultTitle = normalizeIdentity(baseTitle(result.title));
    const resultAuthor = primaryAuthor(result.author);
    return (
      result.hardcover_id &&
      resultTitle === targetTitle &&
      resultAuthor &&
      resultAuthor === targetAuthor
    );
  });
  let matches = findMatches(await hardcoverSearch(title));
  if (!matches.length && /^the\s+/i.test(title)) {
    matches = findMatches(await hardcoverSearch(title.replace(/^the\s+/i, "")));
  }
  if (matches.length > 1 && book.release_year) {
    const targetYear = Number(book.release_year);
    const yearMatches = matches.filter(
      (match) =>
        match.release_year &&
        Math.abs(Number(match.release_year) - targetYear) <= 1,
    );
    if (yearMatches.length) matches = yearMatches;
  }
  const ids = [...new Set(matches.map((match) => match.hardcover_id))];
  if (ids.length !== 1) return null;
  const match = matches.find((result) => result.hardcover_id === ids[0]);
  await persistHardcoverMatch(book.id, match);
  return {
    ...book,
    hardcover_id: match.hardcover_id,
    isbn13: book.isbn13 || match.isbn13,
  };
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
  const titleAndAuthor =
    `${baseTitle(book.title)} ${book.author || ""}`.trim();
  const terms = [titleAndAuthor, book.isbn13].filter(Boolean);
  for (const term of terms) {
    const url =
      `${STORYGRAPH_ORIGIN}/search?turbo_frame=search_results` +
      `&search_term=${encodeURIComponent(term)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const links = page.locator('a[href^="/books/"]');
    await links
      .first()
      .waitFor({ state: "attached", timeout: 20000 })
      .catch(() => {});
    const candidates = await links.evaluateAll((nodes) =>
      nodes.map((node) => ({
        href: node.getAttribute("href"),
        label: node.querySelector("img")?.getAttribute("alt") || "",
      })),
    );
    const expectedLabel = normalizeIdentity(
      `${baseTitle(book.title)} by ${String(book.author || "").split(",")[0]}`,
    );
    const exact = candidates.find(
      (candidate) => normalizeIdentity(candidate.label) === expectedLabel,
    );
    const slug =
      storygraphIdFromHref(exact?.href) ||
      candidates.map((candidate) => storygraphIdFromHref(candidate.href)).find(Boolean) ||
      null;
    if (slug) {
      if (slug !== book.storygraph_slug) await persistSlug(book.id, slug);
      return slug;
    }
  }
  return book.storygraph_slug || null;
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
    /book rating:\s*([\d.]+)\s*out of 5 stars based on\s*([\d,]+)\s*reviews?/i,
  );
  if (!match) return null;
  return {
    slug,
    rating: Number(match[1]),
    rating_count: Number(match[2].replace(/,/g, "")),
  };
}

async function syncStorygraphBook(page, book, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const slug = await resolveStorygraphId(page, book);
      const rating = slug ? await scrapeRating(page, slug) : null;
      if (rating) return rating;
      lastError = new Error("storygraph rating not found");
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      await sleep(attempt * 1500 + Math.floor(Math.random() * 1000));
    }
  }
  throw lastError || new Error("storygraph sync failed");
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
  if (!HARDCOVER_TOKEN) {
    throw new Error("missing hardcover api token");
  }
  const entries = await catalogue();
  const books = [];
  let unresolved = 0;
  for (const entry of entries) {
    try {
      const book = await resolveHardcoverBook(entry);
      if (book) books.push(book);
      else unresolved++;
    } catch (error) {
      unresolved++;
      console.warn(`${entry.title} ${error.message}`);
    }
  }
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
        const rating = await syncStorygraphBook(page, book);
        pending.push({
          hardcover_id: String(book.hardcover_id),
          ...rating,
          updated_at: new Date().toISOString(),
        });
        synced++;
      } catch (error) {
        missed++;
        console.warn(`${book.hardcover_id} ${error.message}`);
      }
      if (pending.length >= 100) {
        await upsertRatings(pending.splice(0, pending.length));
      }
      await sleep(1000 + Math.floor(Math.random() * 1000));
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
  console.log(`done synced ${synced} missed ${missed} unresolved ${unresolved}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

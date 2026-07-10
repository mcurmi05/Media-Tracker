//server side hardcover graphql proxy
//
//request core stays independent of host request objects
//phase four can mount it without rewriting the transport

const HARDCOVER_GRAPHQL = "https://api.hardcover.app/v1/graphql";
const USER_AGENT = "Movie-Library/1.0 (Hardcover metadata proxy)";
const REQUEST_INTERVAL_MS = 1100;
const SEARCH_TTL_MS = 5 * 60 * 1000;
const BOOK_TTL_MS = 6 * 60 * 60 * 1000;
const responseCache = new Map();
const inflightRequests = new Map();
let requestQueue = Promise.resolve();
let nextRequestAt = 0;

const SEARCH_QUERY = `
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
`;

const BOOK_QUERY = `
  query BookById($id: Int!) {
    book: books_by_pk(id: $id) {
      id
      title
      slug
      description
      rating
      release_year
      cached_image
      cached_contributors
      default_physical_edition {
        isbn_13
        release_year
        cached_image
      }
      editions(limit: 25) {
        isbn_13
        release_year
      }
    }
  }
`;

const COVERS_QUERY = `
  query BookCovers($id: Int!) {
    book: books_by_pk(id: $id) {
      id
      cached_image
      editions(limit: 50) {
        id
        cached_image
      }
    }
  }
`;

function imageUrl(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return (
    value.url ||
    value.image_url ||
    value.src ||
    value.original ||
    value.large ||
    null
  );
}

function contributorName(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(contributorName).filter(Boolean).join(", ") || null;
  }
  return (
    value.name ||
    value.author_name ||
    value.author?.name ||
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

function parseSearchResults(search) {
  const raw = search?.results;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.hits)) {
    return parsed.hits.map((hit) => hit?.document || hit).filter(Boolean);
  }
  return [];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleRequest(operation) {
  const task = requestQueue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await wait(delay);
    nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
    return operation();
  });
  requestQueue = task.catch(() => undefined);
  return task;
}

async function cachedRequest(key, ttl, operation) {
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inflightRequests.has(key)) return inflightRequests.get(key);

  const request = operation()
    .then((value) => {
      if (responseCache.size >= 250) {
        responseCache.delete(responseCache.keys().next().value);
      }
      responseCache.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, request);
  return request;
}

async function resolveGoodreadsId(isbn13, fetchImpl) {
  if (!isbn13) return null;
  return cachedRequest(`goodreads:${isbn13}`, BOOK_TTL_MS, async () => {
    const response = await fetchImpl(
      `https://openlibrary.org/isbn/${encodeURIComponent(isbn13)}.json`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const value = data?.identifiers?.goodreads?.[0];
    return /^\d+$/.test(String(value || "")) ? Number(value) : null;
  });
}

export function normalizeHardcoverBook(raw, fallbackId = null) {
  if (!raw) return null;
  const defaultEdition = raw.default_physical_edition || raw.default_edition || null;
  const editions = Array.isArray(raw.editions) ? raw.editions : [];
  const isbn13 =
    isbn13From(raw.isbn13 || raw.isbn_13 || raw.isbns) ||
    isbn13From(defaultEdition?.isbn_13) ||
    isbn13From(editions.map((edition) => edition?.isbn_13));
  const hardcoverId = raw.hardcover_id ?? raw.book_id ?? raw.id ?? fallbackId;
  if (hardcoverId == null) return null;

  const releaseYear =
    Number(raw.release_year || defaultEdition?.release_year) ||
    Number(String(raw.release_date || "").slice(0, 4)) ||
    null;

  return {
    hardcover_id: String(hardcoverId),
    title: raw.title || "",
    author:
      contributorName(raw.author_names) ||
      contributorName(raw.cached_contributors) ||
      contributorName(raw.contributions) ||
      "",
    cover_image:
      imageUrl(raw.cover_image) ||
      imageUrl(raw.image) ||
      imageUrl(raw.cached_image) ||
      imageUrl(defaultEdition?.cached_image),
    release_year: releaseYear,
    isbn13,
    slug: raw.slug || null,
    description: raw.description || "",
    book_description: raw.description || "",
    rating: raw.rating == null ? null : Number(raw.rating),
    // Hardcover/Typesense reader count - cross-source prominence signal for
    // merged "All" search ranking.
    users_count: Number(raw.users_count) || 0,
    hardcover_url: raw.slug ? `https://hardcover.app/books/${raw.slug}` : null,
    goodreads_id: raw.goodreads_id ?? null,
    goodreads_link: raw.goodreads_link ?? null,
  };
}

async function hardcoverGraphql(query, variables, token, fetchImpl) {
  const authorization = /^Bearer\s/i.test(token)
    ? token
    : `Bearer ${token}`;
  const response = await scheduleRequest(() =>
    fetchImpl(HARDCOVER_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    }),
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Hardcover ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (payload?.errors?.length) {
    const error = new Error(payload.errors.map((item) => item.message).join("; "));
    error.status = 502;
    throw error;
  }
  return payload?.data || {};
}

export async function runHardcoverAction(
  query,
  {
    token = globalThis.process?.env?.HARDCOVER_API_TOKEN,
    fetchImpl = fetch,
  } = {},
) {
  if (!token) {
    return { status: 500, body: { error: "HARDCOVER_API_TOKEN is not configured" } };
  }

  const action = String(query?.action || "");
  if (action === "search") {
    const term = String(query?.query || "").trim();
    if (!term) return { status: 400, body: { error: "Missing query" } };
    const limit = Math.min(Math.max(Number(query?.limit) || 25, 1), 100);
    const data = await cachedRequest(
      `search:${term.toLowerCase()}:${limit}`,
      SEARCH_TTL_MS,
      () =>
        hardcoverGraphql(
          SEARCH_QUERY,
          { query: term, perPage: limit, page: 1 },
          token,
          fetchImpl,
        ),
    );
    const ids = data.search?.ids || [];
    const results = parseSearchResults(data.search)
      .map((book, index) => normalizeHardcoverBook(book, ids[index]))
      .filter(Boolean);
    return { status: 200, body: { results } };
  }

  if (action === "book") {
    const id = String(query?.id || "").trim();
    if (!/^\d+$/.test(id)) {
      return { status: 400, body: { error: "Missing or invalid id" } };
    }
    const data = await cachedRequest(
      `book:${id}`,
      BOOK_TTL_MS,
      () =>
        hardcoverGraphql(
          BOOK_QUERY,
          { id: Number(id) },
          token,
          fetchImpl,
        ),
    );
    const book = normalizeHardcoverBook(data.book, id);
    if (book?.isbn13) {
      book.goodreads_id = await resolveGoodreadsId(book.isbn13, fetchImpl);
      book.goodreads_link = book.goodreads_id
        ? `https://www.goodreads.com/book/show/${book.goodreads_id}`
        : null;
    }
    return book
      ? { status: 200, body: book }
      : { status: 404, body: { error: "Book not found" } };
  }

  if (action === "covers") {
    const id = String(query?.id || "").trim();
    if (!/^\d+$/.test(id)) {
      return { status: 400, body: { error: "Missing or invalid id" } };
    }
    const data = await cachedRequest(
      `covers:${id}`,
      BOOK_TTL_MS,
      () => hardcoverGraphql(COVERS_QUERY, { id: Number(id) }, token, fetchImpl),
    );
    const book = data.book;
    const seen = new Set();
    const results = [];
    const push = (img) => {
      const url = imageUrl(img);
      if (url && !seen.has(url)) {
        seen.add(url);
        results.push({ full: url, thumb: url });
      }
    };
    // The book's own cover first (the default), then each edition's.
    push(book?.cached_image);
    (book?.editions || []).forEach((edition) => push(edition?.cached_image));
    return { status: 200, body: { results } };
  }

  return { status: 400, body: { error: "Unsupported action" } };
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await runHardcoverAction(req.query || {});
    if (req.query?.action === "book") {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=21600, stale-while-revalidate=86400",
      );
    } else if (req.query?.action === "search") {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=3600",
      );
    }
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.message });
  }
}

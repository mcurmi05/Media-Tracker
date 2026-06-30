// Vercel serverless function: fetches a Goodreads book page and extracts
// title (with series suffix when applicable), author, cover image, and release year.

export default async function handler(req, res) {
  const url = req.query?.url || (req.url && new URL(req.url, "http://x").searchParams.get("url"));

  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!/(^|\.)goodreads\.com$/i.test(parsed.hostname)) {
    return res.status(400).json({ error: "URL must be a goodreads.com link" });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: `Goodreads returned ${response.status}` });
    }

    const html = await response.text();
    const data = parseGoodreadsHtml(html);

    if (!data.title && !data.cover_image) {
      return res
        .status(502)
        .json({ error: "Could not extract book details from page" });
    }

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to fetch Goodreads page", details: err?.message });
  }
}

function parseGoodreadsHtml(html) {
  const ogTitle = matchMeta(html, "og:title");
  const ogImage = matchMeta(html, "og:image");
  const booksAuthorMeta = matchMeta(html, "books:author");

  const jsonLd = extractJsonLd(html);
  const nextBook = extractNextDataBook(html);

  let title = null;
  let author = null;
  let cover_image = null;
  let release_year = null;

  // Title: prefer the Apollo "titleComplete" (already includes "(Series, #N)"), then JSON-LD name, then og:title.
  title =
    nextBook?.titleComplete ||
    nextBook?.title ||
    (jsonLd?.name && String(jsonLd.name)) ||
    ogTitle ||
    null;

  // If Apollo gave us a bare title with separate series info, append it.
  if (nextBook && !/\(.+#\d/.test(title || "") && nextBook.bookSeries?.length) {
    const series = nextBook.bookSeries[0];
    const seriesName = series?.series?.title;
    const placement = series?.userPosition || series?.seriesPlacement;
    if (seriesName && placement) {
      title = `${title} (${seriesName} #${placement})`;
    }
  }

  title = normalizeTitleSeries(title);

  // Author
  if (jsonLd?.author) {
    const a = jsonLd.author;
    if (Array.isArray(a)) {
      author = a.map((x) => x?.name || x).filter(Boolean).join(", ");
    } else {
      author = a.name || (typeof a === "string" ? a : null);
    }
  }
  if (!author && booksAuthorMeta) {
    author = booksAuthorMeta;
  }
  if (!author) {
    // last resort: try to scrape the visible byline
    const m = html.match(/data-testid=["']name["'][^>]*>([^<]+)</i);
    if (m) author = decodeHtml(m[1]).trim();
  }

  // Cover
  cover_image = (jsonLd?.image && String(jsonLd.image)) || ogImage || null;

  // Description: prefer the Apollo book description, then JSON-LD, then the
  // visible description block, then the og:description meta as a last resort.
  let description = null;
  if (nextBook?.description) {
    description = stripTags(String(nextBook.description));
  }
  if (!description && jsonLd?.description) {
    description = stripTags(String(jsonLd.description));
  }
  if (!description) {
    const m = html.match(
      /data-testid=["']description["'][\s\S]{0,400}?<span[^>]*class=["'][^"']*Formatted[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    if (m) description = stripTags(m[1]);
  }
  if (!description) {
    description = matchMeta(html, "og:description") || null;
  }

  // Rating + ratings count: prefer the Work stats from Apollo, then JSON-LD's
  // aggregateRating, then a regex scrape of the visible rating widget.
  let rating = null;
  let ratings_count = null;
  const workStats = nextBook?._work?.stats;
  if (workStats) {
    if (typeof workStats.averageRating === "number") {
      rating = workStats.averageRating;
    }
    if (typeof workStats.ratingsCount === "number") {
      ratings_count = workStats.ratingsCount;
    }
  }
  if ((rating == null || ratings_count == null) && jsonLd?.aggregateRating) {
    const ar = jsonLd.aggregateRating;
    if (rating == null && ar.ratingValue != null) {
      const v = Number(ar.ratingValue);
      if (!Number.isNaN(v)) rating = v;
    }
    if (ratings_count == null && ar.ratingCount != null) {
      const c = Number(ar.ratingCount);
      if (!Number.isNaN(c)) ratings_count = c;
    }
  }
  if (rating == null) {
    const m = html.match(/RatingStatistics__rating[^>]*>\s*([\d.]+)/i);
    if (m) rating = parseFloat(m[1]);
  }
  if (ratings_count == null) {
    const m = html.match(/([\d,]+)\s*ratings?/i);
    if (m) {
      const c = parseInt(m[1].replace(/,/g, ""), 10);
      if (!Number.isNaN(c)) ratings_count = c;
    }
  }
  if (typeof rating === "number") {
    rating = Math.round(rating * 100) / 100;
  }

  // Release year: prefer the Work's first-publication time, then the
  // "First published ... YYYY" text on the page, then edition-level data.
  const workPubTime = nextBook?._work?.details?.publicationTime;
  if (typeof workPubTime === "number") {
    const year = new Date(workPubTime).getUTCFullYear();
    if (!Number.isNaN(year)) release_year = year;
  }
  if (!release_year) {
    const m = html.match(/[Ff]irst published[^<]{0,80}?(\d{4})/);
    if (m) release_year = parseInt(m[1], 10);
  }
  if (!release_year) {
    const dateRaw =
      jsonLd?.datePublished ||
      nextBook?.details?.publicationTime ||
      nextBook?.details?.publishDate ||
      null;
    if (dateRaw) {
      if (typeof dateRaw === "number") {
        const year = new Date(dateRaw).getUTCFullYear();
        if (!Number.isNaN(year)) release_year = year;
      } else {
        const m = String(dateRaw).match(/(\d{4})/);
        if (m) release_year = parseInt(m[1], 10);
      }
    }
  }

  return {
    title,
    author,
    cover_image,
    release_year,
    description,
    rating,
    ratings_count,
  };
}

function stripTags(s) {
  return decodeHtml(
    String(s)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function matchMeta(html, property) {
  const propEsc = escapeRegex(property);
  const re1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${propEsc}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m1 = html.match(re1);
  if (m1) return decodeHtml(m1[1]);
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${propEsc}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2 ? decodeHtml(m2[1]) : null;
}

function extractJsonLd(html) {
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        const t = c?.["@type"];
        if (t === "Book" || (Array.isArray(t) && t.includes("Book"))) {
          return c;
        }
      }
    } catch {
      // ignore parse errors and continue
    }
  }
  return null;
}

function extractNextDataBook(html) {
  const m = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return null;
  let nextData;
  try {
    nextData = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const apollo = nextData?.props?.pageProps?.apolloState;
  if (!apollo || typeof apollo !== "object") return null;

  // Resolve the main book entry. Find the Book entry with the most filled-in fields.
  const bookEntries = Object.entries(apollo).filter(
    ([k, v]) => k.startsWith("Book:") && v && typeof v === "object",
  );
  if (bookEntries.length === 0) return null;

  // Pick the entry with a titleComplete or the one with the longest title string
  let best = null;
  let bestScore = -1;
  for (const [, v] of bookEntries) {
    const score =
      (v.titleComplete ? 100 : 0) +
      (v.title ? String(v.title).length : 0) +
      (v.bookSeries?.length ? 10 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  if (!best) return null;

  // Resolve series refs to actual series names.
  if (Array.isArray(best.bookSeries)) {
    best.bookSeries = best.bookSeries.map((bs) => {
      const ref = bs?.series?.__ref;
      if (ref && apollo[ref]) {
        return { ...bs, series: { ...apollo[ref], ...bs.series } };
      }
      return bs;
    });
  }

  // Work entry holds first-publication info and aggregate rating stats,
  // separate from the edition shown.
  const workRef = best.work?.__ref;
  if (workRef && apollo[workRef]) {
    const work = { ...apollo[workRef] };
    const statsRef = work.stats?.__ref;
    if (statsRef && apollo[statsRef]) {
      work.stats = apollo[statsRef];
    }
    best._work = work;
  }

  return best;
}

function normalizeTitleSeries(title) {
  if (!title) return null;
  // "Title (Series, #N)" -> "Title (Series #N)"
  return title.replace(
    /\(([^()]+?),\s*#(\d+(?:\.\d+)?)\)/,
    "($1 #$2)",
  );
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

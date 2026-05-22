// Vercel serverless function: server-side proxy for the IMDB (imdb236) API.
// The RapidAPI key is read from process.env and never reaches the browser;
// the client only ever calls /api/imdb?action=...
//
// Supported actions:
//   ?action=popular-movies
//   ?action=popular-tv
//   ?action=search&query=<text>&rows=<1-100>
//   ?action=title&id=<imdb id>

const RAPIDAPI_HOST = "imdb236.p.rapidapi.com";
const BASE = `https://${RAPIDAPI_HOST}/api/imdb`;

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.IMDB_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "IMDB_API_KEY is not configured" });
  }

  const q = req.query || {};
  const action = q.action;
  let target;

  if (action === "popular-movies") {
    target = `${BASE}/most-popular-movies`;
  } else if (action === "popular-tv") {
    target = `${BASE}/most-popular-tv`;
  } else if (action === "search") {
    const query = String(q.query || "").trim();
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter" });
    }
    let rows = parseInt(q.rows, 10);
    if (Number.isNaN(rows)) rows = 100;
    rows = Math.min(Math.max(rows, 1), 100);
    const params = new URLSearchParams({
      primaryTitleAutocomplete: query,
      rows: String(rows),
      sortOrder: "DESC",
      sortField: "numVotes",
    });
    target = `${BASE}/search?${params}`;
  } else if (action === "title") {
    // `id` is interpolated into the URL path, so restrict it to plain
    // alphanumerics: no slashes or dots that could escape the endpoint.
    const id = String(q.id || "").trim();
    if (!/^[a-zA-Z0-9]+$/.test(id)) {
      return res.status(400).json({ error: "Invalid IMDB id" });
    }
    target = `${BASE}/${id}`;
  } else {
    return res.status(400).json({ error: "Unknown or missing action" });
  }

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    let data;
    try {
      data = await upstream.json();
    } catch {
      return res
        .status(502)
        .json({ error: "IMDB API returned a non-JSON response" });
    }

    if (action === "popular-movies" || action === "popular-tv") {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400",
      );
    }
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Failed to reach the IMDB API", details: err?.message });
  }
}

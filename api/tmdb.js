// Vercel serverless function: server-side proxy for The Movie Database (TMDB).
// The TMDB key is read from process.env and never reaches the browser; the
// client only ever calls /api/tmdb?action=...
//
// Supported actions:
//   ?action=trending-movies
//   ?action=trending-tv
//   ?action=search&query=<text>
//   ?action=title&mediaType=<movie|tv>&tmdbId=<id>
//   ?action=find&imdbId=<tconst>      -> { tmdb_id, media_type } (or null)

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

// How many pages of search results to pull (TMDB returns ~20 per page).
const MAX_SEARCH_PAGES = 5;

// In-memory genre map: { movieGenres: Map<id,name>, tvGenres: Map<id,name> }
// Populated once per cold start; Vercel functions stay warm for ~minutes.
let genreCache = null;

async function getGenreMaps(key) {
  if (genreCache) return genreCache;
  const [movieData, tvData] = await Promise.all([
    tmdbFetch("/genre/movie/list", {}, key).catch(() => ({ genres: [] })),
    tmdbFetch("/genre/tv/list", {}, key).catch(() => ({ genres: [] })),
  ]);
  const movieGenres = new Map((movieData.genres || []).map((g) => [g.id, g.name]));
  const tvGenres   = new Map((tvData.genres   || []).map((g) => [g.id, g.name]));
  genreCache = { movieGenres, tvGenres };
  return genreCache;
}

function authFor(key) {
  const isJwt = key.split(".").length === 3;
  return isJwt
    ? { headers: { Authorization: `Bearer ${key}` }, keyParam: null }
    : { headers: {}, keyParam: key };
}

async function tmdbFetch(path, params, key) {
  const { headers, keyParam } = authFor(key);
  const sp = new URLSearchParams(params || {});
  if (keyParam) sp.set("api_key", keyParam);
  const url = `${TMDB_BASE}${path}?${sp.toString()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = new Error(`TMDB ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Fetch the first N pages of a paginated endpoint in parallel and flatten
// results (TMDB returns ~20 per page; 5 pages is the "Top 100").
async function tmdbPages(path, pages, key) {
  const reqs = [];
  for (let p = 1; p <= pages; p++) {
    reqs.push(tmdbFetch(path, { page: String(p) }, key));
  }
  const datas = await Promise.all(reqs);
  return datas.flatMap((d) => d.results || []);
}

const posterUrl = (path, size = "w500") => (path ? `${IMG_BASE}/${size}${path}` : null);
const yearOf = (dateStr) =>
  dateStr ? Number(String(dateStr).slice(0, 4)) || null : null;

function trailerUrl(videos) {
  const list = videos?.results || [];
  const pick =
    list.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    list.find((v) => v.site === "YouTube");
  return pick ? `https://www.youtube.com/watch?v=${pick.key}` : null;
}

// A single season's full detail (from /tv/{id}/season/{n}) -> compact shape.
function mapSeasonDetail(s) {
  if (!s) return null;
  return {
    season_number: s.season_number,
    name: s.name || `Season ${s.season_number}`,
    episode_count: s.episodes?.length ?? s.episode_count ?? 0,
    poster: posterUrl(s.poster_path, "w342"),
    air_date: s.air_date || null,
    overview: s.overview || "",
    episodes: (s.episodes || []).map((ep) => ({
      episode_number: ep.episode_number,
      name: ep.name,
      still: posterUrl(ep.still_path, "w300"),
      overview: ep.overview || "",
      air_date: ep.air_date || null,
      runtime: ep.runtime ?? null,
      vote_average: ep.vote_average ?? null,
    })),
  };
}

// A trending/search list item -> minimal movie_object (no tconst at browse).
// genreMap is optional: a Map<id,name> for the relevant media type.
function mapListItem(item, mediaType, genreMap) {
  const mt = mediaType || item.media_type;
  if (mt !== "movie" && mt !== "tv") return null;
  const isTV = mt === "tv";
  const interests = genreMap
    ? (item.genre_ids || []).map((id) => genreMap.get(id)).filter(Boolean)
    : [];
  return {
    tmdb_id: item.id,
    media_type: mt,
    id: null,
    primaryTitle: item.title || item.name,
    primaryImage: posterUrl(item.poster_path),
    backdropImage: posterUrl(item.backdrop_path, "w780"),
    backdropImageHD: null,
    startYear: yearOf(item.release_date || item.first_air_date),
    endYear: null,
    type: isTV ? "tvSeries" : "movie",
    titleType: isTV ? "tvSeries" : "movie",
    episodes: isTV ? true : undefined,
    runtimeMinutes: null,
    averageRating: item.vote_average ?? null,
    numVotes: item.vote_count ?? null,
    url: null,
    description: item.overview || "",
    trailer: null,
    budget: null,
    interests,
    cast: [],
    creators: [],
    directors: [],
    writers: [],
    seasons: [],
  };
}

// A full detail response -> complete movie_object shape.
// TV shows use aggregate_credits (all roles across all seasons) for a richer
// cast list; movies use credits as before.
function mapDetail(d, mediaType, seasonDetails) {
  const isTV = mediaType === "tv";
  const imdbId = d.external_ids?.imdb_id || null;
  const crew = d.credits?.crew || [];

  // TV: aggregate_credits gives every actor who appeared across all episodes.
  // Each entry has .roles[] with .character; we pick the primary role.
  const cast = isTV
    ? (d.aggregate_credits?.cast || []).slice(0, 50).map((c) => ({
        fullName: c.name,
        job: "actor",
        primaryImage: posterUrl(c.profile_path, "w185"),
        characters: c.roles?.[0]?.character ? [c.roles[0].character] : [],
      }))
    : (d.credits?.cast || []).map((c) => ({
        fullName: c.name,
        job: "actor",
        primaryImage: posterUrl(c.profile_path, "w185"),
        characters: c.character ? [c.character] : [],
      }));

  // TV: creators from created_by array
  const creators = isTV
    ? (d.created_by || []).map((c) => ({ fullName: c.name }))
    : [];

  return {
    tmdb_id: d.id,
    media_type: mediaType,
    id: imdbId,
    primaryTitle: d.title || d.name,
    primaryImage: posterUrl(d.poster_path, "w500"),
    backdropImage: posterUrl(d.backdrop_path, "w780"),
    backdropImageHD: posterUrl(d.backdrop_path, "w1280"),
    startYear: yearOf(d.release_date || d.first_air_date),
    endYear: isTV ? yearOf(d.last_air_date) : null,
    type: isTV ? "tvSeries" : "movie",
    titleType: isTV ? "tvSeries" : "movie",
    episodes: isTV ? d.number_of_episodes || true : undefined,
    runtimeMinutes: isTV
      ? Array.isArray(d.episode_run_time)
        ? d.episode_run_time[0] ?? null
        : null
      : d.runtime ?? null,
    averageRating: d.vote_average ?? null,
    numVotes: d.vote_count ?? null,
    url: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
    description: d.overview || "",
    trailer: trailerUrl(d.videos),
    budget: isTV ? null : d.budget ?? null,
    interests: (d.genres || []).map((g) => g.name).filter(Boolean),
    cast,
    creators,
    directors: crew
      .filter((c) => c.job === "Director")
      .map((c) => ({ fullName: c.name })),
    writers: crew
      .filter((c) => c.department === "Writing")
      .map((c) => ({ fullName: c.name })),
    // Seasons only present for TV; seasonDetails is an array of mapSeasonDetail results.
    seasons: isTV ? (seasonDetails || []).filter(Boolean) : [],
  };
}

// --- Fuzzy search ranking ------------------------------------------------
// TMDB's search has limited typo tolerance and its default ordering buries
// good matches behind popular near-misses. We pull several pages, merge the
// per-type endpoints (which are more lenient than /search/multi), then
// re-rank everything client-of-TMDB-side by similarity to the typed query.

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein edit distance (iterative, single-row) for short strings.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      prev = tmp;
    }
  }
  return dp[n];
}

// 0..1 similarity (1 = identical) based on edit distance.
function simRatio(a, b) {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Higher score = better match for the typed query. Combines whole-string
// similarity, substring/prefix bonuses, fuzzy token overlap, and a small
// popularity tiebreak so the well-known title wins among equally-good matches.
function relevanceScore(item, qNorm) {
  const title = normalize(item.title || item.name);
  if (!title || !qNorm) return 0;

  const full = simRatio(qNorm, title);
  const prefix = simRatio(qNorm, title.slice(0, qNorm.length));
  const substr = title.includes(qNorm) ? 0.3 : 0;

  const qTokens = qNorm.split(" ").filter(Boolean);
  const tTokens = title.split(" ").filter(Boolean);
  let tokenHits = 0;
  for (const qt of qTokens) {
    if (tTokens.includes(qt)) {
      tokenHits += 1;
    } else if (tTokens.some((tt) => simRatio(qt, tt) >= 0.8)) {
      tokenHits += 0.7;
    }
  }
  const tokenScore = qTokens.length ? (tokenHits / qTokens.length) * 0.4 : 0;

  // log-scaled popularity, kept small so it only breaks near-ties.
  const pop = Math.log10((item.popularity || 0) + 1) / 12;

  return Math.max(full, prefix) + substr + tokenScore + pop;
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "TMDB_API_KEY is not configured" });
  }

  const q = req.query || {};
  const action = q.action;

  try {
    if (action === "trending-movies" || action === "trending-tv") {
      const mt = action === "trending-tv" ? "tv" : "movie";
      const [results, { movieGenres, tvGenres }] = await Promise.all([
        tmdbPages(`/trending/${mt}/week`, 5, key),
        getGenreMaps(key),
      ]);
      const genreMap = mt === "tv" ? tvGenres : movieGenres;
      const items = results.map((it) => mapListItem(it, mt, genreMap)).filter(Boolean);
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400",
      );
      return res.status(200).json(items);
    }

    if (action === "search") {
      const query = String(q.query || "").trim();
      if (!query) return res.status(400).json({ error: "Missing query" });

      const common = { query, include_adult: "false" };

      // Kick off the first multi page (tells us total_pages) alongside the
      // per-type searches — /search/movie and /search/tv are more typo-
      // tolerant than /search/multi, so merging them improves recall for
      // badly misspelled queries.
      const [multi1, movie1, tv1] = await Promise.all([
        tmdbFetch("/search/multi", { ...common, page: "1" }, key),
        tmdbFetch("/search/movie", { ...common, page: "1" }, key).catch(() => ({
          results: [],
        })),
        tmdbFetch("/search/tv", { ...common, page: "1" }, key).catch(() => ({
          results: [],
        })),
      ]);

      // Pull the remaining multi pages (capped) for a deeper result set.
      const totalPages = Math.min(multi1.total_pages || 1, MAX_SEARCH_PAGES);
      const morePageReqs = [];
      for (let p = 2; p <= totalPages; p++) {
        morePageReqs.push(
          tmdbFetch("/search/multi", { ...common, page: String(p) }, key)
            .then((d) => d.results || [])
            .catch(() => []),
        );
      }
      const moreMulti = (await Promise.all(morePageReqs)).flat();

      // Tag every raw item with its media_type, keep only movie/tv, dedupe.
      const tagged = [
        ...(multi1.results || []).map((it) => ({ it, mt: it.media_type })),
        ...moreMulti.map((it) => ({ it, mt: it.media_type })),
        ...(movie1.results || []).map((it) => ({ it, mt: "movie" })),
        ...(tv1.results || []).map((it) => ({ it, mt: "tv" })),
      ].filter(({ mt }) => mt === "movie" || mt === "tv");

      const seen = new Set();
      const deduped = [];
      for (const entry of tagged) {
        const k = `${entry.mt}:${entry.it.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(entry);
      }

      // Re-rank by fuzzy similarity to the typed query so the intended title
      // surfaces even when misspelled or buried.
      const qNorm = normalize(query);
      deduped.sort(
        (a, b) => relevanceScore(b.it, qNorm) - relevanceScore(a.it, qNorm),
      );

      const items = deduped
        .map(({ it, mt }) => mapListItem(it, mt))
        .filter(Boolean);
      return res.status(200).json({ results: items });
    }

    if (action === "title") {
      const mediaType = q.mediaType === "tv" ? "tv" : "movie";
      const tmdbId = String(q.tmdbId || "").trim();
      if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).json({ error: "Invalid tmdbId" });
      }

      // TV uses aggregate_credits for a full series cast list
      const appendTo = mediaType === "tv"
        ? "aggregate_credits,external_ids,videos"
        : "credits,external_ids,videos";

      const data = await tmdbFetch(
        `/${mediaType}/${tmdbId}`,
        { append_to_response: appendTo },
        key,
      );

      let seasonDetails = [];
      if (mediaType === "tv" && Array.isArray(data.seasons)) {
        // Fetch each season (skip season 0 = specials) in parallel, capped at 15
        const toFetch = data.seasons
          .filter((s) => s.season_number > 0)
          .slice(0, 15);
        const fetches = toFetch.map((s) =>
          tmdbFetch(`/tv/${tmdbId}/season/${s.season_number}`, {}, key)
            .then(mapSeasonDetail)
            .catch(() => null),
        );
        seasonDetails = await Promise.all(fetches);
      }

      return res.status(200).json(mapDetail(data, mediaType, seasonDetails));
    }

    if (action === "find") {
      const imdbId = String(q.imdbId || "").trim();
      if (!/^tt\d+$/.test(imdbId)) {
        return res.status(400).json({ error: "Invalid imdbId" });
      }
      const data = await tmdbFetch(
        `/find/${imdbId}`,
        { external_source: "imdb_id" },
        key,
      );
      const movie = (data.movie_results || [])[0];
      const tv = (data.tv_results || [])[0];
      if (movie) return res.status(200).json({ tmdb_id: movie.id, media_type: "movie" });
      if (tv) return res.status(200).json({ tmdb_id: tv.id, media_type: "tv" });
      return res.status(200).json(null);
    }

    return res.status(400).json({ error: "Unknown or missing action" });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({ error: "Failed to reach TMDB", details: err?.message });
  }
}

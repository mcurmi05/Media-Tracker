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
      const data = await tmdbFetch(
        "/search/multi",
        { query, include_adult: "false" },
        key,
      );
      const items = (data.results || [])
        .map((it) => mapListItem(it, null))
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

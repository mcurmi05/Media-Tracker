// Vercel serverless function: server-side proxy for The Movie Database (TMDB).
// The TMDB key is read from process.env and never reaches the browser; the
// client only ever calls /api/tmdb?action=...
//
// Supported actions:
//   ?action=trending-movies
//   ?action=trending-tv
//   ?action=search&query=<text>
//   ?action=title&mediaType=<movie|tv>&tmdbId=<id>
//   ?action=images&mediaType=<movie|tv>&tmdbId=<id> -> [{ thumb, full }]
//   ?action=find&imdbId=<tconst>      -> { tmdb_id, media_type } (or null)

import POPULAR_TITLES from "./_data/popularTitles.js";

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

// Attach IMDb ids (tconst) to mapped list items by querying each title's
// external_ids. The imdb_ratings dataset is keyed by tconst, so this lets the
// trending list show live IMDb ratings and sort/filter by them. Runs behind the
// endpoint's 1h cache, and any per-title failure just leaves id/url null.
async function attachImdbIds(items, key) {
  const resolve = async (it) => {
    try {
      const ext = await tmdbFetch(
        `/${it.media_type}/${it.tmdb_id}/external_ids`,
        {},
        key,
      );
      if (ext?.imdb_id) {
        it.id = ext.imdb_id;
        it.url = `https://www.imdb.com/title/${ext.imdb_id}/`;
      }
    } catch {
      // leave id/url as null
    }
  };
  // Resolve in capped-size batches to stay under TMDB's rate limit.
  const BATCH = 25;
  for (let i = 0; i < items.length; i += BATCH) {
    await Promise.all(items.slice(i, i + BATCH).map(resolve));
  }
  return items;
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
    releaseDate: item.release_date || item.first_air_date || null,
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

// A person search hit -> compact person shape. known_for lists a few of their
// notable titles so the search row can hint at who they are.
function mapPersonListItem(p) {
  return {
    person_id: p.id,
    name: p.name,
    title: p.name, // lets the shared relevance ranker score people by name
    profile: posterUrl(p.profile_path, "w185"),
    department: p.known_for_department || null,
    known_for: (p.known_for || [])
      .map((k) => k.title || k.name)
      .filter(Boolean)
      .slice(0, 3),
  };
}

// One entry from a person's combined_credits -> minimal title card, tagged
// with the role that connects the person to the title (character or crew job).
function mapCredit(c) {
  const mt = c.media_type;
  if (mt !== "movie" && mt !== "tv") return null;
  const isTV = mt === "tv";
  return {
    tmdb_id: c.id,
    media_type: mt,
    primaryTitle: c.title || c.name,
    primaryImage: posterUrl(c.poster_path),
    startYear: yearOf(c.release_date || c.first_air_date),
    role: c.character || c.job || null,
    popularity: c.popularity || 0,
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
        person_id: c.id,
        fullName: c.name,
        job: "actor",
        primaryImage: posterUrl(c.profile_path, "w185"),
        characters: c.roles?.[0]?.character ? [c.roles[0].character] : [],
      }))
    : (d.credits?.cast || []).map((c) => ({
        person_id: c.id,
        fullName: c.name,
        job: "actor",
        primaryImage: posterUrl(c.profile_path, "w185"),
        characters: c.character ? [c.character] : [],
      }));

  // TV: creators from created_by array
  const creators = isTV
    ? (d.created_by || []).map((c) => ({ person_id: c.id, fullName: c.name }))
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
    releaseDate: d.release_date || d.first_air_date || null,
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
      .map((c) => ({ person_id: c.id, fullName: c.name })),
    writers: crew
      .filter((c) => c.department === "Writing")
      .map((c) => ({ person_id: c.id, fullName: c.name })),
    // Seasons only present for TV; seasonDetails is an array of mapSeasonDetail results.
    seasons: isTV ? (seasonDetails || []).filter(Boolean) : [],
  };
}

// --- Fuzzy search ranking ------------------------------------------------
// TMDB's search has limited typo tolerance and its default ordering buries
// good matches behind popular near-misses. Two-part fix, IMDb/Letterboxd
// style:
//   1. Candidate generation: pull several pages, merge the per-type
//      endpoints, and - when the pool looks weak for the typed query - fire
//      recovery variants (drop a word, trim trailing chars) so misspelled or
//      over-specified queries still surface candidates at all.
//   2. Ranking: re-rank every candidate by fuzzy similarity to the typed
//      query (Damerau edit distance, token alignment, prefix/substring
//      bonuses) with a small popularity tiebreak.

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Damerau-Levenshtein (optimal string alignment): like Levenshtein but a
// transposition of adjacent chars ("teh" -> "the") costs 1 edit, matching how
// people actually mistype.
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  // Three rolling rows: two-back, previous, current.
  let prev2 = null;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      }
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

// 0..1 similarity (1 = identical) based on edit distance.
function simRatio(a, b) {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - editDistance(a, b) / maxLen;
}

// Score one title string against the query. Combines whole-string similarity,
// prefix/substring bonuses and order-insensitive fuzzy token alignment (so
// "knight dark" or "the batman dark knight" still land on The Dark Knight).
function scoreTitle(qNorm, title) {
  if (!title || !qNorm) return 0;

  const full = simRatio(qNorm, title);
  const prefix = simRatio(qNorm, title.slice(0, qNorm.length));
  const substr = title.includes(qNorm) ? 0.3 : 0;

  const qTokens = qNorm.split(" ").filter(Boolean);
  const tTokens = title.split(" ").filter(Boolean);
  let tokenHits = 0;
  let titleTokensMatched = 0;
  for (const qt of qTokens) {
    if (tTokens.includes(qt)) {
      tokenHits += 1;
      titleTokensMatched += 1;
    } else {
      let best = 0;
      for (const tt of tTokens) {
        const s = simRatio(qt, tt);
        if (s > best) best = s;
      }
      if (best >= 0.75) {
        tokenHits += best * 0.85;
        titleTokensMatched += 1;
      }
    }
  }
  const tokenScore = qTokens.length ? (tokenHits / qTokens.length) * 0.45 : 0;
  // Among titles matching the same query tokens, prefer the one with fewer
  // leftover words ("dark knight" -> The Dark Knight, not ... Rises).
  const coverage = tTokens.length
    ? (Math.min(titleTokensMatched, tTokens.length) / tTokens.length) * 0.1
    : 0;

  // Whole-string similarity on alphabetically sorted tokens: order-
  // insensitive, so "knight dark" still lands on The Dark Knight.
  const sortedFull =
    qTokens.length > 1
      ? simRatio(
          qTokens.slice().sort().join(" "),
          tTokens.slice().sort().join(" "),
        ) * 0.95
      : 0;

  return Math.max(full, prefix, sortedFull) + substr + tokenScore + coverage;
}

// Best raw title similarity for an item, checked against the display title
// AND the original-language title (helps foreign titles searched either way).
function bestTitleSim(item, qNorm) {
  const titles = [
    item.title,
    item.name,
    item.original_title,
    item.original_name,
  ];
  let best = 0;
  for (const t of titles) {
    const tn = normalize(t);
    if (!tn) continue;
    const s = Math.max(
      simRatio(qNorm, tn),
      simRatio(qNorm, tn.slice(0, qNorm.length)),
    );
    if (s > best) best = s;
  }
  return best;
}

// Higher score = better match for the typed query. Popularity is log-scaled
// and small so it only breaks near-ties in favor of the well-known title.
function relevanceScore(item, qNorm) {
  const titles = [
    item.title,
    item.name,
    item.original_title,
    item.original_name,
  ];
  let best = 0;
  for (const t of titles) {
    const s = scoreTitle(qNorm, normalize(t));
    if (s > best) best = s;
  }
  if (!best) return 0;
  const pop = Math.log10((item.popularity || 0) + 1) / 12;
  return best + pop;
}

// If the initial candidate pool has no strong title match, the query itself
// is probably misspelled or over-specified; below this similarity we fire
// recovery variant queries to widen the pool. High on purpose: a near-miss
// pool ("intrastellar" -> only Interstellar Pig, sim ~0.83) still means the
// intended title is probably missing, and recovery is a no-op cost when the
// wider pool adds nothing better.
const RECOVERY_SIM_THRESHOLD = 0.88;

// Spell-correct the query against the local index of well-known titles.
// TMDB has zero typo tolerance ("intrastellar" returns nothing at all), so
// the only way to recover is knowing what the user probably meant and
// searching for that instead - same idea as IMDb's own suggestion index.
function localCorrections(qNorm, limit = 3) {
  if (!qNorm || qNorm.length < 4) return [];
  const scored = [];
  for (const [t, pop] of POPULAR_TITLES) {
    if (Math.abs(t.length - qNorm.length) > 5) continue;
    const s = simRatio(qNorm, t);
    if (s >= 0.7 && s < 1) scored.push({ t, s, pop });
  }
  scored.sort((a, b) => b.s - a.s || b.pop - a.pop);
  return scored.slice(0, limit).map((x) => x.t);
}

// Alternate query strings for recovery: drop one word at a time (wrong/extra
// word - "shawshank redemtion" still hits via "shawshank"), and trim trailing
// chars (suffix typos - "intersteller" hits via "interst" prefix matching).
function buildRecoveryVariants(query) {
  const qNorm = normalize(query);
  const tokens = qNorm.split(" ").filter(Boolean);
  const variants = new Set();

  if (tokens.length >= 2 && tokens.length <= 4) {
    for (let i = 0; i < tokens.length; i++) {
      variants.add(tokens.filter((_, j) => j !== i).join(" "));
    }
  } else if (tokens.length > 4) {
    variants.add(tokens.slice(0, 3).join(" "));
    variants.add(tokens.slice(-3).join(" "));
  }

  if (tokens.length === 1 && qNorm.length >= 6) {
    variants.add(qNorm.slice(0, qNorm.length - 2));
    variants.add(qNorm.slice(0, Math.max(4, Math.ceil(qNorm.length * 0.6))));
    // Short prefix casts the widest net: trims can't fix a mid-word typo
    // ("intrastellar"), but "intr" still surfaces Interstellar for the
    // fuzzy re-rank to pick out.
    variants.add(qNorm.slice(0, 4));
  } else if (qNorm.length >= 8) {
    variants.add(qNorm.slice(0, qNorm.length - 3));
  }

  variants.delete(qNorm);
  return [...variants].slice(0, 5);
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = globalThis.process?.env?.TMDB_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "TMDB_API_KEY is not configured" });
  }

  const q = req.query || {};
  const action = q.action;

  try {
    if (action === "trending-movies" || action === "trending-tv") {
      const mt = action === "trending-tv" ? "tv" : "movie";
      // Fetch a couple of extra pages (6 -> ~120) so that after de-duping we
      // still have a full 100 unique titles.
      const [results, { movieGenres, tvGenres }] = await Promise.all([
        tmdbPages(`/trending/${mt}/week`, 6, key),
        getGenreMaps(key),
      ]);
      const genreMap = mt === "tv" ? tvGenres : movieGenres;
      const mapped = results.map((it) => mapListItem(it, mt, genreMap)).filter(Boolean);
      // TMDB's paginated trending can repeat a title across pages as popularity
      // shifts mid-fetch; dedupe so every row has a unique id (duplicate keys
      // otherwise break list reordering when the client re-sorts), then cap at
      // the top 100.
      const seenIds = new Set();
      const items = mapped
        .filter((it) => {
          if (seenIds.has(it.tmdb_id)) return false;
          seenIds.add(it.tmdb_id);
          return true;
        })
        .slice(0, 100);
      // Resolve IMDb ids so the trending list can show live IMDb ratings.
      await attachImdbIds(items, key);
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400",
      );
      return res.status(200).json(items);
    }

    if (action === "search") {
      const query = String(q.query || "").trim();
      if (!query) return res.status(400).json({ error: "Missing query" });

      const qNorm = normalize(query);

      // One page of one search endpoint; failures collapse to empty results
      // so a flaky variant request never sinks the whole search.
      const searchPage = (path, qStr, page) =>
        tmdbFetch(
          path,
          { query: qStr, include_adult: "false", page: String(page) },
          key,
        ).catch(() => ({ results: [], total_pages: 0 }));

      // People search: /search/person, re-ranked by name similarity so the
      // intended person surfaces even when misspelled; weak pools get the
      // same recovery variants as titles.
      if (q.mediaType === "person") {
        const first = await searchPage("/search/person", query, 1);
        let pool = first.results || [];
        const bestSim = pool.reduce(
          (m, p) => Math.max(m, simRatio(qNorm, normalize(p.name))),
          0,
        );
        if (bestSim < RECOVERY_SIM_THRESHOLD) {
          const extra = await Promise.all(
            buildRecoveryVariants(query).map((v) =>
              searchPage("/search/person", v, 1),
            ),
          );
          pool = [...pool, ...extra.flatMap((d) => d.results || [])];
        }
        const seenPeople = new Set();
        const people = pool
          .filter((p) => {
            if (seenPeople.has(p.id)) return false;
            seenPeople.add(p.id);
            return true;
          })
          .map((p) => ({ p, name: normalize(p.name) }))
          .sort(
            (a, b) =>
              simRatio(qNorm, b.name) +
              Math.log10((b.p.popularity || 0) + 1) / 12 -
              (simRatio(qNorm, a.name) +
                Math.log10((a.p.popularity || 0) + 1) / 12),
          )
          .map(({ p }) => mapPersonListItem(p));
        return res.status(200).json({ results: people });
      }

      const requestedMediaType =
        q.mediaType === "movie" || q.mediaType === "tv" ? q.mediaType : null;

      // ---- Candidate collection ----
      // Entries are { it, mt } and deduped on media_type:id as they land.
      const seen = new Set();
      const deduped = [];
      const collect = (results, mt) => {
        for (const it of results || []) {
          const t = mt || it.media_type;
          if (t !== "movie" && t !== "tv") continue;
          const k = `${t}:${it.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          deduped.push({ it, mt: t });
        }
      };

      if (requestedMediaType) {
        // Three-way search requests one tmdb media type at a time.
        const first = await searchPage(
          `/search/${requestedMediaType}`,
          query,
          1,
        );
        const totalPages = Math.min(first.total_pages || 1, MAX_SEARCH_PAGES);
        const remaining = [];
        for (let page = 2; page <= totalPages; page++) {
          remaining.push(
            searchPage(`/search/${requestedMediaType}`, query, page).then(
              (d) => d.results || [],
            ),
          );
        }
        collect(first.results, requestedMediaType);
        collect((await Promise.all(remaining)).flat(), requestedMediaType);
      } else {
        // Legacy callers without a media type keep the merged search: first
        // multi page (tells us total_pages) alongside the per-type searches -
        // /search/movie and /search/tv are more lenient than /search/multi,
        // so merging them improves recall for badly misspelled queries.
        const [multi1, movie1, tv1] = await Promise.all([
          searchPage("/search/multi", query, 1),
          searchPage("/search/movie", query, 1),
          searchPage("/search/tv", query, 1),
        ]);
        const totalPages = Math.min(multi1.total_pages || 1, MAX_SEARCH_PAGES);
        const morePageReqs = [];
        for (let p = 2; p <= totalPages; p++) {
          morePageReqs.push(
            searchPage("/search/multi", query, p).then((d) => d.results || []),
          );
        }
        collect(multi1.results, null);
        collect((await Promise.all(morePageReqs)).flat(), null);
        collect(movie1.results, "movie");
        collect(tv1.results, "tv");
      }

      // ---- Recovery ----
      // No candidate resembles the typed query, so the query itself is
      // probably misspelled or carries extra words TMDB can't match. Re-query
      // with variants (word dropped / trailing chars trimmed) and merge.
      const bestSim = deduped.reduce(
        (m, { it }) => Math.max(m, bestTitleSim(it, qNorm)),
        0,
      );
      if (bestSim < RECOVERY_SIM_THRESHOLD) {
        const types = requestedMediaType
          ? [requestedMediaType]
          : ["movie", "tv"];
        // Spell-corrected titles from the local index first (they search for
        // what the user probably meant), then the structural variants.
        const variants = [
          ...localCorrections(qNorm),
          ...buildRecoveryVariants(query),
        ].slice(0, 6);
        const reqs = [];
        for (const v of variants) {
          for (const t of types) {
            reqs.push(
              searchPage(`/search/${t}`, v, 1).then((d) => ({
                results: d.results || [],
                mt: t,
              })),
            );
          }
        }
        for (const { results, mt } of await Promise.all(reqs)) {
          collect(results, mt);
        }
      }

      // ---- Ranking ----
      // Re-rank everything by fuzzy similarity to the typed query so the
      // intended title surfaces even when misspelled or buried.
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

    if (action === "recommendations") {
      const mediaType = q.mediaType === "tv" ? "tv" : "movie";
      const tmdbId = String(q.tmdbId || "").trim();
      if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).json({ error: "Invalid tmdbId" });
      }
      // TMDB's /recommendations is a weak collaborative signal (their user
      // base is small) and caps out at ~2 pages (~40 titles, often far
      // fewer). Blend three sources for depth and quality:
      //   /recommendations - behavioral, best per-title signal (w=1.0)
      //   /similar         - metadata match, decent volume (w=0.55)
      //   /discover by the title's keywords+genres - thematic matches with a
      //     vote-count floor so it adds depth without junk (w=0.5)
      // Items are position-decayed within each source, get a Bayesian
      // quality prior (vote_average shrunk by vote_count), and titles that
      // appear in multiple sources score higher.
      const fetchList = (path, params = {}) =>
        tmdbFetch(path, params, key)
          .then((d) => d.results || [])
          .catch(() => []);
      const [rec1, rec2, sim1, sim2, detail, kw, { movieGenres, tvGenres }] =
        await Promise.all([
          fetchList(`/${mediaType}/${tmdbId}/recommendations`),
          fetchList(`/${mediaType}/${tmdbId}/recommendations`, { page: "2" }),
          fetchList(`/${mediaType}/${tmdbId}/similar`),
          fetchList(`/${mediaType}/${tmdbId}/similar`, { page: "2" }),
          tmdbFetch(`/${mediaType}/${tmdbId}`, {}, key).catch(() => null),
          tmdbFetch(`/${mediaType}/${tmdbId}/keywords`, {}, key).catch(
            () => null,
          ),
          getGenreMaps(key),
        ]);

      // movie keywords come back as { keywords }, tv as { results }
      const keywordIds = (kw?.keywords || kw?.results || [])
        .slice(0, 6)
        .map((k) => k.id);
      const genreIds = (detail?.genres || []).map((g) => g.id).slice(0, 3);
      let discover = [];
      if (keywordIds.length) {
        const params = {
          with_keywords: keywordIds.join("|"),
          sort_by: "vote_average.desc",
          "vote_count.gte": mediaType === "tv" ? "100" : "200",
        };
        if (genreIds.length) params.with_genres = genreIds.join("|");
        const [d1, d2] = await Promise.all([
          fetchList(`/discover/${mediaType}`, params),
          fetchList(`/discover/${mediaType}`, { ...params, page: "2" }),
        ]);
        discover = [...d1, ...d2];
      }

      const SOURCES = [
        { list: [...rec1, ...rec2], w: 1.0 },
        { list: [...sim1, ...sim2], w: 0.55 },
        { list: discover, w: 0.5 },
      ];
      const byId = new Map();
      for (const { list, w } of SOURCES) {
        list.forEach((it, pos) => {
          if (String(it.id) === tmdbId) return;
          const decay = 1 / (1 + pos / 20);
          const vc = it.vote_count || 0;
          const quality = (vc / (vc + 500)) * ((it.vote_average || 0) / 10);
          const score = w * decay + 0.35 * quality;
          const cur = byId.get(it.id);
          // Later sources add half their score - agreement across sources
          // beats a high rank in any single one.
          if (cur) cur.score += score * 0.5;
          else byId.set(it.id, { it, score });
        });
      }

      const genreMap = mediaType === "tv" ? tvGenres : movieGenres;
      const items = [...byId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 80)
        .map(({ it, score }) => {
          const m = mapListItem(it, mediaType, genreMap);
          if (m) m.rec_score = Math.round(score * 1000) / 1000;
          return m;
        })
        .filter(Boolean);
      // Resolve IMDb ids so the client can filter recommendations by live
      // IMDb rating/votes. Cached a day per seed, so the extra lookups amortize.
      await attachImdbIds(items, key);
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json(items);
    }

    if (action === "person") {
      const personId = String(q.personId || "").trim();
      if (!/^\d+$/.test(personId)) {
        return res.status(400).json({ error: "Invalid personId" });
      }
      const data = await tmdbFetch(
        `/person/${personId}`,
        { append_to_response: "combined_credits,external_ids" },
        key,
      );

      // Cast credits = "starred/appeared in"; dedupe by title (a person can be
      // credited on the same show across seasons) keeping the first (highest
      // popularity after the sort below).
      const dedupe = (items) => {
        const seen = new Set();
        return items.filter((it) => {
          if (!it) return false;
          const k = `${it.media_type}:${it.tmdb_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      };
      const byYearDesc = (a, b) => (b.startYear || 0) - (a.startYear || 0);

      const acting = dedupe(
        (data.combined_credits?.cast || []).map(mapCredit),
      ).sort(byYearDesc);

      // Crew credits grouped by department (Directing, Writing, Production...).
      const crewByDept = {};
      for (const c of data.combined_credits?.crew || []) {
        const mapped = mapCredit(c);
        if (!mapped) continue;
        const dept = c.department || "Other";
        (crewByDept[dept] ||= []).push(mapped);
      }
      for (const dept of Object.keys(crewByDept)) {
        crewByDept[dept] = dedupe(crewByDept[dept]).sort(byYearDesc);
      }

      // "Known For" = most popular titles across every role, deduped.
      // Talk/news/reality shows and "Self" guest appearances are excluded -
      // an actor's chat-show circuit otherwise outranks their actual work.
      const excludedTvGenres = new Set([10763, 10764, 10767]); // News, Reality, Talk
      const isTalkish = (c) =>
        c.media_type === "tv" &&
        (c.genre_ids || []).some((id) => excludedTvGenres.has(id));
      const isSelfAppearance = (c) =>
        /\bself\b|\bhimself\b|\bherself\b|\bthemselves\b/i.test(
          c.character || "",
        );
      const knownFor = dedupe(
        [
          ...(data.combined_credits?.cast || []),
          ...(data.combined_credits?.crew || []),
        ]
          .filter((c) => !isTalkish(c) && !isSelfAppearance(c))
          .map(mapCredit)
          .filter(Boolean)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)),
      ).slice(0, 12);

      res.setHeader(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json({
        person_id: data.id,
        name: data.name,
        profile: posterUrl(data.profile_path, "w342"),
        department: data.known_for_department || null,
        biography: data.biography || "",
        birthday: data.birthday || null,
        place_of_birth: data.place_of_birth || null,
        knownFor,
        acting,
        crewByDept,
      });
    }

    if (action === "images") {
      const mediaType = q.mediaType === "tv" ? "tv" : "movie";
      const tmdbId = String(q.tmdbId || "").trim();
      if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).json({ error: "Invalid tmdbId" });
      }
      // include_image_language keeps English + textless posters first; TMDB
      // otherwise floats every localized variant to the top.
      const data = await tmdbFetch(
        `/${mediaType}/${tmdbId}/images`,
        { include_image_language: "en,null" },
        key,
      );
      const posters = (data.posters || [])
        .slice(0, 30)
        .map((p) => ({
          thumb: posterUrl(p.file_path, "w342"),
          full: posterUrl(p.file_path, "w500"),
        }))
        .filter((p) => p.full);
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json(posters);
    }

    if (action === "art") {
      const mediaType = q.mediaType === "tv" ? "tv" : "movie";
      const tmdbId = String(q.tmdbId || "").trim();
      if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).json({ error: "Invalid tmdbId" });
      }
      // Mixed art (backdrops + posters + logos) for the media details collage.
      // TMDB's images endpoint returns all three; we interleave them so the grid
      // isn't just a wall of wide stills. No language filter - keep everything.
      const data = await tmdbFetch(`/${mediaType}/${tmdbId}/images`, {}, key);
      // Sectioned in a fixed order: wide banners, then posters, then logos
      // (title art - many are localized/non-English so they sit last).
      const backdrops = (data.backdrops || []).slice(0, 16).map((b) => ({
        type: "backdrop",
        thumb: posterUrl(b.file_path, "w300"),
        full: posterUrl(b.file_path, "w1280"),
      }));
      const posters = (data.posters || []).slice(0, 12).map((p) => ({
        type: "poster",
        thumb: posterUrl(p.file_path, "w342"),
        full: posterUrl(p.file_path, "w780"),
      }));
      const logos = (data.logos || []).slice(0, 8).map((l) => ({
        type: "logo",
        thumb: posterUrl(l.file_path, "w300"),
        full: posterUrl(l.file_path, "w500"),
      }));
      const art = [...backdrops, ...posters, ...logos].filter((a) => a.full);
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
      return res.status(200).json(art);
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

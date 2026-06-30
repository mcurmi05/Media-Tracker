// Thin client wrappers around the /api/tmdb serverless proxy. The TMDB key
// lives only on the server; the proxy maps TMDB responses into the app's
// internal movie_object shape, so callers get the same shape as before.

const API = "/api/tmdb";
const HARDCOVER_API = "/api/hardcover";

async function requestJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body;
}

export const getPopularMovies = async () => {
  try {
    const response = await fetch(`${API}?action=trending-movies`);
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

export const getPopularTV = async () => {
  try {
    const response = await fetch(`${API}?action=trending-tv`);
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

export const getTrendingPeople = async () => {
  try {
    const response = await fetch(`${API}?action=trending-people`);
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

export const searchMovies = async (query, mediaType) => {
  try {
    const typeParam = mediaType
      ? `&mediaType=${encodeURIComponent(mediaType)}`
      : "";
    const results = await requestJson(
      `${API}?action=search&query=${encodeURIComponent(query)}${typeParam}`,
    );
    return results.results;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const searchMoviesFIRSTFIVEONLY = async (query, mediaType) => {
  try {
    const typeParam = mediaType
      ? `&mediaType=${encodeURIComponent(mediaType)}`
      : "";
    const results = await requestJson(
      `${API}?action=search&query=${encodeURIComponent(query)}${typeParam}`,
    );
    return (results.results || []).slice(0, 5);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const searchBooksHardcover = async (query) => {
  const data = await requestJson(
    `${HARDCOVER_API}?action=search&query=${encodeURIComponent(query)}`,
  );
  return data.results || [];
};

export const searchBooksHardcoverFIRSTFIVEONLY = async (query) => {
  const data = await requestJson(
    `${HARDCOVER_API}?action=search&query=${encodeURIComponent(query)}&limit=5`,
  );
  return (data.results || []).slice(0, 5);
};

function normalizedTitle(item) {
  return String(item.title || item.primaryTitle || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function combinedMatchScore(item, query) {
  const title = normalizedTitle(item);
  const target = normalizedTitle({ title: query });
  if (!title || !target) return 0;
  if (title === target) return 100;
  if (title.startsWith(target)) return 70;
  if (title.includes(target)) return 50;
  const words = target.split(" ");
  const titleWords = new Set(title.split(" "));
  return words.reduce(
    (score, word) => score + (titleWords.has(word) ? 10 : 0),
    0,
  );
}

export function combineSearchResults(query, ...groups) {
  return groups
    .flatMap((items, groupIndex) =>
      (items || []).map((item, resultIndex) => ({
        item,
        score:
          combinedMatchScore(item, query) -
          resultIndex * 0.01 -
          groupIndex * 0.0001,
      })),
    )
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

export const getBookByHardcoverId = async (hardcoverId) =>
  requestJson(
    `${HARDCOVER_API}?action=book&id=${encodeURIComponent(hardcoverId)}`,
  );

// Fetch a full title by TMDB id + media type ("movie" | "tv"). Returns the
// complete movie_object including the resolved IMDb id (tconst).
export const getMovieById = async (mediaType, tmdbId) => {
  try {
    const response = await fetch(
      `${API}?action=title&mediaType=${encodeURIComponent(
        mediaType,
      )}&tmdbId=${encodeURIComponent(tmdbId)}`,
    );
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

// Resolve { tmdb_id, media_type } from an IMDb tconst (legacy/back-compat
// paths and the backfill). Returns null if TMDB has no match.
export const findByImdbId = async (imdbId) => {
  try {
    const response = await fetch(
      `${API}?action=find&imdbId=${encodeURIComponent(imdbId)}`,
    );
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

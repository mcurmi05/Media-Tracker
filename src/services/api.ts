import type {
  MediaType,
  NormalizedBook,
  NormalizedMediaListItem,
  SearchResult,
} from "../types/media";

// Thin client wrappers around the /api/tmdb serverless proxy. The TMDB key
// lives only on the server; the proxy maps TMDB responses into the app's
// internal movie_object shape, so callers get the same shape as before.

const API = "/api/tmdb";
const HARDCOVER_API = "/api/hardcover";

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
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

export const searchMovies = async (
  query: string,
  mediaType?: MediaType,
): Promise<NormalizedMediaListItem[]> => {
  try {
    const typeParam = mediaType
      ? `&mediaType=${encodeURIComponent(mediaType)}`
      : "";
    const results = await requestJson<{
      results: NormalizedMediaListItem[];
    }>(
      `${API}?action=search&query=${encodeURIComponent(query)}${typeParam}`,
    );
    return results.results;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const searchMoviesFIRSTFIVEONLY = async (
  query: string,
  mediaType?: MediaType,
): Promise<NormalizedMediaListItem[]> => {
  try {
    const typeParam = mediaType
      ? `&mediaType=${encodeURIComponent(mediaType)}`
      : "";
    const results = await requestJson<{
      results: NormalizedMediaListItem[];
    }>(
      `${API}?action=search&query=${encodeURIComponent(query)}${typeParam}`,
    );
    return (results.results || []).slice(0, 5);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const searchBooksHardcover = async (
  query: string,
): Promise<NormalizedBook[]> => {
  const data = await requestJson<{ results: NormalizedBook[] }>(
    `${HARDCOVER_API}?action=search&query=${encodeURIComponent(query)}`,
  );
  return data.results || [];
};

export const searchBooksHardcoverFIRSTFIVEONLY = async (
  query: string,
): Promise<NormalizedBook[]> => {
  const data = await requestJson<{ results: NormalizedBook[] }>(
    `${HARDCOVER_API}?action=search&query=${encodeURIComponent(query)}&limit=5`,
  );
  return (data.results || []).slice(0, 5);
};

function normalizedTitle(item: { title?: string; primaryTitle?: string }) {
  return String(item.title || item.primaryTitle || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function combinedMatchScore(item: SearchResult, query: string) {
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

export function combineSearchResults(
  query: string,
  ...groups: SearchResult[][]
): SearchResult[] {
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

export const getBookByHardcoverId = async (
  hardcoverId: string | number,
): Promise<NormalizedBook> =>
  requestJson<NormalizedBook>(
    `${HARDCOVER_API}?action=book&id=${encodeURIComponent(hardcoverId)}`,
  );

// Fetch a full title by TMDB id + media type ("movie" | "tv"). Returns the
// complete movie_object including the resolved IMDb id (tconst).
export const getMovieById = async (
  mediaType: MediaType,
  tmdbId: string | number,
) => {
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

// Poster options for a title, for the log poster picker. Returns [{ thumb, full }].
export const getTitleImages = async (
  mediaType: MediaType,
  tmdbId: string | number,
) => {
  try {
    const response = await fetch(
      `${API}?action=images&mediaType=${encodeURIComponent(
        mediaType,
      )}&tmdbId=${encodeURIComponent(tmdbId)}`,
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

// Backdrop art (wide stills) for a title, for the media details collage.
// Returns [{ thumb, full }]. Not stored - fetched fresh when a page opens.
export const getTitleArt = async (
  mediaType: MediaType,
  tmdbId: string | number,
) => {
  try {
    const response = await fetch(
      `${API}?action=art&mediaType=${encodeURIComponent(
        mediaType,
      )}&tmdbId=${encodeURIComponent(tmdbId)}`,
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

// TMDB recommendations for a title. Returns minimal movie_objects (same shape
// as trending list items). Used on the media details page and aggregated on the
// home page.
export const getRecommendations = async (
  mediaType: MediaType,
  tmdbId: string | number,
) => {
  try {
    const response = await fetch(
      `${API}?action=recommendations&mediaType=${encodeURIComponent(
        mediaType,
      )}&tmdbId=${encodeURIComponent(tmdbId)}`,
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

// Cover options for a book (Hardcover editions). Returns [{ thumb, full }].
export const getBookCovers = async (hardcoverId: string | number) => {
  try {
    const response = await fetch(
      `${HARDCOVER_API}?action=covers&id=${encodeURIComponent(hardcoverId)}`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (error) {
    console.error(error);
    return [];
  }
};

// Resolve { tmdb_id, media_type } from an IMDb tconst (legacy/back-compat
// paths and the backfill). Returns null if TMDB has no match.
export const findByImdbId = async (imdbId: string) => {
  try {
    const response = await fetch(
      `${API}?action=find&imdbId=${encodeURIComponent(imdbId)}`,
    );
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

// Thin client wrappers around the /api/tmdb serverless proxy. The TMDB key
// lives only on the server; the proxy maps TMDB responses into the app's
// internal movie_object shape, so callers get the same shape as before.

const API = "/api/tmdb";

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

export const searchMovies = async (query) => {
  try {
    const response = await fetch(
      `${API}?action=search&query=${encodeURIComponent(query)}`,
    );
    const results = await response.json();
    return results.results;
  } catch (error) {
    console.error(error);
  }
};

export const searchMoviesFIRSTFIVEONLY = async (query) => {
  try {
    const response = await fetch(
      `${API}?action=search&query=${encodeURIComponent(query)}`,
    );
    const results = await response.json();
    return (results.results || []).slice(0, 5);
  } catch (error) {
    console.error(error);
  }
};

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

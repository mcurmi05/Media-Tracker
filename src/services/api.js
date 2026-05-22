// Thin client wrappers around the /api/imdb serverless proxy. The RapidAPI
// key lives only on the server, so nothing here ever touches it.

const API = "/api/imdb";

export const getPopularMovies = async () => {
  try {
    const response = await fetch(`${API}?action=popular-movies`);
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

export const getPopularTV = async () => {
  try {
    const response = await fetch(`${API}?action=popular-tv`);
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

export const searchMovies = async (query) => {
  try {
    const response = await fetch(
      `${API}?action=search&rows=100&query=${encodeURIComponent(query)}`,
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
      `${API}?action=search&rows=5&query=${encodeURIComponent(query)}`,
    );
    const results = await response.json();
    return results.results;
  } catch (error) {
    console.error(error);
  }
};

export const getMovieById = async (id) => {
  try {
    const response = await fetch(
      `${API}?action=title&id=${encodeURIComponent(id)}`,
    );
    return await response.json();
  } catch (error) {
    console.error(error);
  }
};

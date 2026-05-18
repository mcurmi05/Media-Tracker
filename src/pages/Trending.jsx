import { useState, useEffect } from "react";
import { getPopularMovies, getPopularTV } from "../services/api.js";
import { useCache } from "../contexts/PopularMoviesCacheContext";
import "../styles/Trending.css";
import MovieCard from "../components/MovieCard.jsx";

function Trending() {
  const {
    popularMovies,
    popularMoviesLoaded,
    cachePopularMovies,
    popularTV,
    popularTVLoaded,
    cachePopularTV,
  } = useCache();

  const getInitialMediaType = () => {
    const saved = localStorage.getItem("trendingMediaType");
    return saved === "tv" ? "tv" : "movies";
  };
  const [mediaType, setMediaType] = useState(getInitialMediaType);

  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      if (mediaType === "movies") {
        //should load the one they are looking at first
        if (!popularMoviesLoaded) {
          try {
            const fetchedMovies = await getPopularMovies();
            if (isMounted) cachePopularMovies(fetchedMovies);
          } catch (err) {
            if (isMounted) setError("Failed to load movies..." + err);
          }
        }
        if (!popularTVLoaded) {
          try {
            const fetchedTV = await getPopularTV();
            if (isMounted) cachePopularTV(fetchedTV);
          } catch (err) {
            if (isMounted) setError("Failed to load TV shows..." + err);
          }
        }
      } else if (mediaType === "tv") {
        if (!popularTVLoaded) {
          try {
            const fetchedTV = await getPopularTV();
            if (isMounted) cachePopularTV(fetchedTV);
          } catch (err) {
            if (isMounted) setError("Failed to load TV shows..." + err);
          }
        }

        if (!popularMoviesLoaded) {
          try {
            const fetchedMovies = await getPopularMovies();
            if (isMounted) cachePopularMovies(fetchedMovies);
          } catch (err) {
            if (isMounted) setError("Failed to load movies..." + err);
          }
        }
      }
      if (isMounted) setLoading(false);
    };

    fetchAll();
    return () => {
      isMounted = false;
    };
    // Only run on mount
    // eslint-disable-next-line
  }, []);

  // Set movies to display based on mediaType and cache
  useEffect(() => {
    setLoading(true);
    setError(null);

    if (mediaType === "movies") {
      if (popularMoviesLoaded && popularMovies) {
        setMovies(popularMovies);
        setLoading(false);
      } else {
        setMovies([]);
        setLoading(true);
      }
    } else {
      if (popularTVLoaded && popularTV) {
        setMovies(popularTV);
        setLoading(false);
      } else {
        setMovies([]);
        setLoading(true);
      }
    }
    localStorage.setItem("trendingMediaType", mediaType);
  }, [
    mediaType,
    popularMovies,
    popularMoviesLoaded,
    popularTV,
    popularTVLoaded,
  ]);

  return (
    <div className="trending">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "-20px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1 style={{ textAlign: "center", margin: 0 }}>Top 100 Trending</h1>
        <select
          className="mediatype-selector"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
          style={{
            height: "32px",
            padding: "0 10px",
            border: "1px solid #cccccc",
            borderRadius: "6px",
            backgroundColor: "#3b3b3b",
            color: "#ffffff",
            fontSize: "0.8rem",
            outline: "none",
            textAlign: "center",
            minWidth: "140px",
            margin: "6px",
            marginTop: "10px",
          }}
        >
          <option value="movies">Movies</option>
          <option value="tv">TV</option>
        </select>
      </div>
      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="movies-grid">
          {movies.map((movie) => (
            <MovieCard movie={movie} key={movie.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Trending;

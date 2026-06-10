import { useState, useEffect, useMemo } from "react";
import { getPopularMovies, getPopularTV } from "../services/api.js";
import { useCache } from "../contexts/PopularMoviesCacheContext";
import { useNavigate } from "react-router-dom";
import "../styles/Trending.css";
import Loader from "../components/Loader.jsx";

function Trending() {
  const {
    popularMovies,
    popularMoviesLoaded,
    cachePopularMovies,
    popularTV,
    popularTVLoaded,
    cachePopularTV,
  } = useCache();

  const navigate = useNavigate();

  const getInitialMediaType = () => {
    const saved = localStorage.getItem("trendingMediaType");
    return saved === "tv" ? "tv" : "movies";
  };

  const [mediaType, setMediaType] = useState(getInitialMediaType);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.setItem("trendingMediaType", mediaType);
  }, [mediaType]);

  useEffect(() => {
    let cancelled = false;
    const fetchType = async (type) => {
      const alreadyLoaded = type === "movies" ? popularMoviesLoaded : popularTVLoaded;
      if (alreadyLoaded) return;
      try {
        const data = type === "movies" ? await getPopularMovies() : await getPopularTV();
        if (cancelled) return;
        type === "movies" ? cachePopularMovies(data) : cachePopularTV(data);
      } catch (err) {
        if (!cancelled) setError(`Failed to load ${type}: ${err}`);
      }
    };

    const other = mediaType === "movies" ? "tv" : "movies";
    fetchType(mediaType).then(() => fetchType(other));

    return () => { cancelled = true; };
  }, [mediaType]); // eslint-disable-line react-hooks/exhaustive-deps

  const movies = useMemo(() => {
    if (mediaType === "movies") return popularMoviesLoaded ? (popularMovies || []) : [];
    return popularTVLoaded ? (popularTV || []) : [];
  }, [mediaType, popularMovies, popularMoviesLoaded, popularTV, popularTVLoaded]);

  const isLoaded = mediaType === "movies" ? popularMoviesLoaded : popularTVLoaded;

  if (!isLoaded) return <Loader />;

  const featured = movies.slice(0, 3);
  const rest = movies.slice(3);

  const goTo = (movie) => navigate(`/mediadetails/${movie.media_type}/${movie.tmdb_id}`);

  return (
    <div className="trending">
      <div className="trending-header">
        <h1 className="trending-title-h1">Top 100 Trending</h1>
        <select
          className="mediatype-selector"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
        >
          <option value="movies">Movies</option>
          <option value="tv">TV</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Top 3 featured cards - key forces full remount on switch */}
      <div className="trending-featured" key={mediaType}>
        {featured.map((movie, i) => (
          <div
            key={`featured-${movie.media_type}-${movie.tmdb_id}`}
            className="tf-card"
            style={{
              backgroundImage: `url(${movie.backdropImage || movie.primaryImage})`,
            }}
            onClick={() => goTo(movie)}
          >
            <div className="tf-overlay" />
            <span className="tf-big-rank">#{i + 1}</span>
            <div className="tf-content">
              <img
                className="tf-poster"
                src={movie.primaryImage || "/placeholderimage.jpg"}
                onError={(e) => { e.target.onerror = null; e.target.src = "/placeholderimage.jpg"; }}
                alt={movie.primaryTitle}
              />
              <div className="tf-text">
                <p className="tf-title">{movie.primaryTitle}</p>
                <div className="tf-meta">
                  {movie.startYear && (
                    <span className="tf-year">{movie.startYear}</span>
                  )}
                  {movie.interests?.slice(0, 3).map((g) => (
                    <span key={g} className="tf-genre-tag">{g}</span>
                  ))}
                </div>
                {movie.description && (
                  <p className="tf-desc">{movie.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        <p className="trending-section-label">More trending</p>

        {rest.map((movie, i) => (
          <div
            key={`${movie.media_type}-${movie.tmdb_id}`}
            className="trending-row"
            onClick={() => goTo(movie)}
          >
            <span className="trending-rank">#{i + 4}</span>
            <img
              className="trending-thumb"
              src={movie.primaryImage || "/placeholderimage.jpg"}
              onError={(e) => { e.target.onerror = null; e.target.src = "/placeholderimage.jpg"; }}
              alt={movie.primaryTitle}
            />
            <div className="trending-info">
              <p className="trending-item-title">{movie.primaryTitle}</p>
              <div className="trending-meta">
                {movie.startYear && (
                  <span className="trending-year">{movie.startYear}</span>
                )}
                {movie.interests?.slice(0, 2).map((g) => (
                  <span key={g} className="trending-genre-tag">{g}</span>
                ))}
              </div>
              {movie.description && (
                <p className="trending-desc">{movie.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Trending;

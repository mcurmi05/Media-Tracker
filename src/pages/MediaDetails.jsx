import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMovieById } from "../services/api";
import { upsertMovie } from "../services/movieMetadata";
import { useImdbRating } from "../contexts/ImdbRatingsContext";
import "../styles/MediaDetails.css";
import ReleaseAndRunTime from "../components/ReleaseAndRunTime";
import IMDBInfo from "../components/IMDBInfo";
import MediaGenres from "../components/MediaGenres.jsx";
import MovieRatingStar from "../components/MovieRatingStar";
import CastList from "../components/CastList.jsx";
import AddLog from "../components/AddLog.jsx";
import AddWatchlist from "../components/AddWatchlist.jsx";
import { useRatings } from "../contexts/UserRatingsContext.jsx";
import Loader from "../components/Loader.jsx";

function MediaDetails() {
  const { mediaType, tmdbId } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userRatings } = useRatings();

  // Hold the loader until the live IMDb rating resolves (undefined = pending).
  // movie?.id is the tconst; if absent the hook is a no-op and imdbReady stays true.
  const imdbLive = useImdbRating(movie?.id || undefined);
  const imdbReady = !movie?.id || imdbLive !== undefined;

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const movie = await getMovieById(mediaType, tmdbId);
        setMovie(movie);
        // Refresh the cached metadata in the shared movies table on open.
        if (movie) upsertMovie(movie);
      } catch (err) {
        setError("Failed to load movie details");
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [mediaType, tmdbId]);

  if (loading || !imdbReady) return <Loader />;
  if (error) return <div className="error">{error}</div>;
  if (!movie) return <div className="error">Movie not found</div>;

  const getYouTubeVideoId = (url) => {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  return (
    <div className="page-container">
      <div className="media-details">
        {/*title*/}
        <div className="top-container">
          <h1 className="title">{movie.primaryTitle}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="star-container">
              <MovieRatingStar movie={movie}></MovieRatingStar>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <AddWatchlist movie={movie} needMoreDetail={false}></AddWatchlist>
              <AddLog movie={movie} needMoreDetail={false}></AddLog>
            </div>
            {/* Rank badge only if rated 10; no controls here */}
            {(() => {
              const rating = userRatings.find(
                (r) => r.imdb_movie_id === movie.id
              );
              if (!rating || Number(rating.rating) !== 10) return null;
              const rank = rating.ranking;
              const badgeStyle = {
                background:
                  rank === 1
                    ? "linear-gradient(135deg,#FFD700,#E6C200)"
                    : rank === 2
                    ? "linear-gradient(135deg,#C0C0C0,#A9A9A9)"
                    : rank === 3
                    ? "linear-gradient(135deg,#CD7F32,#B87333)"
                    : "#444",
                color: rank ? "#000" : "#fff",
                borderRadius: 10,
                padding: "2px 8px",
                fontSize: "0.85rem",
                minWidth: 42,
                textAlign: "center",
              };
              return (
                <span style={badgeStyle}>{rank ? `#${rank}` : "Unranked"}</span>
              );
            })()}
          </div>
        </div>
        {/*release and runtime*/}
        <div className="subtitle">
          <ReleaseAndRunTime movie={movie} />·
          <IMDBInfo
            movie={movie}
            className="media-details-imdb"
            useLiveRating
          ></IMDBInfo>
        </div>

        {/*poster and trailer*/}
        <div className="poster-and-trailer">
          <img className="poster" src={movie.primaryImage} />
          {movie.trailer ? (
            <iframe
              className="youtube-embed"
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(
                movie.trailer
              )}?autoplay=1&mute=1&controls=1&loop=1&playlist=${getYouTubeVideoId(
                movie.trailer
              )}`}
              title={`${movie.primaryTitle} - Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <h2>No trailer found</h2>
          )}
        </div>
        {/*description and genres*/}

        <div className="secondary-under-part">
          <div className="secondary-poster-and-description">
            <img className="secondary-poster" src={movie.primaryImage} />
            <div className="description-container">
              <p className="description">{movie.description}</p>
            </div>
          </div>
          <MediaGenres movie={movie}></MediaGenres>
        </div>

        <div className="cast-list">
          <CastList movie={movie} />
        </div>

        <div className="primary-under-part">
          <div className="description-container">
            <p className="description">{movie.description}</p>
          </div>
          <MediaGenres movie={movie}></MediaGenres>
        </div>

        {movie.media_type === "movie" ? (
          <div className="director-and-writer">
            {movie.directors?.length > 0 && (
              <p>
                <span className="bold-span">Directed by</span>{" "}
                {movie.directors.map((d) => d.fullName).join(", ")}
              </p>
            )}
            {movie.writers?.length > 0 && (
              <p>
                <span className="bold-span">Written by</span>{" "}
                {movie.writers.map((w) => w.fullName).join(", ")}
              </p>
            )}
            {movie.budget ? (
              <p>
                <span className="bold-span">Budget</span> $
                {movie.budget.toLocaleString("en-US")} USD
              </p>
            ) : null}
          </div>
        ) : movie.media_type === "tv" ? (
          <div className="director-and-writer">
            {movie.creators?.length > 0 && (
              <p>
                <span className="bold-span">Created by</span>{" "}
                {movie.creators.map((c) => c.fullName).join(", ")}
              </p>
            )}
          </div>
        ) : null}

        {movie.media_type === "tv" &&
          movie.seasons &&
          movie.seasons.length > 0 && (
            <div className="seasons-section">
              <p className="seasons-section-title">Seasons &amp; Episodes</p>
              {movie.seasons.map((season) => (
                <div key={season.season_number} className="season-block">
                  <div className="season-header">
                    <p className="season-name">{season.name}</p>
                    <span className="season-ep-count">
                      {season.episode_count} episodes
                    </span>
                  </div>
                  <div className="episodes-scroll">
                    {season.episodes.map((ep) => (
                      <div key={ep.episode_number} className="episode-card">
                        <img
                          className="episode-still"
                          src={ep.still || "/placeholderimage.jpg"}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/placeholderimage.jpg";
                          }}
                          alt={ep.name}
                        />
                        <div className="episode-meta">
                          <p className="episode-label">E{ep.episode_number}</p>
                          <p className="episode-name">{ep.name}</p>
                          {ep.runtime && (
                            <p className="episode-runtime">{ep.runtime}m</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

export default MediaDetails;

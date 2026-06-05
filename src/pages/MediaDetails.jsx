import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMovieById } from "../services/api";
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
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userRatings } = useRatings();

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const movie = await getMovieById(id);
        setMovie(movie);
      } catch (err) {
        setError("Failed to load movie details");
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

  if (loading) return <Loader />;
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
          <IMDBInfo movie={movie} className="media-details-imdb"></IMDBInfo>
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

        {movie.type === "movie" ? (
          <div className="director-and-writer">
            <p>
              <span className="bold-span">Directed by</span>{" "}
              {movie.directors.map((director) => director.fullName).join(", ")}
            </p>
            <p>
              <span className="bold-span">Written by</span>{" "}
              {movie.writers.map((writer) => writer.fullName).join(", ")}
            </p>
            {movie.budget ? (
              <p>
                <span className="bold-span">Budget</span> $
                {movie.budget.toLocaleString("en-US")} USD
              </p>
            ) : null}
          </div>
        ) : (
          ""
        )}
      </div>
    </div>
  );
}

export default MediaDetails;

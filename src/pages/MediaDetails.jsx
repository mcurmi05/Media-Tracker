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
import ScrollStrip from "../components/ScrollStrip.jsx";
import EpisodeModal from "../components/EpisodeModal.jsx";
import AddLog from "../components/AddLog.jsx";
import AddWatchlist from "../components/AddWatchlist.jsx";
import { useRatings } from "../contexts/UserRatingsContext.jsx";
import { getRatingForMovie } from "../services/ratingsfromtable.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getWatchStatus, saveWatchStatus } from "../services/watchStatus.js";
import Loader from "../components/Loader.jsx";

function formatEpisodeDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function MediaDetails() {
  const { mediaType, tmdbId } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [movieEntryId, setMovieEntryId] = useState(null);
  const [watchStatus, setWatchStatus] = useState({});
  const { userRatings } = useRatings();
  const { user } = useAuth();

  // Hold the loader until the live IMDb rating resolves (undefined = pending).
  // movie?.id is the tconst; if absent the hook is a no-op and imdbReady stays true.
  const imdbLive = useImdbRating(movie?.id || undefined);
  const imdbReady = !movie?.id || imdbLive !== undefined;

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const movie = await getMovieById(mediaType, tmdbId);
        setMovie(movie);
        // Refresh the cached metadata in the shared movies table on open and
        // keep the returned id to key per-user watch status against. Don't block
        // render on the upsert; capture the id once it resolves.
        if (movie) {
          upsertMovie(movie).then((entryId) => setMovieEntryId(entryId));
        }
      } catch (err) {
        setError("Failed to load movie details");
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [mediaType, tmdbId]);

  // Load this user's watch status for the title once we have its movies row id.
  useEffect(() => {
    if (!user || !movieEntryId || movie?.media_type !== "tv") return;
    let active = true;
    getWatchStatus(user.id, movieEntryId).then((s) => {
      if (active) setWatchStatus(s || {});
    });
    return () => {
      active = false;
    };
  }, [user, movieEntryId, movie?.media_type]);

  if (loading || !imdbReady) return <Loader />;
  if (error) return <div className="error">{error}</div>;
  if (!movie) return <div className="error">Movie not found</div>;

  const getYouTubeVideoId = (url) => {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const openEpisode = (ep, season) =>
    setSelectedEpisode({
      ...ep,
      _seasonName: season.name,
      _seasonNumber: season.season_number,
    });

  // ----- Watch status helpers (TV only) -----
  const isEpisodeWatched = (seasonNumber, epNumber) =>
    (watchStatus[seasonNumber] || []).includes(epNumber);

  const seasonWatchedCount = (season) =>
    season.episodes.filter((ep) =>
      isEpisodeWatched(season.season_number, ep.episode_number)
    ).length;

  const isSeasonFullyWatched = (season) =>
    season.episodes.length > 0 &&
    seasonWatchedCount(season) === season.episodes.length;

  const persistStatus = (next) => {
    if (user && movieEntryId) saveWatchStatus(user.id, movieEntryId, next);
  };

  // Optional watched date per episode, stored alongside the watched flags in the
  // same status jsonb (under a `_dates` sibling). Null/absent is fine - recording
  // when an episode was watched is entirely optional.
  const episodeWatchedDate = (seasonNumber, epNumber) =>
    watchStatus._dates?.[seasonNumber]?.[epNumber] || null;

  const toggleEpisodeWatched = (seasonNumber, epNumber) => {
    setWatchStatus((prev) => {
      const set = new Set(prev[seasonNumber] || []);
      const dates = { ...(prev._dates || {}) };
      const seasonDates = { ...(dates[seasonNumber] || {}) };
      if (set.has(epNumber)) {
        set.delete(epNumber);
        delete seasonDates[epNumber];
      } else {
        set.add(epNumber);
      }
      const next = { ...prev };
      if (set.size === 0) delete next[seasonNumber];
      else next[seasonNumber] = Array.from(set).sort((a, b) => a - b);
      if (Object.keys(seasonDates).length === 0) delete dates[seasonNumber];
      else dates[seasonNumber] = seasonDates;
      if (Object.keys(dates).length === 0) delete next._dates;
      else next._dates = dates;
      persistStatus(next);
      return next;
    });
  };

  const setEpisodeWatchedDate = (seasonNumber, epNumber, isoDate) => {
    setWatchStatus((prev) => {
      const dates = { ...(prev._dates || {}) };
      dates[seasonNumber] = {
        ...(dates[seasonNumber] || {}),
        [epNumber]: isoDate,
      };
      const next = { ...prev, _dates: dates };
      persistStatus(next);
      return next;
    });
  };

  const clearEpisodeWatchedDate = (seasonNumber, epNumber) => {
    setWatchStatus((prev) => {
      if (!prev._dates?.[seasonNumber]?.[epNumber]) return prev;
      const dates = { ...(prev._dates || {}) };
      const seasonDates = { ...(dates[seasonNumber] || {}) };
      delete seasonDates[epNumber];
      if (Object.keys(seasonDates).length === 0) delete dates[seasonNumber];
      else dates[seasonNumber] = seasonDates;
      const next = { ...prev };
      if (Object.keys(dates).length === 0) delete next._dates;
      else next._dates = dates;
      persistStatus(next);
      return next;
    });
  };

  const toggleSeasonWatched = (season) => {
    setWatchStatus((prev) => {
      const fully =
        season.episodes.length > 0 &&
        season.episodes.every((ep) =>
          (prev[season.season_number] || []).includes(ep.episode_number)
        );
      const next = { ...prev };
      if (fully) delete next[season.season_number];
      else
        next[season.season_number] = season.episodes.map(
          (ep) => ep.episode_number
        );
      persistStatus(next);
      return next;
    });
  };

  return (
    <div className="page-container">
      {movie.backdropImageHD && (
        <div className="media-backdrop-hero">
          <img
            src={movie.backdropImageHD}
            alt=""
            aria-hidden="true"
            className={`media-backdrop-img${backdropLoaded ? " loaded" : ""}`}
            onLoad={() => setBackdropLoaded(true)}
          />
        </div>
      )}
      <div className="media-details">
        {/* Hero: poster overlapping the banner's bottom edge, with title + meta */}
        <div className="hero-row">
          <img
            className="hero-poster"
            src={movie.primaryImage || "/placeholderimage.jpg"}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholderimage.jpg";
            }}
            alt={movie.primaryTitle}
          />
          <div className="hero-info">
            <div className="title-row">
              <h1 className="title">{movie.primaryTitle}</h1>
              <div className="hero-actions">
                <div className="star-container">
                  <MovieRatingStar movie={movie}></MovieRatingStar>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    position: "relative",
                    top: "1px",
                    marginLeft: "-3px",
                  }}
                >
                  <AddWatchlist movie={movie} needMoreDetail={false}></AddWatchlist>
                  <AddLog movie={movie} needMoreDetail={false}></AddLog>
                </div>
                {/* Rank badge only if rated 10; no controls here */}
                {(() => {
                  const rating = getRatingForMovie(userRatings, movie);
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
                    <span style={badgeStyle}>
                      {rank ? `#${rank}` : "Unranked"}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="subtitle">
              <ReleaseAndRunTime movie={movie} />·
              <IMDBInfo
                movie={movie}
                className="media-details-imdb"
                useLiveRating
              ></IMDBInfo>
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
          </div>
        </div>

        <div className="cast-list">
          <CastList movie={movie} />
        </div>

        {/* Trailer */}
        {movie.trailer && (
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
        )}

        {/* Description + genres */}
        <div className="info-row">
          <div className="description-container">
            <p className="description">{movie.description}</p>
          </div>
          <MediaGenres movie={movie}></MediaGenres>
        </div>

        {movie.media_type === "tv" &&
          movie.seasons &&
          movie.seasons.length > 0 && (
            <div className="seasons-section">
              <p className="seasons-section-title">Seasons &amp; Episodes</p>
              {movie.seasons.map((season) => (
                <div key={season.season_number} className="season-block">
                  <div className="season-header">
                    <p className="season-name">
                      {season.name}
                      {season.air_date && (
                        <span className="season-year">
                          {" "}
                          ({season.air_date.slice(0, 4)})
                        </span>
                      )}
                    </p>
                    <span className="season-ep-count">
                      {season.episode_count} episodes
                    </span>
                    {user && season.episodes.length > 0 && (
                      <div className="season-actions">
                        {seasonWatchedCount(season) > 0 && (
                          <span className="season-progress">
                            {seasonWatchedCount(season)}/
                            {season.episodes.length} watched
                          </span>
                        )}
                        <button
                          className={`season-watch-btn${
                            isSeasonFullyWatched(season) ? " done" : ""
                          }`}
                          onClick={() => toggleSeasonWatched(season)}
                        >
                          {isSeasonFullyWatched(season)
                            ? `${String.fromCharCode(10003)} Season watched`
                            : "Mark season watched"}
                        </button>
                      </div>
                    )}
                  </div>
                  <ScrollStrip
                    className="episodes-scroll"
                    wrapClassName="md-episodes-strip"
                  >
                    {season.episodes.map((ep) => (
                      <div
                        key={ep.episode_number}
                        className={`episode-card${
                          isEpisodeWatched(
                            season.season_number,
                            ep.episode_number
                          )
                            ? " watched"
                            : ""
                        }`}
                        onClick={() => openEpisode(ep, season)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openEpisode(ep, season);
                          }
                        }}
                      >
                        {user && (
                          <button
                            className="episode-watch-toggle"
                            title={
                              isEpisodeWatched(
                                season.season_number,
                                ep.episode_number
                              )
                                ? "Mark as unwatched"
                                : "Mark as watched"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEpisodeWatched(
                                season.season_number,
                                ep.episode_number
                              );
                            }}
                          >
                            {String.fromCharCode(10003)}
                          </button>
                        )}
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
                          <p className="episode-label">
                            E{ep.episode_number}
                            {ep.runtime ? ` · ${ep.runtime}m` : ""}
                          </p>
                          <p className="episode-name">{ep.name}</p>
                          {ep.air_date && (
                            <p className="episode-date">
                              {formatEpisodeDate(ep.air_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ScrollStrip>
                </div>
              ))}
            </div>
          )}
      </div>

      {selectedEpisode && (
        <EpisodeModal
          episode={selectedEpisode}
          onClose={() => setSelectedEpisode(null)}
          canEdit={!!user}
          isWatched={isEpisodeWatched(
            selectedEpisode._seasonNumber,
            selectedEpisode.episode_number
          )}
          onToggleWatched={() =>
            toggleEpisodeWatched(
              selectedEpisode._seasonNumber,
              selectedEpisode.episode_number
            )
          }
          watchedDate={episodeWatchedDate(
            selectedEpisode._seasonNumber,
            selectedEpisode.episode_number
          )}
          onSetDate={(iso) =>
            setEpisodeWatchedDate(
              selectedEpisode._seasonNumber,
              selectedEpisode.episode_number,
              iso
            )
          }
          onClearDate={() =>
            clearEpisodeWatchedDate(
              selectedEpisode._seasonNumber,
              selectedEpisode.episode_number
            )
          }
        />
      )}
    </div>
  );
}

export default MediaDetails;

import "../styles/MovieCard.css";
import { useNavigate } from "react-router-dom";
import ReleaseAndRunTime from "./ReleaseAndRunTime.jsx";
import MovieRatingStar from "./MovieRatingStar.jsx";
import "../styles/MovieRatingStar.css"
import AddLog from "./AddLog.jsx";
import AddWatchlist from "./AddWatchlist.jsx";


function MovieCard({ movie }) {

  const navigate = useNavigate();

  function onMovieCardClick() {
    console.log("Navigating to movie details for:", movie.primaryTitle);
    navigate(`/mediadetails/${movie.media_type}/${movie.tmdb_id}`);
  }

  return (
    <>
      <div className="movie-card">
        <div className="movie-poster" onClick={onMovieCardClick}>
          <img
            className="movie-poster-img"
            src={
              movie.primaryImage
                ? `${movie.primaryImage}`
                : "/placeholderimage.jpg"
            }
            onError={e => { e.target.onerror = null; e.target.src = "/placeholderimage.jpg"}}
          />
        </div>

        <div className="movie-info">
          <div className="title-and-addlog">
            <h3 onClick={onMovieCardClick}>{movie.primaryTitle}</h3>
            <div className="add-log-container-moviecard">
                <AddWatchlist movie={movie} needMoreDetail={true}></AddWatchlist>
                <AddLog movie={movie} needMoreDetail={true}></AddLog>
            </div>


            
          </div>
          <ReleaseAndRunTime movie={movie} />
          <div className="stars-and-that">
            <MovieRatingStar movie={movie}></MovieRatingStar>
          </div>
          
        </div>
      </div>

    </>
  );
  
}

export default MovieCard;
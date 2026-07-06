import "../../styles/media/MovieCard.css";
import { useNavigate } from "react-router-dom";
import ReleaseAndRunTime from "./ReleaseAndRunTime";
import AddLog from "./AddLog";
import AddWatchlist from "./AddWatchlist";
import { makeNavHandlers } from "../../utils/navClick";
import { useCovers } from "../../contexts/UserCoversContext";


function MovieCard({ movie, posterOnly = false, logged = false }) {

  const navigate = useNavigate();
  const { coverForTmdb } = useCovers();
  const cover =
    coverForTmdb(movie.media_type, movie.tmdb_id) || movie.primaryImage;

  const detailHandlers = makeNavHandlers(
    navigate,
    `/mediadetails/${movie.media_type}/${movie.tmdb_id}`,
  );

  return (
    <>
      <div className={`movie-card${posterOnly ? " movie-card--poster" : ""}`}>
        <div className="movie-poster" {...detailHandlers}>
          <img
            className="movie-poster-img"
            src={cover ? `${cover}` : "/images/placeholderimage.jpg"}
            onError={e => { e.target.onerror = null; e.target.src = "/images/placeholderimage.jpg"}}
          />
          {logged && <span className="poster-logged-tick" title="Logged" />}
        </div>

        {!posterOnly && (
        <div className="movie-info">
          <div className="title-and-addlog">
            <h3 {...detailHandlers}>{movie.primaryTitle}</h3>
            <div className="add-log-container-moviecard">
                <AddWatchlist movie={movie} needMoreDetail={true}></AddWatchlist>
                <AddLog movie={movie} needMoreDetail={true}></AddLog>
            </div>


            
          </div>
          <ReleaseAndRunTime movie={movie} />
        </div>
        )}
      </div>

    </>
  );
  
}

export default MovieCard;
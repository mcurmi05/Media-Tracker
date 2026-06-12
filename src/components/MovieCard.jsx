import "../styles/MovieCard.css";
import { useNavigate } from "react-router-dom";
import ReleaseAndRunTime from "./ReleaseAndRunTime.jsx";
import AddLog from "./AddLog.jsx";
import AddWatchlist from "./AddWatchlist.jsx";
import { makeNavHandlers } from "../utils/navClick.js";


function MovieCard({ movie }) {

  const navigate = useNavigate();

  const detailHandlers = makeNavHandlers(
    navigate,
    `/mediadetails/${movie.media_type}/${movie.tmdb_id}`,
  );

  return (
    <>
      <div className="movie-card">
        <div className="movie-poster" {...detailHandlers}>
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
            <h3 {...detailHandlers}>{movie.primaryTitle}</h3>
            <div className="add-log-container-moviecard">
                <AddWatchlist movie={movie} needMoreDetail={true}></AddWatchlist>
                <AddLog movie={movie} needMoreDetail={true}></AddLog>
            </div>


            
          </div>
          <ReleaseAndRunTime movie={movie} />
        </div>
      </div>

    </>
  );
  
}

export default MovieCard;
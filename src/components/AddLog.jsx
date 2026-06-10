import "../styles/AddLog.css"
import { supabase } from "../services/supabase-client";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLogs } from "../contexts/UserLogsContext";
import { upsertMovie, resolveFullMovie } from "../services/movieMetadata";

export default function AddLog({movie}){

    const {user, isAuthenticated} = useAuth();
    const navigate = useNavigate();
    const {addLog, userLogs} = useLogs();

    const alreadyLogged = userLogs?.some(
        (log) =>
            log.user_id === user?.id &&
            ((movie?.tmdb_id != null &&
                log.movie_object?.tmdb_id === movie.tmdb_id &&
                log.movie_object?.media_type === movie.media_type) ||
                (movie?.id && log.imdb_movie_id === movie.id)),
    );

    async function onClick(){

        if (!isAuthenticated) {
            navigate("/signin");
        } else{
            navigate("/log")

            // Ensure we have full metadata (browse cards only carry tmdb_id),
            // cache it in the shared movies table, and reference it by uuid.
            const full =
                movie.tmdb_id != null && movie.id
                    ? movie
                    : await resolveFullMovie(movie);
            const movieEntryId = await upsertMovie(full);

            const { data, error } = await supabase
            .from("logs")
            .insert(
                {
                    imdb_movie_id: full.id,
                    user_id: user.id,
                    movie_entry_id: movieEntryId,
                })
                .select();

            const newLog = data[0];
            addLog(full.id, "", full, newLog.id)

            if (error) {
                console.error(error);
            }
    }}

    return(

        <div className="white-highlight">
            <img
                src="/addlog.png"
                className="addlog-icon"
                onClick={onClick}
                title={alreadyLogged ? "Already logged - add another" : "Add to log"}
                style={{ opacity: alreadyLogged ? 0.5 : 1 }}
            ></img>
        </div>

    );

};

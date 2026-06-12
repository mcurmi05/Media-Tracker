import "../styles/AddLog.css"
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../services/supabase-client";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLogs } from "../contexts/UserLogsContext";
import { upsertMovie, resolveFullMovie } from "../services/movieMetadata";

export default function AddLog({movie}){

    const {user, isAuthenticated} = useAuth();
    const navigate = useNavigate();
    const {addLog, userLogs} = useLogs();

    const iconRef = useRef(null);
    const [menuPos, setMenuPos] = useState(null);

    const alreadyLogged = userLogs?.some(
        (log) =>
            log.user_id === user?.id &&
            ((movie?.tmdb_id != null &&
                log.movie_object?.tmdb_id === movie.tmdb_id &&
                log.movie_object?.media_type === movie.media_type) ||
                (movie?.id && log.imdb_movie_id === movie.id)),
    );

    // Insert a fresh log for this title and jump to the Log page.
    async function createLog(){
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
                user_id: user.id,
                movie_entry_id: movieEntryId,
            })
            .select();

        if (error) {
            console.error(error);
            return;
        }
        const newLog = data[0];
        addLog(full.id, "", full, newLog.id)
    }

    function onClick(e){
        e?.stopPropagation();
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }
        // If this title is already logged, offer a choice rather than silently
        // stacking another log. Otherwise just create the first log.
        if (alreadyLogged) {
            if (menuPos) {
                setMenuPos(null);
                return;
            }
            const rect = iconRef.current?.getBoundingClientRect();
            if (rect) {
                // Fixed-position so the menu escapes any overflow:hidden card.
                // Sit above the icon (flipping below if there's no room) and
                // centered on it, so it never runs off the right edge.
                const placeAbove = rect.top > 120;
                setMenuPos({
                    left: rect.left + rect.width / 2,
                    top: placeAbove ? rect.top - 8 : rect.bottom + 8,
                    placeAbove,
                });
            }
            return;
        }
        createLog();
    }

    function goToLog(e){
        e?.stopPropagation();
        setMenuPos(null);
        navigate("/log", { state: { searchTerm: movie?.primaryTitle || "" } });
    }

    function createRewatch(e){
        e?.stopPropagation();
        setMenuPos(null);
        createLog();
    }

    return(

        <div className="white-highlight">
            <img
                ref={iconRef}
                src="/addlog.png"
                className="addlog-icon"
                onClick={onClick}
                title={alreadyLogged ? "Logged - options" : "Add to log"}
            ></img>
            {menuPos &&
                createPortal(
                    <>
                        <div
                            className="addlog-menu-backdrop"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuPos(null);
                            }}
                        />
                        <div
                            className="addlog-menu"
                            style={{
                                top: menuPos.top,
                                left: menuPos.left,
                                transform: menuPos.placeAbove
                                    ? "translate(-50%, -100%)"
                                    : "translate(-50%, 0)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="addlog-menu-item" onClick={goToLog}>
                                Go to log
                            </button>
                            <button
                                className="addlog-menu-item"
                                onClick={createRewatch}
                            >
                                Create rewatch log
                            </button>
                        </div>
                    </>,
                    document.body,
                )}
        </div>

    );

};

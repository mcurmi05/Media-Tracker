import "../../styles/media/AddLog.css"
import { supabase } from "../../services/supabase-client";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "../../contexts/UserWatchlistContext";
import { useState, useEffect } from "react";
import { upsertMovie, resolveFullMovie } from "../../services/movieMetadata";

export default function AddWatchlist({movie}){

    const {user, isAuthenticated} = useAuth();
    const navigate = useNavigate();
    const {addWatchlist, removeWatchlist, userWatchlist, watchlistQueue, removeFromQueue} = useWatchlist();
    const [onWatchlist, setOnWatchlist] = useState(false);

    // Match by tmdb_id+media_type (works for browse cards too), falling back to
    // the IMDb id for any rows not yet carrying tmdb metadata.
    const matchesMovie = (item) =>
        (movie?.tmdb_id != null &&
            item.movie_object?.tmdb_id === movie.tmdb_id &&
            item.movie_object?.media_type === movie.media_type) ||
        (movie?.id &&
            (item.movie_id === movie.id || item.movie_object?.id === movie.id));

    useEffect(() => {
        if (userWatchlist) {
            const found = userWatchlist.some(
                (item) => item.user_id === user?.id && matchesMovie(item),
            );
            setOnWatchlist(found);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userWatchlist, movie, isAuthenticated, user]);

    async function onClick(){

        if (!onWatchlist){

            if (!isAuthenticated) {
                navigate("/signin");
            } else{

                setOnWatchlist(true);
                const full =
                    movie.tmdb_id != null && movie.id
                        ? movie
                        : await resolveFullMovie(movie);
                const movieEntryId = await upsertMovie(full);

                const { data, error } = await supabase
                .from("watchlist")
                .insert(
                    {
                        user_id: user.id,
                        movie_entry_id: movieEntryId,
                    })
                    .select();
                const newWatchlistEntry = data[0];
                addWatchlist(newWatchlistEntry.id, full);

                if (error) {
                    console.error(error);
                }
            }

        } else if (onWatchlist) {
            setOnWatchlist(false);
            const entry = userWatchlist.find(
                (item) => item.user_id === user?.id && matchesMovie(item),
            );

            if (!entry) {
                console.error("Watchlist entry not found for deletion.");
                return;
            }

            // Remove the queue entry first so the watchlist delete isn't blocked
            // by the queue's foreign key reference.
            const queueEntry = watchlistQueue.find(q => q.watchlist_id === entry.id);
            if (queueEntry) await removeFromQueue(queueEntry.id);

            const { error } = await supabase
                .from("watchlist")
                .delete()
                .eq('id', entry.id)
                .select();


            if (error) {
                console.error(error);
                return;
            }

            removeWatchlist(entry.id);
        }
    }

    return(
        <div className="white-highlight">
            <img src={onWatchlist?"/images/on-watchlist.png":"/images/noton-watchlist.png"} className="addlog-icon addlog-watchlist-icon" onClick={onClick}></img>
        </div>
    );

};

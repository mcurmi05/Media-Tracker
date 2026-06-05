import "../styles/AddLog.css"
import { supabase } from "../services/supabase-client"; 
import { useAuth } from "../contexts/AuthContext";  
import { useNavigate } from "react-router-dom";
import { getMovieById } from "../services/api";
import { useWatchlist } from "../contexts/UserWatchlistContext";
import { useState, useEffect } from "react";

export default function AddWatchlist({movie, needMoreDetail}){

    const {user, isAuthenticated} = useAuth();
    const navigate = useNavigate();
    const {addWatchlist, removeWatchlist, userWatchlist, watchlistQueue, removeFromQueue} = useWatchlist();
    const [onWatchlist, setOnWatchlist] = useState(false);

    useEffect(() => {
        if (userWatchlist) {
            const found = userWatchlist.some(item => item.movie_object.id === movie.id && item.user_id === user.id);
            setOnWatchlist(found);
        }
    }, [userWatchlist, movie, isAuthenticated, user]);

    async function onClick(){

        if (!onWatchlist){

            if (!isAuthenticated) {
                navigate("/signin");
            } else{

                setOnWatchlist(true);
                if(needMoreDetail){
                    movie = await getMovieById(movie.id);
                }
                const { data, error } = await supabase
                .from("watchlist")
                .insert(
                    {
                        user_id: user.id,
                        movie_object: movie,
                        movie_id: movie.id
                    })
                    .select();
                const newWatchlistEntry = data[0];
                addWatchlist(newWatchlistEntry.id, movie);
                
                if (error) {
                    console.error(error);
                }
            }
        
        } else if (onWatchlist) {
            setOnWatchlist(false);
            const entry = userWatchlist.find(item => item.movie_object.id === movie.id && item.user_id === user.id);

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
            <img src={onWatchlist?"/on-watchlist.png":"/noton-watchlist.png"} className="addlog-icon" onClick={onClick}></img>
        </div>
    );

};
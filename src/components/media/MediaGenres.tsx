import "../../styles/media/MediaGenres.css"

function MediaGenres({movie}){
    const genres = movie.interests;

    return(
        <div className="genres-container">
            {genres.map((genre, index) => (
                <div key={index} className="genre-tag">
                    {genre}
                </div>
            ))}
        </div>
    );
    
}

export default MediaGenres;
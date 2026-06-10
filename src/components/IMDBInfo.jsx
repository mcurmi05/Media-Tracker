import { useImdbRating } from "../contexts/ImdbRatingsContext";

function IMDBInfo({ movie }) {
  // Live rating from the daily-synced dataset; falls back to whatever was
  // stored on the movie object while it loads or if the title isn't listed.
  const live = useImdbRating(movie?.id);
  const rating = live?.rating ?? movie.averageRating;
  const votes = live?.votes ?? movie.numVotes;

  const formatVotes = (v) => {
    if (!v) return "0";

    if (v >= 1000000) {
      return "(" + (v / 1000000).toFixed(1) + "M)";
    } else if (v >= 1000) {
      return "(" + (v / 1000).toFixed(0) + "K)";
    } else {
      return "(" + v.toString() + ")";
    }
  };

  return (
    <a href={movie.url} target="_blank" className="imdb-rating">
      <img src="/imdbicon.png" className="imdb-movie-card " />
      <img src="/staricon.png" className="star-movie-card" />
      <p style={{ whiteSpace: "nowrap" }}>
        {rating != null ? Number(rating).toFixed(1) : "No ratings yet"}{" "}
        {votes ? formatVotes(votes) : null}
      </p>
    </a>
  );
}
export default IMDBInfo;

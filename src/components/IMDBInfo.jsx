import { useImdbRating } from "../contexts/ImdbRatingsContext";

function IMDBInfo({ movie, useLiveRating = false }) {
  // Live rating from the daily-synced dataset, used on the media details page
  // and the log/watchlist/ratings lists. Trending/search cards leave this off
  // and keep the rating that came back with the RapidAPI movie object.
  // Passing undefined to the hook makes it a no-op (no request, no override).
  const live = useImdbRating(useLiveRating ? movie?.id : undefined);
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
      <p style={{ whiteSpace: "nowrap", fontWeight: 400, fontFamily: "inherit" }}>
        {rating != null ? Number(rating).toFixed(1) : "No ratings yet"}{" "}
        {votes ? formatVotes(votes) : null}
      </p>
    </a>
  );
}
export default IMDBInfo;

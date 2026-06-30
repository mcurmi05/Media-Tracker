import "../../styles/media/LetterboxdInfo.css";
import { useLetterboxdRating } from "../../contexts/LetterboxdRatingsContext";

// Live Letterboxd rating (native 0–5 scale), served from the daily-synced
// `letterboxd_ratings` cache keyed by tmdb_id. Pass `live` on the media details
// page to also trigger a fresh on-demand scrape for that one title.
//
// Renders nothing until the batched lookup resolves; shows "No ratings yet"
// when the title has no Letterboxd rating.
function LetterboxdInfo({ movie, live = false }) {
  const tmdbId = movie?.tmdb_id;
  const data = useLetterboxdRating(tmdbId ?? undefined, { live });

  // tv / missing id: nothing to show.
  if (tmdbId == null || movie?.media_type === "tv") return null;

  const isLoading = data === undefined;
  const rating = data?.rating ?? null;
  const slug = data?.slug ?? null;
  const href = slug
    ? `https://letterboxd.com/film/${slug}/`
    : `https://letterboxd.com/tmdb/${tmdbId}/`;

  const formatCount = (v) => {
    if (!v) return null;
    if (v >= 1000000) return "(" + (v / 1000000).toFixed(1) + "M)";
    if (v >= 1000) return "(" + (v / 1000).toFixed(0) + "K)";
    return "(" + v + ")";
  };
  const count = data?.ratingCount ?? null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="letterboxd-rating"
      title="Letterboxd rating (out of 5)"
    >
      <img
        src="/images/letterboxdicon.png"
        className="letterboxd-movie-card"
        alt="Letterboxd"
      />
      <img src="/images/staricon.png" className="star-movie-card letterboxd-star" alt="" />
      <p
        style={{
          whiteSpace: "nowrap",
          fontWeight: 400,
          fontFamily: "inherit",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 350ms ease-out",
        }}
      >
        {rating != null
          ? Number(rating).toFixed(1)
          : isLoading
            ? ""
            : "No ratings yet"}{" "}
        {count ? formatCount(count) : null}
      </p>
    </a>
  );
}

export default LetterboxdInfo;

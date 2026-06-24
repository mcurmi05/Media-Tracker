import "../styles/GoodreadsInfo.css";
import { useGoodreadsRating } from "../contexts/GoodreadsRatingsContext";
import { goodreadsId } from "../utils/goodreads";

// Live Goodreads rating (native 0–5 scale), served from the daily-synced
// `goodreads_ratings` cache keyed by the numeric Goodreads book id. Pass `live`
// on the book details page to also trigger a fresh on-demand scrape for that
// one title.
//
// Renders nothing until the batched lookup resolves; shows "No ratings yet"
// when the book has no Goodreads rating. This is the books twin of
// LetterboxdInfo.
function GoodreadsInfo({ book, live = false }) {
  const link = book?.goodreads_link || null;
  const id = goodreadsId(link);
  const data = useGoodreadsRating(id ?? undefined, { live });

  // No usable Goodreads id: nothing to show.
  if (id == null) return null;

  const isLoading = data === undefined;
  const rating = data?.rating ?? null;
  const href = link || `https://www.goodreads.com/book/show/${id}`;

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
      className="goodreads-rating"
      title="Goodreads rating (out of 5)"
    >
      <img src="/goodreads.png" className="goodreads-movie-card" alt="Goodreads" />
      <span className="star-movie-card goodreads-star" aria-hidden="true" />
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
          ? Number(rating).toFixed(2)
          : isLoading
            ? ""
            : "No ratings yet"}{" "}
        {count ? formatCount(count) : null}
      </p>
    </a>
  );
}

export default GoodreadsInfo;

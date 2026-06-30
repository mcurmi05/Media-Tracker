import { useStorygraphRating } from "./StorygraphRatingsContext";
import "./StorygraphInfo.css";

function formatCount(value) {
  if (!value) return null;
  if (value >= 1000000) return `(${(value / 1000000).toFixed(1)}M)`;
  if (value >= 1000) return `(${(value / 1000).toFixed(0)}K)`;
  return `(${value})`;
}

export default function StorygraphInfo({ book, live = false }) {
  const hardcoverId =
    book?.hardcover_id || book?.book_entries?.hardcover_id || null;
  const data = useStorygraphRating(hardcoverId, { live });
  if (!hardcoverId) return null;
  const isLoading = data === undefined;
  const slug =
    data?.slug ||
    book?.storygraph_slug ||
    book?.book_entries?.storygraph_slug ||
    null;
  const isbn13 = book?.isbn13 || book?.book_entries?.isbn13 || null;
  const href = slug
    ? `https://app.thestorygraph.com/books/${slug}`
    : isbn13
      ? `https://app.thestorygraph.com/search?search_term=${encodeURIComponent(isbn13)}`
      : undefined;

  return (
    <a
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      className="storygraph-rating"
      title="StoryGraph rating out of 5"
      aria-disabled={!href}
    >
      <img
        src="/images/storygraph.png"
        className="storygraph-movie-card"
        alt="StoryGraph"
      />
      <span className="star-movie-card storygraph-star" aria-hidden="true" />
      <p
        style={{ opacity: isLoading ? 0 : 1 }}
      >
        {data?.rating != null
          ? Number(data.rating).toFixed(2)
          : isLoading
            ? ""
            : "No ratings yet"}{" "}
        {formatCount(data?.ratingCount)}
      </p>
    </a>
  );
}

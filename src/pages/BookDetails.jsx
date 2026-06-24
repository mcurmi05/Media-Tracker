import { useParams, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  getBookEntryByGoodreadsPath,
  updateBookEntry,
} from "../services/ratingsfromtable.js";
import {
  goodreadsUrlFromPath,
  goodreadsId,
  parseBookTitle,
} from "../utils/goodreads.js";
import { useBookRatings } from "../contexts/UserBookRatingsContext.jsx";
import { useGoodreadsRating } from "../contexts/GoodreadsRatingsContext.jsx";
import BookRatingStar from "../components/BookRatingStar.jsx";
import AddBookWatchlist from "../components/AddBookWatchlist.jsx";
import AddBookLogButton from "../components/AddBookLogButton.jsx";
import AddToList from "../components/AddToList.jsx";
import EditBookInfoModal from "../components/EditBookInfoModal.jsx";
import Loader, { Spinner } from "../components/Loader.jsx";
import "../styles/BookDetails.css";

const GOODREADS_ICON =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVWGYFkKfh28rOYSP6XPkZgf3Cya8tsWasxA&s";

// Compact ratings count, matching the movie page (e.g. 540600 -> "(541K)").
function formatRatingsCount(n) {
  if (!n) return "";
  if (n >= 1000000) return "(" + (n / 1000000).toFixed(1) + "M)";
  if (n >= 1000) return "(" + (n / 1000).toFixed(0) + "K)";
  return "(" + n + ")";
}

// Gradient medal badge for the book's ranking, matching the Ratings page.
function rankBadgeStyle(rank) {
  const background =
    rank === 1
      ? "linear-gradient(135deg,#FFD700,#E6C200)"
      : rank === 2
        ? "linear-gradient(135deg,#C0C0C0,#A9A9A9)"
        : rank === 3
          ? "linear-gradient(135deg,#CD7F32,#B87333)"
          : "#444";
  return {
    background,
    color: rank ? "#000" : "#fff",
    borderRadius: 10,
    padding: "2px 8px",
    fontSize: "0.85rem",
    minWidth: 42,
    textAlign: "center",
  };
}

export default function BookDetails() {
  // The route uses the Goodreads URL path as its identifier (splat param).
  const splat = useParams()["*"] || "";
  const location = useLocation();
  // A book object may be passed via router state for an instant first paint.
  const seedBook = location.state?.book || null;
  const goodreadsUrl = goodreadsUrlFromPath(splat);

  const { findRatingForBook } = useBookRatings();

  // Goodreads rating from the daily-synced cache, with a live on-demand scrape
  // for this one book (mirrors how the movie details page uses Letterboxd).
  const grId = goodreadsId(goodreadsUrl);
  const grData = useGoodreadsRating(grId ?? undefined, { live: true });

  const [dbEntry, setDbEntry] = useState(null);
  const [scrape, setScrape] = useState(null);
  const [scrapeLoading, setScrapeLoading] = useState(true);
  const [scrapeError, setScrapeError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [coverHeight, setCoverHeight] = useState(null);
  const [titleInline, setTitleInline] = useState(false);
  const persistedRef = useRef(false);
  const coverRef = useRef(null);
  const titleRef = useRef(null);
  const rightRef = useRef(null);

  // Track the cover's rendered height so the right column (and the
  // description inside it) can be capped to end level with the cover.
  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    const measure = () => setCoverHeight(el.offsetHeight || null);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Authoritative book_entries row: source of the stored description and the
  // id we persist a freshly scraped description back to.
  useEffect(() => {
    let cancelled = false;
    persistedRef.current = false;
    setDbEntry(null);
    (async () => {
      try {
        const row = await getBookEntryByGoodreadsPath(splat);
        if (!cancelled) setDbEntry(row);
      } catch (err) {
        console.error("Failed to load book entry:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [splat]);

  // Always scrape Goodreads so the rating and ratings count are up to date.
  useEffect(() => {
    let cancelled = false;
    setScrape(null);
    setScrapeError(false);
    setScrapeLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/goodreads?url=${encodeURIComponent(goodreadsUrl)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Request failed");
        if (!cancelled) setScrape(data);
      } catch (err) {
        console.error("Failed to scrape Goodreads:", err);
        if (!cancelled) setScrapeError(true);
      } finally {
        if (!cancelled) setScrapeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goodreadsUrl]);

  // When the stored description is empty, save the scraped one back to the
  // database so future visits don't have to scrape it again.
  useEffect(() => {
    if (persistedRef.current) return;
    if (!dbEntry?.id || dbEntry.book_description) return;
    const scraped = scrape?.description;
    if (!scraped) return;
    persistedRef.current = true;
    updateBookEntry(dbEntry.id, { book_description: scraped })
      .then(() =>
        setDbEntry((prev) =>
          prev ? { ...prev, book_description: scraped } : prev,
        ),
      )
      .catch((err) => console.error("Failed to save book description:", err));
  }, [dbEntry, scrape]);

  const meta = dbEntry || seedBook || {};
  // The book_entries-shaped row the action buttons operate on.
  const bookObj = dbEntry || seedBook || null;
  const title = meta.title || scrape?.title || "";
  const { mainTitle, seriesName, seriesIndex } = parseBookTitle(title);
  const author = meta.author || scrape?.author || "";
  const cover =
    meta.cover_image || scrape?.cover_image || "/placeholderimage.jpg";
  const releaseYear = meta.release_year || scrape?.release_year || null;
  const description = meta.book_description || scrape?.description || "";
  // Rating comes from the cache/live context; fall back to the page scrape
  // (which we still run for the description) until the cache resolves.
  const ratingLoading = grData === undefined;
  const rating = grData?.rating ?? scrape?.rating ?? null;
  const ratingsCount = grData?.ratingCount ?? scrape?.ratings_count ?? null;
  const ranking = bookObj ? findRatingForBook(bookObj)?.ranking ?? null : null;

  // Decide whether the action buttons sit on the title's line: only when the
  // title fits on a single line at the full column width. A long (wrapping)
  // title pushes the actions onto their own row below the series.
  useEffect(() => {
    const titleEl = titleRef.current;
    const containerEl = rightRef.current;
    if (!titleEl || !containerEl) return;
    const measure = () => {
      const prev = titleEl.style.whiteSpace;
      titleEl.style.whiteSpace = "nowrap";
      const needed = titleEl.scrollWidth;
      titleEl.style.whiteSpace = prev;
      setTitleInline(needed <= containerEl.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [mainTitle]);

  const haveAnything = dbEntry || seedBook || scrape;

  if (!haveAnything && scrapeLoading) {
    return <Loader />;
  }
  if (!haveAnything && scrapeError) {
    return <div className="error">Couldn't load this book.</div>;
  }

  const actionsEl = bookObj ? (
    <div className="bd-actions">
      <BookRatingStar book={bookObj} />
      <div className="bd-action-buttons">
        <AddBookWatchlist book={bookObj} />
        <AddBookLogButton book={bookObj} />
        <AddToList book={bookObj} />
        <div
          className="white-highlight"
          onClick={() => setShowEditModal(true)}
          title="Edit book information"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/pencil.png"
            alt="Edit"
            style={{
              width: "18px",
              height: "18px",
              filter: "saturate(1.5) brightness(1.3)",
            }}
          />
        </div>
      </div>
      {ranking != null && (
        <span
          className="bd-rank"
          style={rankBadgeStyle(ranking)}
          title={`Ranked #${ranking}`}
        >
          #{ranking}
        </span>
      )}
    </div>
  ) : null;

  return (
    <div className="bd-page">
      <div className="bd-card">
        <div className="bd-main">
          <img
            className="bd-cover"
            ref={coverRef}
            src={cover}
            alt={mainTitle}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholderimage.jpg";
            }}
          />

          <div
            className="bd-right"
            ref={rightRef}
            style={coverHeight ? { maxHeight: `${coverHeight}px` } : undefined}
          >
            <div className={`bd-head${titleInline ? " bd-head-inline" : ""}`}>
              <h1 ref={titleRef} className="bd-title">
                {mainTitle || "Book"}
              </h1>
              {titleInline && actionsEl}
            </div>

            {seriesName && (
              <div className="bd-series">
                {seriesName} #{seriesIndex}
              </div>
            )}

            {!titleInline && actionsEl}

            <div className="bd-meta">
              {(releaseYear || author) && (
                <span className="bd-meta-text">
                  {releaseYear || ""}
                  {releaseYear && author ? " · " : ""}
                  {author}
                  {author ? " · " : ""}
                </span>
              )}

              {goodreadsUrl && (
                <a
                  className="bd-gr-link"
                  href={goodreadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Goodreads"
                >
                  <img src={GOODREADS_ICON} alt="Goodreads" />
                </a>
              )}

              {rating == null && ratingLoading ? (
                <span className="bd-muted">Fetching rating...</span>
              ) : rating != null ? (
                <a
                  className="bd-gr-rating"
                  href={goodreadsUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Goodreads"
                >
                  <span className="bd-rating-star">&#9733;</span>
                  {Number(rating).toFixed(2)}
                  {ratingsCount != null && (
                    <span className="bd-rating-count">
                      {formatRatingsCount(ratingsCount)}
                    </span>
                  )}
                </a>
              ) : null}
            </div>

            <p className="bd-description">
              {description ||
                (scrapeLoading ? <Spinner /> : "No description available.")}
            </p>
          </div>
        </div>

        {bookObj && (
          <EditBookInfoModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            row={bookObj}
            onUpdated={(merged) =>
              setDbEntry((prev) => ({ ...(prev || {}), ...merged }))
            }
          />
        )}
      </div>
    </div>
  );
}

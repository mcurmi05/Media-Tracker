import { useParams, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  getBookEntryByGoodreadsPath,
  getBookEntryByHardcoverId,
  updateBookEntry,
} from "../services/ratingsfromtable.js";
import {
  getBookByHardcoverId,
  searchBooksHardcover,
} from "../services/api.js";
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

function formatRatingsCount(n) {
  if (!n) return "";
  if (n >= 1000000) return "(" + (n / 1000000).toFixed(1) + "M)";
  if (n >= 1000) return "(" + (n / 1000).toFixed(0) + "K)";
  return "(" + n + ")";
}

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

function normalizeIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hardcoverEntryUpdates(book) {
  return {
    hardcover_id: String(book.hardcover_id),
    isbn13: book.isbn13 || null,
    title: book.title || "",
    author: book.author || "",
    cover_image: book.cover_image || null,
    release_year: book.release_year || null,
    book_description: book.description || book.book_description || null,
  };
}

export default function BookDetails() {
  const params = useParams();
  const hardcoverId = params.hardcoverId || null;
  const splat = params["*"] || "";
  const isHardcover = Boolean(hardcoverId);
  const location = useLocation();
  const seedBook = location.state?.book || null;
  const legacyGoodreadsUrl = isHardcover
    ? null
    : goodreadsUrlFromPath(splat);
  const { findRatingForBook } = useBookRatings();

  const [dbEntry, setDbEntry] = useState(null);
  const [remoteBook, setRemoteBook] = useState(seedBook);
  const [scrape, setScrape] = useState(null);
  const [metadataLoading, setMetadataLoading] = useState(isHardcover);
  const [metadataError, setMetadataError] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(!isHardcover);
  const [scrapeError, setScrapeError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [coverHeight, setCoverHeight] = useState(null);
  const [titleInline, setTitleInline] = useState(false);
  const persistedRef = useRef(false);
  const coverRef = useRef(null);
  const titleRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    const element = coverRef.current;
    if (!element) return;
    const measure = () => setCoverHeight(element.offsetHeight || null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [remoteBook, scrape]);

  useEffect(() => {
    let cancelled = false;
    persistedRef.current = false;
    setDbEntry(null);
    const load = async () => {
      try {
        const row = isHardcover
          ? await getBookEntryByHardcoverId(hardcoverId)
          : await getBookEntryByGoodreadsPath(splat);
        if (!cancelled) setDbEntry(row);
      } catch (error) {
        console.error("Failed to load book entry:", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [hardcoverId, isHardcover, splat]);

  useEffect(() => {
    if (isHardcover || !dbEntry?.id || dbEntry.hardcover_id) return;
    let cancelled = false;
    const resolve = async () => {
      try {
        const query =
          dbEntry.isbn13 || `${dbEntry.title || ""} ${dbEntry.author || ""}`;
        const results = await searchBooksHardcover(query.trim());
        const title = normalizeIdentity(dbEntry.title);
        const author = normalizeIdentity(dbEntry.author);
        const match = results.find((book) => {
          if (
            dbEntry.isbn13 &&
            String(book.isbn13 || "") === String(dbEntry.isbn13)
          ) {
            return true;
          }
          const bookTitle = normalizeIdentity(book.title);
          const bookAuthor = normalizeIdentity(book.author);
          return (
            title &&
            bookTitle === title &&
            (!author ||
              bookAuthor === author ||
              bookAuthor.includes(author) ||
              author.includes(bookAuthor))
          );
        });
        if (!match || cancelled) return;
        const updated = await updateBookEntry(
          dbEntry.id,
          hardcoverEntryUpdates(match),
        );
        if (!cancelled) setDbEntry(updated || { ...dbEntry, ...match });
      } catch (error) {
        console.error("Failed to resolve legacy book on Hardcover:", error);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [dbEntry, isHardcover]);

  const resolvedHardcoverId = hardcoverId || dbEntry?.hardcover_id || null;

  useEffect(() => {
    if (!resolvedHardcoverId) return;
    let cancelled = false;
    setMetadataLoading(true);
    setMetadataError(false);
    getBookByHardcoverId(resolvedHardcoverId)
      .then(async (book) => {
        if (cancelled) return;
        setRemoteBook(book);
        if (dbEntry?.id) {
          const updated = await updateBookEntry(
            dbEntry.id,
            hardcoverEntryUpdates(book),
          );
          if (!cancelled && updated) setDbEntry(updated);
        }
      })
      .catch((error) => {
        console.error("Failed to load Hardcover book:", error);
        if (!cancelled) setMetadataError(true);
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbEntry?.id, resolvedHardcoverId]);

  useEffect(() => {
    if (isHardcover || !legacyGoodreadsUrl) {
      setScrapeLoading(false);
      return;
    }
    let cancelled = false;
    setScrape(null);
    setScrapeError(false);
    setScrapeLoading(true);
    fetch(`/api/goodreads?url=${encodeURIComponent(legacyGoodreadsUrl)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Request failed");
        if (!cancelled) setScrape(data);
      })
      .catch((error) => {
        console.error("Failed to scrape Goodreads:", error);
        if (!cancelled) setScrapeError(true);
      })
      .finally(() => {
        if (!cancelled) setScrapeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isHardcover, legacyGoodreadsUrl]);

  useEffect(() => {
    if (persistedRef.current) return;
    if (!dbEntry?.id || dbEntry.book_description) return;
    if (!scrape?.description) return;
    persistedRef.current = true;
    updateBookEntry(dbEntry.id, { book_description: scrape.description })
      .then(() =>
        setDbEntry((previous) =>
          previous
            ? { ...previous, book_description: scrape.description }
            : previous,
        ),
      )
      .catch((error) =>
        console.error("Failed to save book description:", error),
      );
  }, [dbEntry, scrape]);

  const meta = dbEntry || remoteBook || seedBook || scrape || {};
  const bookObj = dbEntry || remoteBook || seedBook || null;
  const title = meta.title || scrape?.title || "";
  const { mainTitle, seriesName, seriesIndex } = parseBookTitle(title);
  const author = meta.author || scrape?.author || "";
  const cover =
    meta.cover_image || scrape?.cover_image || "/placeholderimage.jpg";
  const releaseYear = meta.release_year || scrape?.release_year || null;
  const description =
    meta.book_description || meta.description || scrape?.description || "";
  const grId =
    Number(meta.goodreads_id) ||
    goodreadsId(meta.goodreads_link || legacyGoodreadsUrl) ||
    null;
  const grData = useGoodreadsRating(grId ?? undefined, { live: true });
  const goodreadsUrl =
    meta.goodreads_link ||
    (grId ? `https://www.goodreads.com/book/show/${grId}` : null);
  const ratingLoading = grId != null && grData === undefined;
  const rating = grData?.rating ?? scrape?.rating ?? null;
  const ratingsCount = grData?.ratingCount ?? scrape?.ratings_count ?? null;
  const ranking = bookObj ? findRatingForBook(bookObj)?.ranking ?? null : null;

  useEffect(() => {
    const titleElement = titleRef.current;
    const containerElement = rightRef.current;
    if (!titleElement || !containerElement) return;
    const measure = () => {
      const previous = titleElement.style.whiteSpace;
      titleElement.style.whiteSpace = "nowrap";
      const needed = titleElement.scrollWidth;
      titleElement.style.whiteSpace = previous;
      setTitleInline(needed <= containerElement.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerElement);
    return () => observer.disconnect();
  }, [mainTitle]);

  const haveAnything = dbEntry || remoteBook || seedBook || scrape;
  if (!haveAnything && (metadataLoading || scrapeLoading)) return <Loader />;
  if (
    !haveAnything &&
    (metadataError || scrapeError) &&
    !metadataLoading &&
    !scrapeLoading
  ) {
    return <div className="error">Couldn't load this book.</div>;
  }

  const actionsElement = bookObj ? (
    <div className="bd-actions">
      <BookRatingStar book={bookObj} />
      <div className="bd-action-buttons">
        <AddBookWatchlist book={bookObj} />
        <AddBookLogButton book={bookObj} />
        <AddToList book={bookObj} />
        {dbEntry ? (
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
        ) : null}
      </div>
      {ranking != null ? (
        <span
          className="bd-rank"
          style={rankBadgeStyle(ranking)}
          title={`Ranked #${ranking}`}
        >
          #{ranking}
        </span>
      ) : null}
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
            onError={(event) => {
              event.target.onerror = null;
              event.target.src = "/placeholderimage.jpg";
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
              {titleInline ? actionsElement : null}
            </div>

            {seriesName ? (
              <div className="bd-series">
                {seriesName} #{seriesIndex}
              </div>
            ) : null}

            {!titleInline ? actionsElement : null}

            <div className="bd-meta">
              {releaseYear || author ? (
                <span className="bd-meta-text">
                  {releaseYear || ""}
                  {releaseYear && author ? " · " : ""}
                  {author}
                  {author ? " · " : ""}
                </span>
              ) : null}

              {rating == null && ratingLoading ? (
                <span className="bd-muted">Fetching rating...</span>
              ) : rating != null && goodreadsUrl ? (
                <a
                  className="bd-gr-rating"
                  href={goodreadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Goodreads"
                >
                  <span className="bd-rating-star">&#9733;</span>
                  {Number(rating).toFixed(2)}
                  {ratingsCount != null ? (
                    <span className="bd-rating-count">
                      {formatRatingsCount(ratingsCount)}
                    </span>
                  ) : null}
                </a>
              ) : null}
            </div>

            <p className="bd-description">
              {description ||
                (metadataLoading || scrapeLoading ? (
                  <Spinner />
                ) : (
                  "No description available."
                ))}
            </p>
          </div>
        </div>

        {dbEntry ? (
          <EditBookInfoModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            row={dbEntry}
            onUpdated={(merged) =>
              setDbEntry((previous) => ({ ...(previous || {}), ...merged }))
            }
          />
        ) : null}
      </div>
    </div>
  );
}

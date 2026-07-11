// Builds the "universe" magic lists draw from: every movie/TV title and book
// the user has logged, rated or watchlisted/TBR'd, de-duped, with the fields
// the rule engine filters on. This is what keeps magic lists bounded — they
// can only ever contain titles already in the user's library.

import { useMemo } from "react";
import { useLogs } from "../contexts/UserLogsContext";
import { useRatings } from "../contexts/UserRatingsContext";
import { useWatchlist } from "../contexts/UserWatchlistContext";
import { useBookLogs } from "../contexts/UserBookLogsContext";
import { useBookRatings } from "../contexts/UserBookRatingsContext";
import { useBookTbr } from "../contexts/UserBookTbrContext";
import { useImdbRatings } from "../contexts/ImdbRatingsContext";
import { useLetterboxdRatings } from "../contexts/LetterboxdRatingsContext";
import { useGoodreadsRatings } from "../contexts/GoodreadsRatingsContext";
import {
  isTV,
  imdbRatingFor,
  letterboxdRatingFor,
  goodreadsRatingFor,
} from "../utils/mediaFilters";
import { getBookInfo } from "../utils/bookInfo";

export function useMagicLibrary() {
  const { userLogs, userLogsLoaded } = useLogs();
  const { userRatings, userRatingsLoaded } = useRatings();
  const { userWatchlist, userWatchlistLoaded } = useWatchlist();
  const { bookLogs, bookLogsLoaded } = useBookLogs();
  const { bookRatings, bookRatingsLoaded } = useBookRatings();
  const { userBookTbr, userBookTbrLoaded } = useBookTbr();
  const { ratings: imdbTable } = useImdbRatings();
  const { ratings: lbTable } = useLetterboxdRatings();
  const { ratings: grTable } = useGoodreadsRatings();

  const ready =
    userLogsLoaded &&
    userRatingsLoaded &&
    userWatchlistLoaded &&
    bookLogsLoaded &&
    bookRatingsLoaded &&
    userBookTbrLoaded;

  const universe = useMemo(() => {
    // movies/tv keyed by media_type:tmdb_id, books by hardcover/goodreads/title
    const map = new Map();

    const upsertMovie = (mo, flag, myRating = null) => {
      if (!mo || mo.tmdb_id == null) return;
      const key = `${mo.media_type}:${mo.tmdb_id}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          kind: isTV(mo) ? "tv" : "movie",
          mo,
          book: null,
          title: mo.primaryTitle || "",
          flags: { logged: false, rated: false, watchlisted: false },
          myRating: null,
          imdb: imdbRatingFor(imdbTable, mo),
          letterboxd: letterboxdRatingFor(lbTable, mo),
          goodreads: null,
          year: Number(mo.startYear) || null,
          directors: [
            ...(mo.directors || []),
            ...(mo.creators || []),
          ].map((p) => ({ name: p?.fullName || "", id: p?.person_id ?? null })),
          cast: (mo.cast || []).map((p) => ({
            name: p?.fullName || "",
            id: p?.person_id ?? null,
          })),
          author: null,
          genres: mo.interests || [],
        };
        map.set(key, entry);
      } else if ((mo.cast || []).length > (entry.mo.cast || []).length) {
        // Prefer the richest movie_object we've seen (logs/ratings store the
        // full one; watchlist rows can be slimmer) — and recompute the fields
        // derived from it.
        entry.mo = mo;
        entry.imdb = imdbRatingFor(imdbTable, mo);
        entry.letterboxd = letterboxdRatingFor(lbTable, mo);
        entry.directors = [...(mo.directors || []), ...(mo.creators || [])].map(
          (p) => ({ name: p?.fullName || "", id: p?.person_id ?? null }),
        );
        entry.cast = (mo.cast || []).map((p) => ({
          name: p?.fullName || "",
          id: p?.person_id ?? null,
        }));
        entry.genres = mo.interests || [];
      }
      entry.flags[flag] = true;
      if (myRating != null) entry.myRating = Number(myRating);
    };

    const upsertBook = (row, flag, myRating = null) => {
      const b = getBookInfo(row);
      if (!b.title) return;
      const key = `book:${b.hardcover_id || b.goodreads_link || `${b.title}:${b.author}`}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          kind: "book",
          mo: null,
          book: row.book_entries || b,
          title: b.title,
          flags: { logged: false, rated: false, watchlisted: false },
          myRating: null,
          imdb: null,
          letterboxd: null,
          goodreads: goodreadsRatingFor(grTable, row),
          year: Number(b.release_year) || null,
          directors: [],
          cast: [],
          author: b.author || null,
          genres: [],
        };
        map.set(key, entry);
      }
      entry.flags[flag] = true;
      if (myRating != null) entry.myRating = Number(myRating);
    };

    userLogs.forEach((l) => upsertMovie(l.movie_object, "logged"));
    userRatings.forEach((r) => upsertMovie(r.movie_object, "rated", r.rating));
    userWatchlist.forEach((w) => upsertMovie(w.movie_object, "watchlisted"));
    bookLogs.forEach((l) => upsertBook(l, "logged"));
    bookRatings.forEach((r) => upsertBook(r, "rated", r.book_rating));
    userBookTbr.forEach((t) => upsertBook(t, "watchlisted"));

    return Array.from(map.values());
  }, [
    userLogs,
    userRatings,
    userWatchlist,
    bookLogs,
    bookRatings,
    userBookTbr,
    imdbTable,
    lbTable,
    grTable,
  ]);

  return { universe, ready };
}

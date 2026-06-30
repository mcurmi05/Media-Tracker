//shared filter + sort helpers for the ratings, watchlist and log pages
//these used to be copy-pasted in each page, now they live here
import { goodreadsId } from "./goodreads";

//tv check based on whatever tmdb gave us
export function isTV(mo) {
  const type = (mo?.type || "").toLowerCase();
  const titleType = (mo?.titleType || "").toLowerCase();
  return type.includes("tv") || titleType.includes("tv") || !!mo?.episodes;
}

export function movieYear(item) {
  const y = Number(item.movie_object?.startYear);
  return Number.isFinite(y) && y > 0 ? y : null;
}

export function bookYear(item) {
  const y = Number(item.book_entries?.release_year ?? item.release_year);
  return Number.isFinite(y) && y > 0 ? y : null;
}

//nulls sink to the bottom no matter the direction
export function compareNums(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

export function yearInRange(y, from, to) {
  if (!from && !to) return true;
  if (y == null) return false;
  if (from) {
    const n = Number(from);
    if (Number.isFinite(n) && y < n) return false;
  }
  if (to) {
    const n = Number(to);
    if (Number.isFinite(n) && y > n) return false;
  }
  return true;
}

//string compare works here since both sides are yyyy-mm-dd
export function addedInRange(dateStr, from, to) {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const ymd = String(dateStr).slice(0, 10);
  if (!ymd) return false;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}

//live imdb value, falls back to whats stored on the movie object
//until the dataset value loads. books have no imdb so they return null
export function imdbRatingFor(table, mo) {
  const v = table[mo?.id]?.rating ?? mo?.averageRating;
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

export function imdbVotesFor(table, mo) {
  const v = table[mo?.id]?.votes ?? mo?.numVotes;
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

//live letterboxd value, keyed by tmdb_id. movies only; tv/books return null
export function letterboxdRatingFor(table, mo) {
  const v = table[mo?.tmdb_id]?.rating;
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

export function letterboxdCountFor(table, mo) {
  const v = table[mo?.tmdb_id]?.ratingCount;
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

//live goodreads value, keyed by the numeric goodreads book id parsed from the
//book's link. books only; movies/tv have no goodreads link so they return
//null (which compareNums sinks to the bottom regardless of sort direction)
function goodreadsLinkOf(row) {
  return row?.book_entries?.goodreads_link ?? row?.goodreads_link ?? null;
}

export function goodreadsRatingFor(table, row) {
  const id = goodreadsId(goodreadsLinkOf(row));
  const v = id == null ? null : table[id]?.rating;
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

export function goodreadsCountFor(table, row) {
  const id = goodreadsId(goodreadsLinkOf(row));
  const v = id == null ? null : table[id]?.ratingCount;
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

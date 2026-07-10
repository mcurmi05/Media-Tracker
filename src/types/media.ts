export type MediaType = "movie" | "tv";
export type SearchMode = "all" | "books" | "movies" | "tv";

export interface NormalizedBook {
  hardcover_id: string;
  title: string;
  author: string;
  cover_image: string | null;
  release_year: number | null;
  isbn13: string | null;
  slug: string | null;
  description: string;
  book_description: string;
  rating: number | null;
  hardcover_url: string | null;
  goodreads_id: number | null;
  goodreads_link: string | null;
  storygraph_slug?: string | null;
  users_count?: number;
  id?: string;
}

export interface NormalizedMediaListItem {
  tmdb_id: number;
  media_type: MediaType;
  id: string | null;
  primaryTitle: string;
  primaryImage: string | null;
  backdropImage: string | null;
  startYear: number | null;
  type: "movie" | "tvSeries";
  titleType: "movie" | "tvSeries";
  averageRating: number | null;
  numVotes: number | null;
  description: string;
}

export type SearchResult = NormalizedBook | NormalizedMediaListItem;

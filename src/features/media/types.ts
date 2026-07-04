// Types for the unified media schema (supabase/migrations/0001_unified_media.sql).

export type MediaType = "movie" | "tv" | "book" | "game";

// Type-specific metadata payload stored in media_entries.details.
export interface MediaDetails {
  runtime_minutes?: number;
  trailer_url?: string;
  budget?: number;
  tmdb_vote_average?: number;
  tmdb_vote_count?: number;
  genres?: string[];
  cast_members?: { name: string; character?: string; profile_url?: string }[];
  directors?: string[];
  writers?: string[];
  creators?: string[];
  // tv: per-season metadata from TMDB
  season_info?: unknown[];
}

export interface MediaEntry {
  id: string;
  media_type: MediaType;
  title: string;
  creator: string | null;
  cover_url: string | null;
  backdrop_url: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  hardcover_id: string | null;
  isbn13: string | null;
  goodreads_id: number | null;
  goodreads_link: string | null;
  storygraph_slug: string | null;
  igdb_id: number | null;
  details: MediaDetails;
  created_at: string;
  updated_at: string;
}

// One logged season of a TV show inside user_logs.season_info.
export interface SeasonLog {
  season: number;
  start_date: string | null;
  end_date: string | null;
  finished: boolean;
  finished_at: string | null;
  dnf?: boolean;
  created_at?: string;
}

export interface UserLog {
  id: string;
  user_id: string;
  entry_id: string;
  log: string | null;
  started_at: string | null;
  ended_at: string | null;
  dnf: boolean;
  multi_day: boolean;
  season_info: SeasonLog[] | null;
  created_at: string;
  // joined metadata
  entry: MediaEntry;
}

export interface UserRating {
  id: string;
  user_id: string;
  entry_id: string;
  rating: number | null;
  previous_rating: number | null;
  ranking: number | null;
  accurate: boolean | null;
  created_at: string;
  updated_at: string | null;
  entry: MediaEntry;
}

export interface UserSave {
  id: string;
  user_id: string;
  entry_id: string;
  new_season_to_watch: boolean;
  queue_rank: number | null;
  created_at: string;
  entry: MediaEntry;
}

export interface UserWatchStatus {
  id: string;
  user_id: string;
  entry_id: string;
  status: unknown;
  updated_at: string;
}

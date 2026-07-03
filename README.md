# Media Tracker

Track everything you watch and read in one place: movies, TV shows, and books.

**Live app:** [media-library-mcurmi05.vercel.app](https://media-library-mcurmi05.vercel.app/)

## What you can do

- **Search everything at once**: movies, TV shows, and books from a single search bar, powered by TMDB and Hardcover.
- **Keep a watchlist and a to-be-read queue**: save anything you want to get to later.
- **Log what you finish**: build a history of everything you've watched and read, with dates.
- **Rate and rank**: score titles your way and keep a ranked list of favourites.
- **Make lists**: organize any mix of movies, shows, and books into custom lists.
- **See ratings from around the web**: IMDb and Letterboxd scores on movies and TV, Goodreads and StoryGraph scores on books, all shown alongside your own.

## Screenshots

| | |
|---|---|
| ![Search](docs/images/searchbar.png) | ![Trending](docs/images/trending.png) |
| ![Watchlist](docs/images/watchlist.png) | ![Log](docs/images/log.png) |

---

## For developers

### Stack

- React 19 + Vite + TypeScript
- Supabase (auth + Postgres)
- Vercel (hosting + serverless API proxies for TMDB and Hardcover)
- GitHub Actions (daily sync of IMDb, Letterboxd, Goodreads, and StoryGraph ratings)

### Local setup

```bash
npm install
cp envexample.txt .env
```

Fill in `.env`:

```env
TMDB_API_KEY=
HARDCOVER_API_TOKEN=
VITE_SUPABASE_PROJECT_URL=
VITE_SUPABASE_API_KEY=
```

The Hardcover token is server-only — never prefix it with `VITE_` or use it in browser code.

```bash
npm run dev
```

Vite mounts the handlers in `api/` during development, so `/api/tmdb` and `/api/hardcover` behave like their Vercel counterparts.

### Checks

```bash
npm run lint
npm run typecheck
npm run build
```

### Rating sync workflows

Four GitHub Actions keep external community ratings fresh in Supabase:

| Source | Workflow | Schedule (UTC) |
| ---------- | ----------------------------- | -------------- |
| IMDb | `sync-imdb-ratings.yml` | 08:00 |
| Letterboxd | `sync-letterboxd-ratings.yml` | 09:30 |
| Goodreads | `sync-goodreads-ratings.yml` | 11:00 |
| StoryGraph | `sync-storygraph-ratings.yml` | 12:30 |

They require the repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `HARDCOVER_API_TOKEN`. StoryGraph is Cloudflare-protected, so its workflow runs a Playwright Chromium scraper in a virtual display.

### Production environment

Server-side (Vercel): `TMDB_API_KEY`, `HARDCOVER_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Client-side: `VITE_SUPABASE_PROJECT_URL`, `VITE_SUPABASE_API_KEY`.

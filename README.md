# Movie Library

A personal media tracker for movies, television, and books. Search TMDB and
Hardcover from one interface, maintain watchlists and reading queues, log what
you finish, rate and rank titles, and organize mixed media into shareable
lists.

The current deployment is available at
[media-library-mcurmi05.vercel.app](https://media-library-mcurmi05.vercel.app/).

## Features

- Combined Books, Movies, and TV search with source-specific filtering
- TMDB-native movie and TV metadata
- Hardcover-native book metadata and stable book identity
- IMDb and Letterboxd community ratings for movies and TV
- Goodreads and StoryGraph community ratings for books
- Personal ratings, ranked favourites, logs, watchlists, TBR queues, and lists
- Responsive layouts and Supabase authentication

## Screenshots

![Trending titles](./docs/images/trending.png)
![Ratings](./docs/images/ratings.png)
![Watchlist](./docs/images/watchlist.png)
![Log](./docs/images/log.png)
![Media details](./docs/images/mediadetails.png)
![Search](./docs/images/searchbar.png)
![Responsive search](./docs/images/responsive-dropdown.png)

## Stack

- React 19 and Vite
- React Router
- Supabase authentication and Postgres
- Vercel functions for server-side API proxies
- TMDB and Hardcover for metadata
- GitHub Actions for external rating synchronization
- Playwright for the Cloudflare-protected StoryGraph sync

## Local development

Install dependencies and create a local environment file:

```bash
npm install
cp envexample.txt .env
```

Configure the required values:

```env
TMDB_API_KEY=
HARDCOVER_API_TOKEN=
VITE_SUPABASE_PROJECT_URL=
VITE_SUPABASE_API_KEY=
```

The Hardcover token is server-only. Never prefix it with `VITE_` or expose it
to browser code.

Start the app:

```bash
npm run dev
```

Vite mounts the handlers in `api/` during development, so `/api/tmdb` and
`/api/hardcover` behave like their Vercel counterparts.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

TypeScript is being introduced incrementally with `allowJs`. Shared media
contracts and the client API boundary are typed first while existing JSX
continues to build normally.

## Rating synchronization

Four scheduled GitHub Actions refresh community ratings:

| Source | Workflow | Schedule |
| --- | --- | --- |
| IMDb | `sync-imdb-ratings.yml` | 08:00 UTC |
| Letterboxd | `sync-letterboxd-ratings.yml` | 09:30 UTC |
| Goodreads | `sync-goodreads-ratings.yml` | 11:00 UTC |
| StoryGraph | `sync-storygraph-ratings.yml` | 12:30 UTC |

The workflows require these repository secrets:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

StoryGraph blocks raw server-side requests. Its workflow installs Chromium and
runs the scraper in a virtual display. To test only the extractor locally
without writing to Supabase:

```bash
node scripts/sync-storygraph-ratings.mjs \
  --spike-id 522146fd-c1c0-4f63-b0cb-8a5d4d97fa4d
```

## Data model

`book_entries` retains its UUID primary key so existing watchlist, log, list,
and rating relationships remain valid. Hardcover supplies the canonical
external identity through `hardcover_id`; ISBN, Goodreads ID, and StoryGraph
UUID fields support rating resolution.

External search results are not inserted immediately. A cached `book_entries`
row is created when a user saves, logs, rates, or adds a book to a list.

## Production environment

Set these server-side variables in Vercel:

```env
TMDB_API_KEY=
HARDCOVER_API_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Set the public Supabase variables for the Vite client:

```env
VITE_SUPABASE_PROJECT_URL=
VITE_SUPABASE_API_KEY=
```

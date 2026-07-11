// Magic lists: rule-driven lists built from the user's own library (logged,
// rated and watchlisted/TBR titles — never the whole TMDB/Hardcover catalog,
// which keeps them bounded). Rules are stored on lists.magic as
// { rules: [{ field, op, value, not, join: "and" | "or" }] } where `join`
// chains each rule to the previous one (ignored on the first rule). AND binds
// tighter than OR, so "A AND B OR C" reads as (A AND B) OR C. Evaluated
// client-side against the universe built by useMagicLibrary.
// (Older lists stored a single top-level `combinator` instead of per-rule
// joins; entryMatches still honours it as the default join.)

import { movieToListItem, bookToListItem, mediaKey } from "../services/lists";
import {
  searchPeople,
  getPersonById,
  searchBooksHardcover,
} from "../services/api";

// field → which ops make sense and what the value input looks like.
// kind: "select" | "number" | "text" | "none"
export const MAGIC_FIELDS = [
  {
    value: "type",
    label: "Media type",
    ops: ["is"],
    kind: "select",
    options: [
      { value: "movie", label: "Movie" },
      { value: "tv", label: "TV show" },
      { value: "book", label: "Book" },
    ],
  },
  {
    value: "source",
    label: "Tracked in",
    ops: ["in"],
    kind: "select",
    options: [
      { value: "logged", label: "my Log" },
      { value: "rated", label: "my Ratings" },
      { value: "watchlisted", label: "my Watchlist / TBR" },
    ],
  },
  { value: "myRating", label: "My rating", ops: ["gte", "lte"], kind: "number", step: 0.5, min: 1, max: 10 },
  { value: "imdb", label: "IMDb rating", ops: ["gte", "lte"], kind: "number", step: 0.1, min: 0, max: 10 },
  { value: "letterboxd", label: "Letterboxd rating", ops: ["gte", "lte"], kind: "number", step: 0.1, min: 0, max: 5 },
  { value: "goodreads", label: "Goodreads rating", ops: ["gte", "lte"], kind: "number", step: 0.01, min: 0, max: 5 },
  { value: "year", label: "Release year", ops: ["gte", "lte", "is"], kind: "number", step: 1 },
  { value: "title", label: "Title contains", ops: ["contains"], kind: "text" },
  { value: "director", label: "Director / creator", ops: ["is"], kind: "person" },
  { value: "actor", label: "Cast contains", ops: ["contains"], kind: "person" },
  { value: "author", label: "Author", ops: ["is"], kind: "author" },
  { value: "genre", label: "Genre contains", ops: ["contains"], kind: "text" },
];

export const MAGIC_OPS = {
  is: "is",
  in: "in",
  gte: "≥",
  lte: "≤",
  contains: "contains",
};

export function fieldMeta(field) {
  return MAGIC_FIELDS.find((f) => f.value === field) || MAGIC_FIELDS[0];
}

export function newMagicRule() {
  return { field: "type", op: "is", value: "movie", not: false, join: "and" };
}

const norm = (s) => String(s || "").toLowerCase().trim();

// Director/actor rules picked from the person dropdown carry a person_id and
// match precisely; legacy free-text rules fall back to name-contains.
function personMatches(people, rule) {
  if (rule.person_id != null) {
    return people.some(
      (p) => p.id === rule.person_id || norm(p.name) === norm(rule.value),
    );
  }
  return people.some((p) => norm(p.name).includes(norm(rule.value)));
}

// One rule against one universe entry (see useMagicLibrary for entry shape).
// Missing data (e.g. a book has no IMDb rating) simply fails the rule.
function ruleMatches(entry, rule) {
  const { field, op, not } = rule;
  const value = rule.value;
  let hit = false;

  switch (field) {
    case "type":
      hit = entry.kind === value;
      break;
    case "source":
      hit = !!entry.flags[value];
      break;
    case "myRating":
      hit =
        entry.myRating != null &&
        (op === "gte"
          ? entry.myRating >= Number(value)
          : entry.myRating <= Number(value));
      break;
    case "imdb":
      hit =
        entry.imdb != null &&
        (op === "gte" ? entry.imdb >= Number(value) : entry.imdb <= Number(value));
      break;
    case "letterboxd":
      hit =
        entry.letterboxd != null &&
        (op === "gte"
          ? entry.letterboxd >= Number(value)
          : entry.letterboxd <= Number(value));
      break;
    case "goodreads":
      hit =
        entry.goodreads != null &&
        (op === "gte"
          ? entry.goodreads >= Number(value)
          : entry.goodreads <= Number(value));
      break;
    case "year":
      hit =
        entry.year != null &&
        (op === "gte"
          ? entry.year >= Number(value)
          : op === "lte"
            ? entry.year <= Number(value)
            : entry.year === Number(value));
      break;
    case "title":
      hit = norm(entry.title).includes(norm(value));
      break;
    case "director":
      hit = personMatches(entry.directors, rule);
      break;
    case "actor":
      hit = personMatches(entry.cast, rule);
      break;
    case "author":
      hit = !!entry.author && norm(entry.author).includes(norm(value));
      break;
    case "genre":
      hit = entry.genres.some((g) => norm(g).includes(norm(value)));
      break;
    default:
      hit = false;
  }

  return not ? !hit : hit;
}

// Split the rule chain on OR joins into groups of AND-ed rules, so AND binds
// tighter than OR: "A AND B OR C" → (A AND B) OR C. A rule without its own
// join falls back to the legacy top-level combinator (default "and").
export function ruleGroups(magic) {
  const rules = magic?.rules || [];
  const fallback = magic?.combinator || "and";
  const groups = [];
  let current = [];
  rules.forEach((r, i) => {
    if (i > 0 && (r.join || fallback) === "or") {
      groups.push(current);
      current = [];
    }
    current.push(r);
  });
  if (current.length) groups.push(current);
  return groups;
}

export function entryMatches(entry, magic) {
  const groups = ruleGroups(magic);
  if (!groups.length) return false;
  return groups.some((group) => group.every((r) => ruleMatches(entry, r)));
}

// All matching entries as list-item snapshots, de-duped, in a stable (title)
// order so repeat syncs don't reshuffle the list. Size stays naturally
// bounded because the universe is only the user's own library.
export function computeMagicSnapshots(universe, magic) {
  const matched = universe.filter((e) => entryMatches(e, magic));
  matched.sort((a, b) => norm(a.title).localeCompare(norm(b.title)));
  const seen = new Set();
  const out = [];
  for (const e of matched) {
    const snap = e.kind === "book" ? bookToListItem(e.book) : movieToListItem(e.mo);
    const key = mediaKey(snap);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(snap);
  }
  return { snapshots: out, matchedCount: seen.size };
}

// Diff the list's current items against what the rules produce now.
export function diffMagicItems(existingItems, snapshots) {
  const wantedKeys = new Set(snapshots.map((s) => mediaKey(s)));
  const existingKeys = new Set(
    existingItems.map((it) =>
      mediaKey({ media_type: it.media_type, item_data: it.item_data }),
    ),
  );
  const toAdd = snapshots.filter((s) => !existingKeys.has(mediaKey(s)));
  const toRemove = existingItems.filter(
    (it) =>
      !wantedKeys.has(mediaKey({ media_type: it.media_type, item_data: it.item_data })),
  );
  return { toAdd, toRemove };
}

// Which media kinds a (non-negated) rule can possibly match. Used to catch
// contradictions like "type is book AND director contains X" before they
// silently produce nothing.
export const FIELD_KINDS = {
  director: ["movie", "tv"],
  actor: ["movie", "tv"],
  genre: ["movie", "tv"],
  imdb: ["movie", "tv"],
  letterboxd: ["movie"],
  author: ["book"],
  goodreads: ["book"],
};

export const KIND_LABELS = { movie: "movies", tv: "TV shows", book: "books" };

// The media kinds still possible for the rule at `index`, given the other
// rules in its AND section. Drives the graying-out of field/type options so
// contradictions can't be picked in the first place.
export function allowedKindsForRule(magic, index) {
  const rules = magic?.rules || [];
  const fallback = magic?.combinator || "and";
  let start = 0;
  let end = rules.length;
  rules.forEach((r, i) => {
    if (i > 0 && (r.join || fallback) === "or") {
      if (i <= index) start = i;
      else end = Math.min(end, i);
    }
  });
  let kinds = new Set(["movie", "tv", "book"]);
  for (let i = start; i < end; i++) {
    if (i === index) continue;
    const r = rules[i];
    if (r.field === "type") {
      if (r.not) {
        kinds.delete(r.value);
      } else {
        kinds = new Set(kinds.has(r.value) ? [r.value] : []);
      }
    } else if (!r.not && FIELD_KINDS[r.field]) {
      kinds = new Set(FIELD_KINDS[r.field].filter((k) => kinds.has(k)));
    }
  }
  return kinds;
}

// Null when every AND section can match at least one media kind, else a
// message naming the impossible section.
export function validateRuleLogic(magic) {
  const groups = ruleGroups(magic);
  for (let gi = 0; gi < groups.length; gi++) {
    let kinds = new Set(["movie", "tv", "book"]);
    for (const r of groups[gi]) {
      if (r.field === "type") {
        if (r.not) {
          kinds.delete(r.value);
        } else {
          kinds = new Set(kinds.has(r.value) ? [r.value] : []);
        }
      } else if (!r.not && FIELD_KINDS[r.field]) {
        kinds = new Set(FIELD_KINDS[r.field].filter((k) => kinds.has(k)));
      }
      if (!kinds.size) {
        const section =
          groups.length > 1 ? `Section ${gi + 1} of your rules` : "Your rules";
        const only = FIELD_KINDS[r.field];
        const detail =
          r.field === "type"
            ? `"${describeRule(r)}" contradicts the rules before it`
            : `"${fieldMeta(r.field).label}" only applies to ${only.map((k) => KIND_LABELS[k]).join(" and ")}`;
        return `${section} can never match anything: ${detail}. Split the rules with OR or remove one.`;
      }
    }
  }
  return null;
}

/* ---------- global scope ---------- */

// Global lists query TMDB/Hardcover instead of the user's library, so the
// rule set is deliberately restrictive: every OR group must be anchored by a
// "seed" rule (a person's filmography or an author's books — one search plus
// one credits request each, a bounded result set), and the remaining fields
// can only narrow those results locally.
export const GLOBAL_FIELDS = new Set([
  "type",
  "year",
  "title",
  "director",
  "actor",
  "author",
]);
export const GLOBAL_SEED_FIELDS = new Set(["director", "actor", "author"]);
export const GLOBAL_MAX_SEEDS = 5;
export const GLOBAL_MAX_ITEMS = 500;

// Null when the rules are usable globally, else a message for the UI.
export function validateGlobalRules(magic) {
  const rules = magic?.rules || [];
  const bad = rules.find((r) => !GLOBAL_FIELDS.has(r.field));
  if (bad) {
    return `"${fieldMeta(bad.field).label}" only works on library lists. Remove it or switch back to library scope.`;
  }
  const negatedSeed = rules.find(
    (r) => GLOBAL_SEED_FIELDS.has(r.field) && r.not,
  );
  if (negatedSeed) {
    return "NOT can't be used on director, actor or author rules in a global list. They anchor the search.";
  }
  const seedCount = rules.filter((r) => GLOBAL_SEED_FIELDS.has(r.field)).length;
  if (seedCount > GLOBAL_MAX_SEEDS) {
    return `At most ${GLOBAL_MAX_SEEDS} director, actor or author rules per global list.`;
  }
  const groups = ruleGroups(magic);
  const anchorless = groups.some(
    (g) => !g.some((r) => GLOBAL_SEED_FIELDS.has(r.field)),
  );
  if (anchorless) {
    return "Each OR section of a global list needs a director, actor or author rule to anchor the search.";
  }
  return null;
}

// Minimal rule-engine entry for a TMDB credit or Hardcover book, enough for
// the type/year/title filter fields.
function creditEntry(c) {
  return {
    kind: c.media_type === "tv" ? "tv" : "movie",
    title: c.primaryTitle || "",
    year: Number(c.startYear) || null,
    author: null,
    directors: [],
    cast: [],
    genres: [],
    flags: {},
    myRating: null,
    imdb: null,
    letterboxd: null,
    goodreads: null,
  };
}

function bookEntry(b) {
  return {
    kind: "book",
    title: b.title || "",
    year: Number(b.release_year) || null,
    author: b.author || null,
    directors: [],
    cast: [],
    genres: [],
    flags: {},
    myRating: null,
    imdb: null,
    letterboxd: null,
    goodreads: null,
  };
}

const globalKey = (c) =>
  c.hardcover_id != null
    ? `book:${c.hardcover_id}`
    : `${c.media_type}:${c.tmdb_id}`;

// Fetch the candidates a seed rule anchors: a person's directing/acting
// credits or an author's books. Caches within one compute so a person named
// in several groups is only fetched once.
async function seedCandidates(rule, caches) {
  const value = String(rule.value).trim();
  if (rule.field === "author") {
    const key = value.toLowerCase();
    if (!caches.author.has(key)) {
      const results = await searchBooksHardcover(value);
      caches.author.set(
        key,
        (results || []).filter((b) =>
          (b.author || "").toLowerCase().includes(key),
        ),
      );
    }
    return caches.author.get(key).map((b) => ({ raw: b, entry: bookEntry(b) }));
  }

  // Rules picked from the dropdown carry the exact TMDB person id; legacy
  // free-text rules resolve via search (exact name match preferred).
  const cacheKey =
    rule.person_id != null ? `id:${rule.person_id}` : value.toLowerCase();
  if (!caches.person.has(cacheKey)) {
    let personId = rule.person_id;
    if (personId == null) {
      const people = ((await searchPeople(value)) || []).filter(
        (p) => p.person_id != null,
      );
      const person =
        people.find((p) => norm(p.name) === norm(value)) || people[0];
      personId = person?.person_id ?? null;
    }
    caches.person.set(
      cacheKey,
      personId != null ? await getPersonById(personId) : null,
    );
  }
  const data = caches.person.get(cacheKey);
  if (!data) return [];
  const credits =
    rule.field === "actor"
      ? data.acting || []
      : data.crewByDept?.Directing || [];
  return credits
    .filter((c) => c.tmdb_id != null)
    .map((c) => ({ raw: c, entry: creditEntry(c) }));
}

// Async twin of computeMagicSnapshots for global scope. Per OR group: fetch
// each seed's candidates (intersecting when a group has several seeds), then
// apply the remaining rules locally. Requests scale with the number of seed
// rules, not with result size, so rate limits stay comfortable.
export async function computeGlobalSnapshots(magic) {
  const caches = { person: new Map(), author: new Map() };
  const matchedByKey = new Map();

  for (const group of ruleGroups(magic)) {
    const seeds = group.filter((r) => GLOBAL_SEED_FIELDS.has(r.field));
    const filters = group.filter((r) => !GLOBAL_SEED_FIELDS.has(r.field));
    if (!seeds.length) continue;

    let candidates = null;
    for (const seed of seeds) {
      const found = await seedCandidates(seed, caches);
      if (candidates === null) {
        candidates = found;
      } else {
        const keys = new Set(found.map((c) => globalKey(c.raw)));
        candidates = candidates.filter((c) => keys.has(globalKey(c.raw)));
      }
      if (!candidates.length) break;
    }

    (candidates || []).forEach((c) => {
      if (!filters.every((r) => ruleMatches(c.entry, r))) return;
      matchedByKey.set(globalKey(c.raw), c);
    });
  }

  const matched = Array.from(matchedByKey.values());
  matched.sort((a, b) => norm(a.entry.title).localeCompare(norm(b.entry.title)));
  const snapshots = matched
    .slice(0, GLOBAL_MAX_ITEMS)
    .map((c) =>
      c.entry.kind === "book" ? bookToListItem(c.raw) : movieToListItem(c.raw),
    );
  return {
    snapshots,
    matchedCount: matched.length,
    truncated: matched.length > GLOBAL_MAX_ITEMS,
  };
}

// Human-readable one-liner for a rule, for chips/summaries.
export function describeRule(rule) {
  const meta = fieldMeta(rule.field);
  // Single-op fields fold the operator into their label ("Cast contains"),
  // so only fields with a real choice print the op word.
  const opLabel = meta.ops.length > 1 ? ` ${MAGIC_OPS[rule.op] || rule.op}` : "";
  const valueLabel =
    meta.kind === "select"
      ? (meta.options.find((o) => o.value === rule.value)?.label ?? rule.value)
      : rule.value;
  return `${rule.not ? "NOT " : ""}${meta.label}${opLabel} ${valueLabel}`;
}

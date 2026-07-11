import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCovers } from "../../contexts/UserCoversContext";
import { useMagicLibrary } from "../../hooks/useMagicLibrary";
import { useDebouncedValue } from "../../utils/useDebouncedValue";
import { searchPeople, searchBooksHardcover } from "../../services/api";
import {
  MAGIC_FIELDS,
  MAGIC_OPS,
  GLOBAL_FIELDS,
  GLOBAL_SEED_FIELDS,
  fieldMeta,
  newMagicRule,
  computeMagicSnapshots,
  computeGlobalSnapshots,
  validateGlobalRules,
  validateRuleLogic,
  allowedKindsForRule,
  FIELD_KINDS,
  KIND_LABELS,
} from "../../utils/magicLists";
import { Spinner } from "../layout/Loader";
import "../../styles/search/Toolbar.css";
import "../../styles/pages/Lists.css";

// Search-as-you-type selector for director/actor/author rules. Free text is
// never committed: the rule only gets a value when an option is picked, so
// "Chris" can't silently resolve to whichever Chris TMDB ranks first, and the
// preview stays empty until a real person/author is chosen.
function SuggestPicker({ rule, onPick, fetchOptions, placeholder }) {
  const [text, setText] = useState(rule.value || "");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebouncedValue(text, 350);

  // External changes (switching the rule's field) reset the input.
  useEffect(() => {
    setText(rule.value || "");
  }, [rule.field, rule.value]);

  useEffect(() => {
    const term = debounced.trim();
    if (!open || term.length < 2 || term === rule.value) {
      setOptions([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetchOptions(term)
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, open, rule.value]);

  const unset = text.trim() !== "" && !rule.value;

  return (
    <div className="magic-person">
      <input
        className={`magic-value${unset ? " magic-value-unset" : ""}`}
        type="text"
        placeholder={placeholder}
        value={text}
        title={unset ? "Pick from the dropdown to use this rule" : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          // Typing invalidates any previous pick.
          if (rule.value) onPick({ value: "", person_id: null });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (searching || options.length > 0) && (
        <div className="menu-pop magic-person-pop">
          {searching ? (
            <div className="menu-pop-item magic-person-note">Searching...</div>
          ) : (
            options.map((opt) => (
              <button
                type="button"
                className="menu-pop-item"
                key={opt.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setText(opt.label);
                  setOpen(false);
                  setOptions([]);
                  onPick(opt.patch);
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Rank the full result page ourselves: exact and whole-word name matches
// ("Kubrick" → Stanley Kubrick) beat TMDB's raw relevance order, which is
// kept only as the tie-break. Having credits/a photo nudges real notables up.
function personScore(p, term, index) {
  const name = (p.name || "").toLowerCase();
  const needle = term.toLowerCase().trim();
  let score = 0;
  if (name === needle) score = 100;
  else if (name.split(/\s+/).includes(needle)) score = 80;
  else if (name.startsWith(needle)) score = 70;
  else if (name.includes(needle)) score = 50;
  if ((p.known_for || []).length) score += 5;
  if (p.profile) score += 3;
  return score - index * 0.5;
}

async function fetchPersonOptions(term) {
  const people = (await searchPeople(term)) || [];
  // Person search hits carry `name` (not the `fullName` used on credits).
  return people
    .filter((p) => p.person_id != null && p.name)
    .map((p, i) => ({ p, score: personScore(p, term, i) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ p }) => ({
      key: p.person_id,
      label: p.name,
      sub: [p.department, (p.known_for || [])[0]].filter(Boolean).join(" · "),
      image: p.profile || null,
      patch: {
        value: p.name,
        person_id: p.person_id,
        person_image: p.profile || null,
      },
    }));
}

// Dedicated search modal for picking a director/actor, with headshots so
// same-named people are tellable apart. Renders on top of the magic modal.
function PersonPickModal({ title, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebouncedValue(query, 350);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetchPersonOptions(term)
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return createPortal(
    <div className="lists-modal-overlay" onClick={onClose}>
      <div className="lists-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lists-modal-head">
          <h3>{title}</h3>
          <button
            className="lists-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            {String.fromCharCode(0x2715)}
          </button>
        </div>
        <input
          className="person-pick-input"
          type="text"
          placeholder="Search TMDB for a person..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="person-pick-results">
          {searching ? (
            <div className="lists-modal-loading">
              <Spinner />
            </div>
          ) : options.length === 0 ? (
            <p className="lists-modal-empty">
              {debounced.trim().length < 2
                ? "Type a name to search."
                : "No people found."}
            </p>
          ) : (
            options.map((opt) => (
              <button
                type="button"
                className="person-pick-row"
                key={opt.key}
                onClick={() => onPick(opt.patch)}
              >
                <img
                  src={opt.image || "/images/placeholderimage.jpg"}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/images/placeholderimage.jpg";
                  }}
                />
                <span className="person-pick-info">
                  <span className="person-pick-name">{opt.label}</span>
                  {opt.sub && (
                    <span className="person-pick-sub">{opt.sub}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Hardcover has no author-search endpoint, so author suggestions are the
// distinct author names on the books a title search returns.
async function fetchAuthorOptions(term) {
  const books = (await searchBooksHardcover(term)) || [];
  const needle = term.toLowerCase();
  const seen = new Set();
  const out = [];
  for (const b of books) {
    const author = (b.author || "").trim();
    const key = author.toLowerCase();
    if (!author || seen.has(key) || !key.includes(needle)) continue;
    seen.add(key);
    out.push({ key, label: author, patch: { value: author, person_id: null } });
    if (out.length >= 6) break;
  }
  return out;
}

export default function MagicListModal({
  mode = "create",
  initialMagic = null,
  initialTitle = "",
  initialDescription = "",
  saving = false,
  onClose,
  onSubmit, // create: ({ title, description, magic, snapshots }) / edit: ({ magic, snapshots })
}) {
  const { universe, ready } = useMagicLibrary();
  const { coverForTmdb, coverForHardcover } = useCovers();

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [scope, setScope] = useState(initialMagic?.scope || "library");
  // Index of the rule whose director/actor is being picked in the modal.
  const [personPickIdx, setPersonPickIdx] = useState(null);
  // Older lists chained every rule with one top-level combinator; seed each
  // rule's join from it so editing them keeps the same meaning.
  const [rules, setRules] = useState(() =>
    initialMagic?.rules?.length
      ? initialMagic.rules.map((r) => ({
          join: initialMagic.combinator || "and",
          ...r,
          ...(r.field === "director" || r.field === "author"
            ? { op: "is" }
            : r.field === "actor"
              ? { op: "contains" }
              : r.field === "source"
                ? { op: "in" }
                : {}),
        }))
      : [newMagicRule()],
  );

  const setRule = (idx, patch) =>
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const changeField = (idx, field) => {
    const meta = fieldMeta(field);
    setRule(idx, {
      field,
      op: meta.ops[0],
      value: meta.kind === "select" ? meta.options[0].value : "",
      person_id: null,
    });
  };

  // Rules missing a value can't match anything — leave them out of both the
  // preview and what gets saved.
  const validRules = useMemo(
    () =>
      rules.filter((r) => {
        const meta = fieldMeta(r.field);
        if (meta.kind === "select") return !!r.value;
        return String(r.value).trim() !== "";
      }),
    [rules],
  );

  const magic = useMemo(
    () => ({ scope, rules: validRules }),
    [scope, validRules],
  );

  // Impossible AND sections (e.g. "type is book AND director contains X")
  // and global-scope restrictions both block the preview and submit.
  const logicError = validRules.length ? validateRuleLogic(magic) : null;
  const globalError =
    scope === "global" && validRules.length && !logicError
      ? validateGlobalRules(magic)
      : null;
  const rulesError = logicError || globalError;

  const libraryPreview = useMemo(() => {
    if (scope !== "library" || !ready || !validRules.length || logicError)
      return { snapshots: [], matchedCount: 0, truncated: false };
    return computeMagicSnapshots(universe, magic);
  }, [scope, universe, ready, magic, validRules.length, logicError]);

  // Global previews hit TMDB/Hardcover, so they're debounced and show their
  // own loading state.
  const [globalPreview, setGlobalPreview] = useState({
    snapshots: [],
    matchedCount: 0,
    truncated: false,
  });
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalFetchError, setGlobalFetchError] = useState(false);

  useEffect(() => {
    if (scope !== "global") return;
    if (!validRules.length || rulesError) {
      setGlobalPreview({ snapshots: [], matchedCount: 0, truncated: false });
      setGlobalLoading(false);
      return;
    }
    let cancelled = false;
    setGlobalLoading(true);
    setGlobalFetchError(false);
    const t = setTimeout(async () => {
      try {
        const res = await computeGlobalSnapshots(magic);
        if (!cancelled) setGlobalPreview(res);
      } catch (err) {
        console.error("Global preview failed:", err);
        if (!cancelled) {
          setGlobalPreview({ snapshots: [], matchedCount: 0, truncated: false });
          setGlobalFetchError(true);
        }
      } finally {
        if (!cancelled) setGlobalLoading(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [scope, magic, validRules.length, rulesError]);

  const preview = scope === "global" ? globalPreview : libraryPreview;

  const previewCover = (s) =>
    s.media_type === "book"
      ? coverForHardcover(s.item_data.hardcover_id) || s.item_data.cover_image
      : coverForTmdb(s.item_data.media_type, s.item_data.tmdb_id) ||
        s.item_data.primaryImage;

  const canSubmit =
    !saving &&
    validRules.length > 0 &&
    (mode === "edit" || title.trim().length > 0) &&
    !rulesError &&
    (scope === "library" || !globalLoading);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (mode === "create") {
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        magic,
        snapshots: preview.snapshots,
      });
    } else {
      onSubmit({ magic, snapshots: preview.snapshots });
    }
  };

  return createPortal(
    <div className="lists-modal-overlay" onClick={onClose}>
      <div
        className="lists-modal magic-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lists-modal-head">
          <h3>{mode === "create" ? "✨ New magic list" : "✨ Edit magic rules"}</h3>
          <button
            className="lists-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            {String.fromCharCode(0x2715)}
          </button>
        </div>

        <form className="lists-create-form magic-form" onSubmit={handleSubmit}>
          {mode === "create" && (
            <>
              <input
                type="text"
                placeholder="List name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </>
          )}

          <div className="magic-scope">
            <button
              type="button"
              className={`magic-scope-btn${scope === "library" ? " magic-scope-btn-active" : ""}`}
              onClick={() => setScope("library")}
            >
              My library
            </button>
            <button
              type="button"
              className={`magic-scope-btn${scope === "global" ? " magic-scope-btn-active" : ""}`}
              onClick={() => setScope("global")}
            >
              Global
            </button>
            <span className="magic-scope-hint">
              {scope === "library"
                ? "Matches only titles you've logged, rated or watchlisted."
                : "Searches all of TMDB and Hardcover, anchored by people/authors."}
            </span>
          </div>

          <div className="magic-rules">
            {rules.map((rule, idx) => {
              const meta = fieldMeta(rule.field);
              // What the rest of this rule's AND section still allows;
              // incompatible fields/type values gray out instead of erroring.
              const allowedKinds = allowedKindsForRule({ rules }, idx);
              const kindSuffix = (field) => {
                const kinds = FIELD_KINDS[field];
                if (!kinds || kinds.some((k) => allowedKinds.has(k))) return "";
                return ` (only for ${kinds.map((k) => KIND_LABELS[k]).join(" & ")})`;
              };
              return (
                <div
                  className={`magic-rule${meta.ops.length > 1 ? "" : " magic-rule-noop"}`}
                  key={idx}
                >
                  {idx === 0 ? (
                    <span className="magic-join magic-join-first" />
                  ) : (
                    <button
                      type="button"
                      className={`magic-join${rule.join === "or" ? " magic-join-or" : ""}`}
                      onClick={() =>
                        setRule(idx, {
                          join: rule.join === "or" ? "and" : "or",
                        })
                      }
                      title="How this rule chains to the one above. AND binds tighter than OR: A AND B OR C means (A AND B) OR C"
                    >
                      {rule.join === "or" ? "OR" : "AND"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`magic-not${rule.not ? " magic-not-on" : ""}`}
                    onClick={() => setRule(idx, { not: !rule.not })}
                    disabled={
                      scope === "global" && GLOBAL_SEED_FIELDS.has(rule.field)
                    }
                    title={
                      scope === "global" && GLOBAL_SEED_FIELDS.has(rule.field)
                        ? "Director, actor and author rules anchor a global search and can't be negated"
                        : rule.not
                          ? "Rule is negated"
                          : "Negate rule"
                    }
                  >
                    NOT
                  </button>
                  <select
                    value={rule.field}
                    onChange={(e) => changeField(idx, e.target.value)}
                  >
                    {MAGIC_FIELDS.map((f) => {
                      const globalBlocked =
                        scope === "global" && !GLOBAL_FIELDS.has(f.value);
                      const suffix = globalBlocked
                        ? " (library only)"
                        : kindSuffix(f.value);
                      return (
                        <option
                          key={f.value}
                          value={f.value}
                          disabled={globalBlocked || suffix !== ""}
                        >
                          {f.label}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  {meta.ops.length > 1 && (
                    <select
                      className="magic-op"
                      value={rule.op}
                      onChange={(e) => setRule(idx, { op: e.target.value })}
                    >
                      {meta.ops.map((op) => (
                        <option key={op} value={op}>
                          {MAGIC_OPS[op]}
                        </option>
                      ))}
                    </select>
                  )}
                  {meta.kind === "person" ? (
                    <button
                      type="button"
                      className={`magic-value magic-person-select${rule.value ? "" : " magic-person-select-empty"}`}
                      onClick={() => setPersonPickIdx(idx)}
                      title={rule.value ? "Change person" : "Select a person"}
                    >
                      {rule.value ? (
                        <>
                          <img
                            className="magic-person-thumb"
                            src={rule.person_image || "/images/placeholderimage.jpg"}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "/images/placeholderimage.jpg";
                            }}
                          />
                          <span className="magic-person-name">{rule.value}</span>
                        </>
                      ) : (
                        "Select person..."
                      )}
                    </button>
                  ) : meta.kind === "author" ? (
                    <SuggestPicker
                      rule={rule}
                      onPick={(patch) => setRule(idx, patch)}
                      fetchOptions={fetchAuthorOptions}
                      placeholder="Search an author..."
                    />
                  ) : meta.kind === "select" ? (
                    <select
                      className="magic-value"
                      value={rule.value}
                      onChange={(e) => setRule(idx, { value: e.target.value })}
                    >
                      {meta.options.map((o) => {
                        const blocked =
                          rule.field === "type" &&
                          !rule.not &&
                          !allowedKinds.has(o.value);
                        return (
                          <option
                            key={o.value}
                            value={o.value}
                            disabled={blocked}
                          >
                            {o.label}
                            {blocked ? " (conflicts with other rules)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      className="magic-value"
                      type={meta.kind === "number" ? "number" : "text"}
                      step={meta.step}
                      min={meta.min}
                      max={meta.max}
                      placeholder={meta.kind === "number" ? "0" : "e.g. Nolan"}
                      value={rule.value}
                      onChange={(e) => setRule(idx, { value: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    className="magic-rule-remove"
                    onClick={() =>
                      setRules((prev) => prev.filter((_, i) => i !== idx))
                    }
                    disabled={rules.length === 1}
                    aria-label="Remove rule"
                  >
                    {String.fromCharCode(0x2715)}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="magic-add-rule"
            onClick={() => setRules((prev) => [...prev, newMagicRule()])}
          >
            + Add rule
          </button>

          <div className="magic-preview">
            {rulesError ? (
              <span className="magic-preview-note magic-preview-error">
                {rulesError}
              </span>
            ) : scope === "library" && !ready ? (
              <span className="magic-preview-note">
                <Spinner /> Loading your library...
              </span>
            ) : !validRules.length ? (
              <span className="magic-preview-note">
                {scope === "global"
                  ? "Add a director, actor or author rule to search."
                  : "Add a rule to see matches from your library."}
              </span>
            ) : scope === "global" && globalLoading ? (
              <span className="magic-preview-note">
                <Spinner /> Searching TMDB & Hardcover... this can take a few
                seconds.
              </span>
            ) : globalFetchError ? (
              <span className="magic-preview-note magic-preview-error">
                Search failed. Check the names in your rules and try again.
              </span>
            ) : (
              <>
                <span className="magic-preview-count">
                  {preview.matchedCount}{" "}
                  {preview.matchedCount === 1 ? "match" : "matches"}
                  {scope === "library" ? " in your library" : ""}
                  {preview.truncated ? " (showing the first 500)" : ""}
                </span>
                <div className="magic-preview-covers">
                  {preview.snapshots.slice(0, 8).map((s, i) => (
                    <img
                      key={i}
                      src={previewCover(s) || "/images/placeholderimage.jpg"}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/images/placeholderimage.jpg";
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {personPickIdx != null && (
            <PersonPickModal
              title={
                fieldMeta(rules[personPickIdx]?.field).value === "actor"
                  ? "Pick a cast member"
                  : "Pick a director / creator"
              }
              onPick={(patch) => {
                setRule(personPickIdx, patch);
                setPersonPickIdx(null);
              }}
              onClose={() => setPersonPickIdx(null)}
            />
          )}

          <p className="magic-hint">
            {scope === "library"
              ? "Library lists only match titles already in your log, ratings, watchlist or TBR. Switch to Global to pull from everything on TMDB and Hardcover."
              : "Global lists look up each director/actor's full filmography and each author's books, then your other rules narrow those results. Ratings and log-based rules aren't available here."}
          </p>

          <button type="submit" disabled={!canSubmit}>
            {saving ? (
              <Spinner />
            ) : mode === "create" ? (
              "Create magic list"
            ) : (
              "Save rules"
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

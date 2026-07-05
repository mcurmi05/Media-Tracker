// Format a rating's dates for display. A rating with a trustworthy date shows
// its original "Rated" date; if it was later edited (updated_at meaningfully
// after created_at) the changed date is also surfaced as "(Updated: ...)".
//
// When the date is unknown - the row is explicitly flagged (date_unknown) via
// the "Date unknown" action on its date picker - no real date is shown; the
// entry reads "Date unknown" and belongs in the pre-tracking bucket.
//
// A freshly created rating gets an updated_at within a moment of created_at
// (DB defaults), so a small tolerance avoids false "Updated" labels caused
// by insert-time clock skew.

const CHANGED_TOLERANCE_MS = 5000;

const formatDate = (d) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// opts: { dateUnknown?: boolean }
export function getRatingDateInfo(
  createdAt,
  updatedAt,
  previousRating = null,
  opts = {},
) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const { dateUnknown = false } = opts;
  const unknown = dateUnknown === true;

  const updated = updatedAt ? new Date(updatedAt) : null;
  const changed =
    !!updated &&
    !Number.isNaN(updated.getTime()) &&
    updated.getTime() - created.getTime() > CHANGED_TOLERANCE_MS;

  // Ratings updated before previous_rating was tracked have no stored value;
  // those just show the date with no "was ..." suffix.
  const hasPrevious =
    previousRating !== null &&
    previousRating !== undefined &&
    previousRating !== "";

  const validUpdated = updated && !Number.isNaN(updated.getTime());

  return {
    // True when created_at can't be trusted. Rating cards then show the stored
    // "Updated" date (a real action); watched-only rows show "Date unknown".
    unknown,
    changed: !unknown && changed,
    ratedFormatted: formatDate(created),
    updatedFormatted: changed ? formatDate(updated) : null,
    // Most recent trustworthy date we have (the stored updated_at, else created).
    lastUpdatedFormatted: formatDate(validUpdated ? updated : created),
    previousRating: changed && hasPrevious ? previousRating : null,
  };
}

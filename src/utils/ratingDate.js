// Format a rating's dates for display. Every rating shows its original
// "Rated" date; if it was later edited (updated_at meaningfully after
// created_at) the changed date is also surfaced as "(Updated: ...)".
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

export function getRatingDateInfo(createdAt, updatedAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const updated = updatedAt ? new Date(updatedAt) : null;
  const changed =
    !!updated &&
    !Number.isNaN(updated.getTime()) &&
    updated.getTime() - created.getTime() > CHANGED_TOLERANCE_MS;

  return {
    changed,
    ratedFormatted: formatDate(created),
    updatedFormatted: changed ? formatDate(updated) : null,
  };
}

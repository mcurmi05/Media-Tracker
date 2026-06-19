// Resolve the user's display name and avatar from Supabase auth metadata, with
// sensible fallbacks. Display name and avatar URL live in `user_metadata`
// (set via supabase.auth.updateUser({ data: {...} })) — no extra DB tables.

export function getDisplayName(user) {
  const name = user?.user_metadata?.display_name;
  if (name && name.trim()) return name.trim();
  const email = user?.email || "";
  return email.split("@")[0] || "there";
}

// A user-set avatar_url if present, otherwise an auto-generated initials avatar
// keyed off the display name (matches the old email-based default).
export function getAvatarUrl(user) {
  const url = user?.user_metadata?.avatar_url;
  if (url) return url;
  const seed = getDisplayName(user) || user?.email || "user";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    seed,
  )}&background=random`;
}

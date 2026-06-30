// Resolve the user's display name and avatar from Supabase auth metadata, with
// sensible fallbacks. Display name and avatar URL live in `user_metadata`
// (set via supabase.auth.updateUser({ data: {...} })) — no extra DB tables.

export function getDisplayName(user) {
  const name = user?.user_metadata?.display_name;
  if (name && name.trim()) return name.trim();
  const email = user?.email || "";
  return email.split("@")[0] || "there";
}

// Resolve the avatar with a clear precedence:
//   1. custom_avatar_url — a picture the user uploaded themselves. Stored under
//      its own key because OAuth providers (e.g. Google) overwrite `avatar_url`
//      in user_metadata on every sign-in, which would otherwise clobber it.
//   2. avatar_url — provided by the OAuth provider (used on the first login,
//      before the user has uploaded anything of their own).
//   3. an auto-generated initials avatar keyed off the display name.
export function getAvatarUrl(user) {
  const url =
    user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url;
  if (url) return url;
  const seed = getDisplayName(user) || user?.email || "user";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    seed,
  )}&background=random`;
}

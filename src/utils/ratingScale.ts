// Rating scale presets the user can pick in Account Settings. The choice is
// stored in Supabase auth user_metadata.rating_scale as one of these keys.
// "custom" means a free-typed number with no bounds or step.
export const RATING_SCALES = {
  "10": { label: "1-10", max: 10, step: 1 },
  "10-half": { label: "1-10 (half steps)", max: 10, step: 0.5 },
  "5": { label: "1-5", max: 5, step: 1 },
  "5-half": { label: "1-5 (half steps)", max: 5, step: 0.5 },
  custom: { label: "Custom (type any number)", max: null, step: null },
};

export const DEFAULT_RATING_SCALE = "10";

// Resolve the user's chosen scale key, falling back to the default for
// signed-out users, unset metadata, or unknown values.
export function getRatingScaleKey(user) {
  const key = user?.user_metadata?.rating_scale;
  return RATING_SCALES[key] ? key : DEFAULT_RATING_SCALE;
}

export function getRatingScale(user) {
  return RATING_SCALES[getRatingScaleKey(user)];
}

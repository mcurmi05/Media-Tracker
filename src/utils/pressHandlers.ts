// Drive a press/sink effect via pointer events instead of CSS :active. On
// mobile a quick tap often navigates before an :active frame paints;
// pointerdown fires immediately on touch, so the sink is reliably shown.
//
// To avoid pressing during a scroll/swipe, we record where the touch started
// and drop the press as soon as the finger moves past a small threshold — a
// tap stays still and keeps the press, a swipe moves and loses it.
//
// Spread onto any clickable element and pair with a CSS rule that scales the
// element down when it has the `is-pressed` class (see `transform: scale(...)`).
const PRESS_MOVE_TOLERANCE = 8; // px

export const PRESS_HANDLERS = {
  onPointerDown: (e) => {
    const el = e.currentTarget;
    el._pressX = e.clientX;
    el._pressY = e.clientY;
    el.classList.add("is-pressed");
  },
  onPointerMove: (e) => {
    const el = e.currentTarget;
    if (!el.classList.contains("is-pressed")) return;
    const dx = e.clientX - (el._pressX ?? e.clientX);
    const dy = e.clientY - (el._pressY ?? e.clientY);
    if (dx * dx + dy * dy > PRESS_MOVE_TOLERANCE * PRESS_MOVE_TOLERANCE) {
      el.classList.remove("is-pressed");
    }
  },
  onPointerUp: (e) => e.currentTarget.classList.remove("is-pressed"),
  onPointerCancel: (e) => e.currentTarget.classList.remove("is-pressed"),
  onPointerLeave: (e) => e.currentTarget.classList.remove("is-pressed"),
};

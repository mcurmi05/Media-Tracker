// Mouse handlers for a non-anchor element that navigates within the SPA. A
// normal left click navigates in place (via react-router); a middle click or a
// Cmd/Ctrl click opens the destination route in a new browser tab, matching how
// real links behave. Spread the returned object onto the clickable element:
//
//   <div {...makeNavHandlers(navigate, `/mediadetails/${type}/${id}`)} />
//
// `to` is a route path string; `options` is forwarded to react-router navigate
// for the in-place case (e.g. { state }). New tabs load the route fresh, so any
// router state is intentionally dropped there (the destination pages can all
// rebuild from the URL alone).
export function makeNavHandlers(navigate, to, options) {
  if (!to) return {};
  const openNewTab = () => window.open(to, "_blank", "noopener");
  return {
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey) {
        openNewTab();
        return;
      }
      navigate(to, options);
    },
    onAuxClick: (e) => {
      if (e.button === 1) {
        // middle mouse button
        e.preventDefault();
        openNewTab();
      }
    },
  };
}

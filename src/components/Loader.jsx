import "../styles/Loader.css";

// Full-page loading spinner shown while a page's data is still loading, so the
// page swaps straight to a blank screen with the spinner instead of rendering
// half-populated chrome.
export default function Loader() {
  return (
    <div className="app-loader">
      <span className="app-spinner" aria-hidden="true" />
    </div>
  );
}

// Small inline circle spinner for buttons, the nav bar and inline text spots,
// used instead of any "Loading..." text label.
export function Spinner({ className = "" }) {
  return (
    <span
      className={`app-spinner app-spinner--sm ${className}`.trim()}
      role="status"
      aria-label="Loading"
    />
  );
}

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

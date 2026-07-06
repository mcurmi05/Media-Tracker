import "../../styles/common/Pagination.css";
import { pageBounds } from "../../hooks/usePagination";

// Build a shadcn-style page list with ellipsis gaps: always the first/last page
// plus a window around the current one, with "…" filling any jump > 1.
function pageList(current: number, total: number) {
  const delta = 1;
  const pages: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    }
  }
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const i of pages) {
    if (prev) {
      if (i - prev === 2) out.push(prev + 1);
      else if (i - prev > 2) out.push("…");
    }
    out.push(i);
    prev = i;
  }
  return out;
}

// Renders the count + numbered page links + page-size selector for a paged list.
// Drive it from usePagination(); pass the current totalCount. Hidden when empty.
// `position="bottom"` hides itself on single-page lists (top copy is enough).
export default function PaginationControls({ pag, totalCount, position = "top" }) {
  const { page, setPage, pageSize, setPageSize } = pag;
  const { totalPages, safePage } = pageBounds(page, pageSize, totalCount);
  if (totalCount === 0) return null;
  if (position === "bottom" && totalPages <= 1) return null;

  const goTo = (p: number) => {
    setPage(() => Math.min(totalPages - 1, Math.max(0, p)));
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="pagination">
      {totalPages > 1 && (
        <nav className="pagination-nav" aria-label="Pagination">
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => goTo(safePage - 1)}
            disabled={safePage === 0}
            aria-label="Previous page"
          >
            ‹
          </button>
          {pageList(safePage + 1, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination-page${
                  p - 1 === safePage ? " active" : ""
                }`}
                onClick={() => goTo(p - 1)}
                aria-current={p - 1 === safePage ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => goTo(safePage + 1)}
            disabled={safePage >= totalPages - 1}
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}
      <select
        value={pageSize}
        onChange={(e) =>
          setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))
        }
      >
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={75}>75</option>
        <option value={100}>100</option>
        <option value="all">All</option>
      </select>
    </div>
  );
}

import "../../styles/common/Pagination.css";
import { pageBounds } from "../../hooks/usePagination";

// Renders the count + page-size selector + prev/next arrows for a paged list.
// Drive it from usePagination(); pass the current totalCount. Hidden when empty.
export default function PaginationControls({ pag, totalCount }) {
  const { page, setPage, pageSize, setPageSize } = pag;
  const { totalPages, safePage, shownFrom, shownTo } = pageBounds(
    page,
    pageSize,
    totalCount,
  );
  if (totalCount === 0) return null;

  return (
    <div className="pagination">
      <span>
        Showing {shownFrom}–{shownTo} of {totalCount}
      </span>
      {totalPages > 1 && (
        <div className="pagination-nav">
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => {
              setPage((p) => Math.max(0, p - 1));
              window.scrollTo({ top: 0 });
            }}
            disabled={safePage === 0}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="pagination-indicator">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => {
              setPage((p) => Math.min(totalPages - 1, p + 1));
              window.scrollTo({ top: 0 });
            }}
            disabled={safePage >= totalPages - 1}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
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

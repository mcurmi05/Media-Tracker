import { useEffect, useState } from "react";

// Shared list paging: a page-size cap (number or "all") plus prev/next paging.
// `resetKey` should encode the active filters/sort so the page snaps back to 1
// whenever the list is resized or reordered. Same behaviour as the Log page.
//
// The hook only holds state (so it can be called before any early return); the
// count-dependent bounds are derived separately via pageBounds() at render time
// once the filtered list length is known.
export function usePagination(resetKey: string) {
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [page, setPage] = useState(0);

  // Any filter/sort/page-size change sends the user back to page 1.
  useEffect(() => {
    setPage(0);
  }, [resetKey, pageSize]);

  return { page, setPage, pageSize, setPageSize };
}

export function pageBounds(
  page: number,
  pageSize: number | "all",
  totalCount: number,
) {
  const totalPages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = pageSize === "all" ? 0 : safePage * pageSize;
  const pageEnd = pageSize === "all" ? Infinity : pageStart + pageSize;
  const shownFrom = totalCount === 0 ? 0 : pageStart + 1;
  const shownTo = Math.min(
    pageSize === "all" ? totalCount : pageStart + pageSize,
    totalCount,
  );
  return { totalPages, safePage, pageStart, pageEnd, shownFrom, shownTo };
}

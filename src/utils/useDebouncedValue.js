import { useEffect, useState } from "react";

// Returns a copy of `value` that only updates after it has stopped changing for
// `delay` ms. Used to debounce search inputs so expensive list filtering doesn't
// run on every keystroke (the input stays instant; the filtered results catch
// up shortly after typing stops).
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

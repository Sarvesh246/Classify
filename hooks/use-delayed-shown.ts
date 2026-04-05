import { useEffect, useState } from "react";

/**
 * Becomes `true` only after `active` stays true for `ms` — avoids flashing loaders on fast work.
 */
export function useDelayedShown(active: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = window.setTimeout(() => setShown(true), ms);
    return () => {
      window.clearTimeout(id);
      setShown(false);
    };
  }, [active, ms]);

  return active && shown;
}

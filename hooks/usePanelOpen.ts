import { useCallback, useEffect, useState } from 'react';
import { panelOpenItem } from '../utils/storage';

export function usePanelOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void panelOpenItem.getValue().then((value) => {
      if (alive) setOpen(value ?? false);
    });
    const unwatch = panelOpenItem.watch((value) => setOpen(value ?? false));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      void panelOpenItem.setValue(!prev);
      return !prev;
    });
  }, []);

  return [open, toggle];
}

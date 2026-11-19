import { useEffect, useState } from 'react';
import { loadRoads } from './siteData';
import type { RoadCollection } from './roadWidth';

/** Road centrelines once loaded, null until then or when unavailable. */
export function useRoads(): RoadCollection | null {
  const [roads, setRoads] = useState<RoadCollection | null>(null);
  useEffect(() => {
    let isCurrent = true;
    void loadRoads().then((loaded) => {
      if (isCurrent) setRoads(loaded);
    });
    return () => {
      isCurrent = false;
    };
  }, []);
  return roads;
}

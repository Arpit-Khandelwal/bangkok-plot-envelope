import { useEffect, useMemo, useState } from 'react';
import { evaluate } from '../core/evaluate';
import type { Evaluation, Scenario } from '../core/types';
import { locateZone, nearestStation } from '../site/context';
import type { NearestStation, ZoneLookup } from '../site/context';
import { loadSiteData } from '../site/siteData';
import type { SiteData } from '../site/siteData';
import { useAppStore } from './store';
import type { AppState } from './store';

export type DataStatus =
  | { readonly state: 'loading' }
  | { readonly state: 'ready' }
  | { readonly state: 'error'; readonly message: string };

export interface EvaluationView {
  /** Null when no plot is drawn, or while the zone map is still loading. */
  readonly evaluation: Evaluation | null;
  /** Null when no plot is drawn or the zone map is not available. */
  readonly zoneLookup: ZoneLookup | null;
  readonly station: NearestStation | null;
  readonly dataStatus: DataStatus;
}

type ScenarioInputs = Pick<
  AppState,
  'edges' | 'buildingType' | 'assumptions' | 'interpretation' | 'disabledRuleIds'
> & { readonly plot: NonNullable<AppState['plot']> };

/** Builds the evaluation input from app state and the site lookups. Pure. */
export function buildScenario(
  inputs: ScenarioInputs,
  zoneLookup: ZoneLookup | null,
  station: NearestStation | null,
): Scenario {
  return {
    plot: inputs.plot,
    edges: inputs.edges,
    buildingType: inputs.buildingType,
    zone: zoneLookup?.status === 'single' ? zoneLookup.zone : null,
    stationDistanceM: station ? station.distanceM : null,
    assumptions: inputs.assumptions,
    interpretation: inputs.interpretation,
    disabledRuleIds: inputs.disabledRuleIds,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

function useSiteData(): { readonly data: SiteData | null; readonly status: DataStatus } {
  const [data, setData] = useState<SiteData | null>(null);
  const [status, setStatus] = useState<DataStatus>({ state: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    loadSiteData()
      .then((loaded) => {
        if (!isCurrent) return;
        setData(loaded);
        setStatus({ state: 'ready' });
      })
      .catch((error: unknown) => {
        if (isCurrent) setStatus({ state: 'error', message: errorMessage(error) });
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return { data, status };
}

/** Loads the site data once and evaluates the current scenario, once per input change. */
export function useEvaluation(): EvaluationView {
  const { data, status } = useSiteData();
  const plot = useAppStore((state) => state.plot);
  const edges = useAppStore((state) => state.edges);
  const buildingType = useAppStore((state) => state.buildingType);
  const assumptions = useAppStore((state) => state.assumptions);
  const interpretation = useAppStore((state) => state.interpretation);
  const disabledRuleIds = useAppStore((state) => state.disabledRuleIds);

  const zoneLookup = useMemo(() => (plot && data ? locateZone(plot, data.zones) : null), [plot, data]);
  const station = useMemo(() => (plot && data ? nearestStation(plot, data.stations) : null), [plot, data]);

  // While the zone map loads there is no zone, and evaluating would wrongly report "outside ย.7".
  const isWaiting = status.state === 'loading';
  const evaluation = useMemo(() => {
    if (!plot || isWaiting) return null;
    const inputs = { plot, edges, buildingType, assumptions, interpretation, disabledRuleIds };
    return evaluate(buildScenario(inputs, zoneLookup, station));
  }, [plot, isWaiting, edges, buildingType, assumptions, interpretation, disabledRuleIds, zoneLookup, station]);

  return useMemo(
    () => ({ evaluation, zoneLookup, station, dataStatus: status }),
    [evaluation, zoneLookup, station, status],
  );
}

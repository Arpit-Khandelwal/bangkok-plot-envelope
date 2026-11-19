import { create } from 'zustand';
import type { Assumptions, BuildingType, EdgeSpec, Interpretation, LngLat } from '../core/types';
import { DEFAULT_ASSUMPTIONS, DEFAULT_INTERPRETATION } from './defaults';
import { neighbourEdges, remapEdges } from './edges';

export interface PlotPreset {
  readonly plot: readonly LngLat[];
  readonly edges: readonly EdgeSpec[];
  readonly buildingType: BuildingType;
}

export interface AppState {
  /** Plot outline as an open ring, or null before one is drawn. */
  readonly plot: readonly LngLat[] | null;
  readonly edges: readonly EdgeSpec[];
  readonly buildingType: BuildingType;
  readonly assumptions: Assumptions;
  readonly interpretation: Interpretation;
  readonly disabledRuleIds: readonly string[];
  readonly selectedDesignId: string | null;
  readonly selectedEdge: number | null;
  /** Bumped when the plot is replaced from outside the map, so the map redraws it. */
  readonly plotRevision: number;

  /** Called by the map while the outline is drawn or edited. Edge settings follow the edit. */
  readonly setPlotFromMap: (plot: readonly LngLat[] | null) => void;
  readonly loadPreset: (preset: PlotPreset) => void;
  readonly clearPlot: () => void;
  readonly setEdge: (index: number, spec: EdgeSpec) => void;
  readonly selectEdge: (index: number | null) => void;
  readonly setBuildingType: (buildingType: BuildingType) => void;
  readonly setAssumption: <Key extends keyof Assumptions>(key: Key, value: Assumptions[Key]) => void;
  readonly setInterpretation: <Key extends keyof Interpretation>(key: Key, value: Interpretation[Key]) => void;
  readonly toggleRule: (ruleId: string) => void;
  readonly enableAllRules: () => void;
  readonly selectDesign: (designId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  plot: null,
  edges: [],
  buildingType: 'condo',
  assumptions: DEFAULT_ASSUMPTIONS.condo,
  interpretation: DEFAULT_INTERPRETATION,
  disabledRuleIds: [],
  selectedDesignId: null,
  selectedEdge: null,
  plotRevision: 0,

  setPlotFromMap: (plot) =>
    set((state) => {
      if (!plot) return { plot: null, edges: [], selectedEdge: null };
      const edges = state.plot ? remapEdges(state.plot, state.edges, plot) : neighbourEdges(plot.length);
      const selectedEdge = state.selectedEdge !== null && state.selectedEdge < plot.length ? state.selectedEdge : null;
      return { plot, edges, selectedEdge };
    }),

  loadPreset: (preset) =>
    set((state) => ({
      plot: preset.plot,
      edges: preset.edges,
      buildingType: preset.buildingType,
      assumptions: DEFAULT_ASSUMPTIONS[preset.buildingType],
      disabledRuleIds: [],
      selectedDesignId: null,
      selectedEdge: null,
      plotRevision: state.plotRevision + 1,
    })),

  clearPlot: () =>
    set((state) => ({
      plot: null,
      edges: [],
      selectedEdge: null,
      selectedDesignId: null,
      plotRevision: state.plotRevision + 1,
    })),

  setEdge: (index, spec) =>
    set((state) => ({
      edges: state.edges.map((existing, edgeIndex) => (edgeIndex === index ? spec : existing)),
    })),

  selectEdge: (index) => set({ selectedEdge: index }),

  setBuildingType: (buildingType) =>
    set({ buildingType, assumptions: DEFAULT_ASSUMPTIONS[buildingType], selectedDesignId: null }),

  setAssumption: (key, value) => set((state) => ({ assumptions: { ...state.assumptions, [key]: value } })),

  setInterpretation: (key, value) => set((state) => ({ interpretation: { ...state.interpretation, [key]: value } })),

  toggleRule: (ruleId) =>
    set((state) => ({
      disabledRuleIds: state.disabledRuleIds.includes(ruleId)
        ? state.disabledRuleIds.filter((id) => id !== ruleId)
        : [...state.disabledRuleIds, ruleId],
    })),

  enableAllRules: () => set({ disabledRuleIds: [] }),

  selectDesign: (designId) => set({ selectedDesignId: designId }),
}));

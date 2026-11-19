import type { Assumptions, BuildingType, EdgeSpec, Interpretation, LngLat } from '../core/types';
import {
  ASSUMPTION_LIMITS,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_INTERPRETATION,
  MAX_ROAD_WIDTH_M,
  MAX_WATERWAY_WIDTH_M,
  MIN_ROAD_WIDTH_M,
} from './defaults';

/**
 * Hash format, version 1: `v1=<plot>~<edges>~<type>~<assumptions>~<interpretation>~<rules>~<design>`.
 * Sections are positional; trailing empty sections are dropped.
 *  - plot: base-36 signed integers in millionths of a degree: lng0,lat0, then dlng,dlat per later
 *    corner relative to the first corner.
 *  - edges: comma-separated tokens: `n` neighbour, `r<roadId>:<width>` road, `w<width>` waterway.
 *  - type: `c` condo or `o` office.
 *  - assumptions: `<key letter><value>` pairs, only where they differ from the type's defaults.
 *  - interpretation: letters of the switches that differ from the default: `f` parking in FAR,
 *    `o` office parking in operating area.
 *  - rules: disabled rule ids, comma-separated. design: the selected design id.
 */
export const HASH_VERSION = 'v1';

export interface ScenarioFields {
  readonly plot: readonly LngLat[];
  readonly edges: readonly EdgeSpec[];
  readonly buildingType: BuildingType;
  readonly assumptions: Assumptions;
  readonly interpretation: Interpretation;
  readonly disabledRuleIds: readonly string[];
  readonly selectedDesignId: string | null;
}

export type DecodedScenario = ScenarioFields;

const MICRODEG = 1e6;
const MIN_CORNERS = 3;
const MAX_CORNERS = 200;
const MAX_RULES = 20;
const MAX_TEXT_LENGTH = 4000;
const SECTION_SEPARATOR = '~';
const LIST_SEPARATOR = ',';
const MAX_DECIMALS = 4;
const MIN_SECTIONS = 3;
const MAX_SECTIONS = 7;

/** A generous box around Bangkok and its metropolitan area. */
const BOUNDS = { minLng: 99.5, maxLng: 101.5, minLat: 12.8, maxLat: 14.8 } as const;

const BASE36_INT = /^-?[0-9a-z]{1,10}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const ROAD_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,31}$/;
const NUMBER_PATTERN = /^\d{1,4}(\.\d{1,6})?$/;
const PREFIX = `${HASH_VERSION}=`;

const ASSUMPTION_KEYS: ReadonlyArray<readonly [letter: string, key: keyof Assumptions]> = [
  ['f', 'floorToFloorM'],
  ['p', 'parkingFloorToFloorM'],
  ['e', 'efficiency'],
  ['u', 'averageUnitM2'],
  ['s', 'shareOfUnitsOver60M2'],
  ['k', 'parkingM2PerStall'],
  ['a', 'parapetM'],
];

const BUILDING_CODES: Readonly<Record<BuildingType, string>> = { condo: 'c', office: 'o' };

// ---------- Encoding ----------

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function writeNumber(value: number): string {
  return String(roundTo(value, MAX_DECIMALS));
}

function toBase36(value: number): string {
  return value.toString(36);
}

function encodePlot(plot: readonly LngLat[]): string {
  const rounded = plot.map(([lng, lat]) => [Math.round(lng * MICRODEG), Math.round(lat * MICRODEG)] as const);
  const [first] = rounded;
  if (!first) return '';
  const parts: string[] = [toBase36(first[0]), toBase36(first[1])];
  for (const [x, y] of rounded.slice(1)) parts.push(toBase36(x - first[0]), toBase36(y - first[1]));
  return parts.join(LIST_SEPARATOR);
}

function safeId(id: string): string {
  const cleaned = id.toLowerCase().replace(/[^a-z0-9.-]/g, '-').slice(0, 32);
  return ROAD_ID_PATTERN.test(cleaned) ? cleaned : 'road';
}

function encodeEdge(spec: EdgeSpec): string {
  switch (spec.kind) {
    case 'neighbour':
      return 'n';
    case 'road':
      return `r${safeId(spec.roadId)}:${writeNumber(spec.rowWidthM)}`;
    case 'waterway':
      return `w${writeNumber(spec.widthM)}`;
  }
}

function encodeAssumptions(type: BuildingType, assumptions: Assumptions): string {
  const defaults = DEFAULT_ASSUMPTIONS[type];
  return ASSUMPTION_KEYS.filter(([, key]) => roundTo(assumptions[key], MAX_DECIMALS) !== defaults[key])
    .map(([letter, key]) => `${letter}${writeNumber(assumptions[key])}`)
    .join(LIST_SEPARATOR);
}

function encodeInterpretation(interpretation: Interpretation): string {
  return [
    interpretation.parkingCountsInFar === DEFAULT_INTERPRETATION.parkingCountsInFar ? '' : 'f',
    interpretation.officeParkingCountsInOperatingArea === DEFAULT_INTERPRETATION.officeParkingCountsInOperatingArea ? '' : 'o',
  ].join('');
}

/** The scenario as a short URL-safe string such as `v1=...`, without a leading `#`. */
export function encodeScenario(state: ScenarioFields): string {
  const sections = [
    encodePlot(state.plot),
    state.edges.map(encodeEdge).join(LIST_SEPARATOR),
    BUILDING_CODES[state.buildingType],
    encodeAssumptions(state.buildingType, state.assumptions),
    encodeInterpretation(state.interpretation),
    state.disabledRuleIds.filter((id) => ID_PATTERN.test(id)).join(LIST_SEPARATOR),
    state.selectedDesignId !== null && ID_PATTERN.test(state.selectedDesignId) ? state.selectedDesignId : '',
  ];
  while (sections.length > MIN_SECTIONS && sections[sections.length - 1] === '') sections.pop();
  return `${PREFIX}${sections.join(SECTION_SEPARATOR)}`;
}

// ---------- Decoding ----------

function parseBase36(token: string): number | null {
  if (!BASE36_INT.test(token)) return null;
  const value = parseInt(token, 36);
  return Number.isSafeInteger(value) ? value : null;
}

function inBounds([lng, lat]: LngLat): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= BOUNDS.minLng &&
    lng <= BOUNDS.maxLng &&
    lat >= BOUNDS.minLat &&
    lat <= BOUNDS.maxLat
  );
}

function decodePlot(section: string): LngLat[] | null {
  const numbers = section.split(LIST_SEPARATOR).map(parseBase36);
  const count = numbers.length / 2;
  if (!Number.isInteger(count) || count < MIN_CORNERS || count > MAX_CORNERS) return null;
  const [x0, y0] = numbers;
  if (x0 === null || y0 === null || x0 === undefined || y0 === undefined) return null;
  const plot: LngLat[] = [];
  for (let index = 0; index < count; index += 1) {
    const dx = numbers[index * 2];
    const dy = numbers[index * 2 + 1];
    if (dx === null || dy === null || dx === undefined || dy === undefined) return null;
    const point: LngLat = index === 0 ? [x0 / MICRODEG, y0 / MICRODEG] : [(x0 + dx) / MICRODEG, (y0 + dy) / MICRODEG];
    if (!inBounds(point)) return null;
    plot.push(point);
  }
  return plot;
}

function parseWidth(text: string, min: number, max: number): number | null {
  if (!NUMBER_PATTERN.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function decodeEdge(token: string): EdgeSpec | null {
  if (token === 'n') return { kind: 'neighbour' };
  if (token.startsWith('w')) {
    const widthM = parseWidth(token.slice(1), MIN_ROAD_WIDTH_M, MAX_WATERWAY_WIDTH_M);
    return widthM === null ? null : { kind: 'waterway', widthM };
  }
  if (token.startsWith('r')) {
    const [roadId, width, ...rest] = token.slice(1).split(':');
    if (rest.length > 0 || roadId === undefined || width === undefined || !ROAD_ID_PATTERN.test(roadId)) return null;
    const rowWidthM = parseWidth(width, MIN_ROAD_WIDTH_M, MAX_ROAD_WIDTH_M);
    return rowWidthM === null ? null : { kind: 'road', roadId, rowWidthM };
  }
  return null;
}

function decodeEdges(section: string, count: number): EdgeSpec[] | null {
  const tokens = section.split(LIST_SEPARATOR);
  if (tokens.length !== count) return null;
  const edges: EdgeSpec[] = [];
  for (const token of tokens) {
    const spec = decodeEdge(token);
    if (!spec) return null;
    edges.push(spec);
  }
  return edges;
}

function decodeBuildingType(code: string): BuildingType | null {
  return code === 'c' ? 'condo' : code === 'o' ? 'office' : null;
}

function decodeAssumptions(section: string, type: BuildingType): Assumptions | null {
  const result: { -readonly [K in keyof Assumptions]: Assumptions[K] } = { ...DEFAULT_ASSUMPTIONS[type] };
  if (section === '') return result;
  const seen = new Set<string>();
  for (const token of section.split(LIST_SEPARATOR)) {
    const letter = token.charAt(0);
    const entry = ASSUMPTION_KEYS.find(([candidate]) => candidate === letter);
    if (!entry || seen.has(letter)) return null;
    seen.add(letter);
    const limits = ASSUMPTION_LIMITS[entry[1]];
    const value = parseWidth(token.slice(1), limits.min, limits.max);
    if (value === null) return null;
    result[entry[1]] = value;
  }
  return result;
}

function decodeInterpretation(section: string): Interpretation | null {
  if (!/^f?o?$/.test(section)) return null;
  return {
    parkingCountsInFar: section.includes('f') ? !DEFAULT_INTERPRETATION.parkingCountsInFar : DEFAULT_INTERPRETATION.parkingCountsInFar,
    officeParkingCountsInOperatingArea: section.includes('o')
      ? !DEFAULT_INTERPRETATION.officeParkingCountsInOperatingArea
      : DEFAULT_INTERPRETATION.officeParkingCountsInOperatingArea,
  };
}

function decodeRules(section: string): string[] | null {
  if (section === '') return [];
  const ids = section.split(LIST_SEPARATOR);
  if (ids.length > MAX_RULES || !ids.every((id) => ID_PATTERN.test(id)) || new Set(ids).size !== ids.length) return null;
  return ids;
}

function readPayload(text: string): string | null {
  if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) return null;
  let raw = text.startsWith('#') ? text.slice(1) : text;
  if (raw.includes('%')) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : null;
}

function decodeSections(sections: readonly string[]): DecodedScenario | null {
  const [plotText = '', edgesText = '', typeText = '', assumptionsText = '', interpretationText = '', rulesText = '', designText = ''] =
    sections;
  const plot = decodePlot(plotText);
  const edges = plot ? decodeEdges(edgesText, plot.length) : null;
  const buildingType = decodeBuildingType(typeText);
  const assumptions = buildingType ? decodeAssumptions(assumptionsText, buildingType) : null;
  const interpretation = decodeInterpretation(interpretationText);
  const disabledRuleIds = decodeRules(rulesText);
  const designValid = designText === '' || ID_PATTERN.test(designText);
  if (!plot || !edges || !buildingType || !assumptions || !interpretation || !disabledRuleIds || !designValid) return null;
  return {
    plot,
    edges,
    buildingType,
    assumptions,
    interpretation,
    disabledRuleIds,
    selectedDesignId: designText === '' ? null : designText,
  };
}

/** Parses a location hash. Untrusted input: returns null on anything invalid, never throws. */
export function decodeScenario(text: string): DecodedScenario | null {
  try {
    const payload = readPayload(text);
    if (payload === null) return null;
    const sections = payload.split(SECTION_SEPARATOR);
    if (sections.length < MIN_SECTIONS || sections.length > MAX_SECTIONS) return null;
    return decodeSections(sections);
  } catch {
    return null;
  }
}

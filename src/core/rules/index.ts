import { BUILDING_CONTROL_RULES as CONTROL, ZONES as ZONE_DATA } from './data';
export { resolveRules, resolveRulesWith } from './resolve';
export { BLOCK_NO_ROAD, BLOCK_ZONE_UNSUPPORTED, BUILDING_CONTROL_RULES, ZONES, findZone } from './data';
export { collectRoads } from './context';
export type { RoadFront } from './context';
export { heightRoads } from './height-roads';
export { accessSpec, citationsOf, heightPlaneSpec, planFarRatio, planFarRuleIds, useSizeSpec } from './lookup';

/** Every rule id in the rule data, for checking ids that come from outside (a shared link). */
export const KNOWN_RULE_IDS: ReadonlySet<string> = new Set([...ZONE_DATA.flatMap((z) => z.rules), ...CONTROL].map((r) => r.meta.id));

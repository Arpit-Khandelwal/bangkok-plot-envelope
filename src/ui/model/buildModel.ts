import type { Design, Evaluation, FloorUse, RegimeId } from '../../core/types';
import type { ModelContent, ModelPart } from '../../map/modelLayer';

/** Colours handed to the 3D layer. They match the tokens in styles/tokens.css. */
export const GLASS_COLOUR = '#2f7dd1';
export const USE_COLOURS: Readonly<Record<FloorUse, string>> = {
  residential: '#fbfbf8',
  office: '#dfe9f2',
  parking: '#a9b4b6',
  mixed: '#ece9df',
};

export type OkEvaluation = Extract<Evaluation, { ok: true }>;

export function otherRegime(regime: RegimeId): RegimeId {
  return regime === 'lowRise' ? 'highRise' : 'lowRise';
}

/** The selected design, falling back to the first when the id is missing or stale. */
export function resolveDesign(evaluation: OkEvaluation, selectedDesignId: string | null): Design | null {
  return evaluation.designs.find((design) => design.id === selectedDesignId) ?? evaluation.designs[0] ?? null;
}

/**
 * What the map draws: the selected design's allowed space as glass, the other rule set's
 * allowed space as a faint ghost, and the design itself as solid floors coloured by use.
 */
export function buildModel(evaluation: Evaluation | null, selectedDesignId: string | null): ModelContent | null {
  if (!evaluation?.ok) return null;
  const design = resolveDesign(evaluation, selectedDesignId);
  if (!design) return null;

  const ownEnvelope = evaluation.regimes[design.regime].envelope;
  const otherId = otherRegime(design.regime);
  const otherEnvelope = evaluation.regimes[otherId].envelope;

  const parts: ModelPart[] = [];
  if (ownEnvelope) {
    parts.push({ key: `envelope-${design.regime}`, mesh: ownEnvelope.mesh, look: 'glass', color: GLASS_COLOUR });
  }
  if (otherEnvelope) {
    parts.push({ key: `envelope-${otherId}`, mesh: otherEnvelope.mesh, look: 'ghost', color: GLASS_COLOUR });
  }
  design.massing.forEach((part, index) => {
    parts.push({ key: `${design.id}-${part.use}-${index}`, mesh: part.mesh, look: 'solid', color: USE_COLOURS[part.use] });
  });

  return { origin: evaluation.site.frame.origin, parts };
}

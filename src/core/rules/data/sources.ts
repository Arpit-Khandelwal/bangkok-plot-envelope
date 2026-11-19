/**
 * Source documents, from the source key at the top of research/01-regulations.md.
 * Confidence follows the research tags: VERIFIED -> 'verified', CORROBORATED -> 'corroborated',
 * UNVERIFIED -> 'assumption'.
 */
import type { Citation, Confidence } from '../../types';
import type { SourceKey } from './spec';

interface SourceDocument {
  readonly document: string;
  readonly url: string;
}

export const SOURCES: Readonly<Record<SourceKey, SourceDocument>> = {
  Plan2556: {
    document: 'Bangkok Comprehensive Plan B.E. 2556',
    url: 'https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf',
  },
  MR55: {
    document: 'Ministerial Regulation No. 55 B.E. 2543',
    url: 'https://download.asa.or.th/03media/04law/fubr/a1_bcmr55-63.pdf',
  },
  MR33: {
    document: 'Ministerial Regulation No. 33 B.E. 2535',
    url: 'https://download.asa.or.th/03media/04law/fubr/a3_bcmr33-64.pdf',
  },
  BMA2544: {
    document: 'Bangkok Building Control Ordinance B.E. 2544',
    url: 'https://download.asa.or.th/03media/04law/cba/bb/bb44-03.pdf',
  },
  MR7: {
    document: 'Ministerial Regulation No. 7 B.E. 2517',
    url: 'https://download.asa.or.th/03media/04law/cba/mr/mr17-07-upd64.pdf',
  },
  EIA: {
    document: 'ONEP environmental impact assessment guidance',
    url: 'https://www.onep.go.th/eia/',
  },
};

export function cite(source: SourceKey, clause: string, confidence: Confidence): Citation {
  const doc = SOURCES[source];
  return { document: doc.document, clause, url: doc.url, confidence };
}

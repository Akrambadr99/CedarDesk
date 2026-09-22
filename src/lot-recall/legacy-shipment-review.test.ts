import { describe, expect, it } from 'vitest';
import { BrowserRecallAttemptPersistence, getRecallLineageBalance, initialRecallPortfolioState, recordLegacyShipmentAttestation, recordRecallShipmentReturn, recordRecallShipmentSource, reviewLegacyShipmentAttestation } from './recall-control-domain';

const intake = { id: 'legacy-line-1', expectedRevision: 0, authority: 'Quality Analyst' as const, recallId: 'RECALL-SEAL-B88', shipmentReference: 'SHIP-OLD-77', lineReference: 'LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 20, attestationReference: 'HISTORICAL-ATTESTATION-77', recordedBy: 'Traceability analyst' };
const review = { id: 'legacy-review-1', authority: 'Quality Director' as const, shipmentSourceId: intake.id, decision: 'accepted' as const, supportingEvidence: 'Signed dispatch line and original customer receipt inspected.', reviewer: 'Quality director', reviewedOn: '2026-10-24' };

describe('legacy shipment lineage', () => {
  it('keeps imported quantity unresolved until independent review pins actual evidence', () => {
    const imported = recordLegacyShipmentAttestation(initialRecallPortfolioState, intake);
    expect(imported.shipmentSources[0]).toMatchObject({ legacyAttestation: intake.attestationReference, sourceDocument: '', sourceRevision: 0 });
    expect(getRecallLineageBalance(imported, intake.recallId)).toMatchObject({ tracedShipmentUnits: 0, untracedUnits: 45 });
    expect(() => reviewLegacyShipmentAttestation(imported, { ...review, expectedRevision: imported.revision, reviewer: intake.recordedBy })).toThrow('Independent reviewer');
    expect(() => recordRecallShipmentReturn(imported, { id: 'early-return', expectedRevision: imported.revision, authority: 'Quality Director', shipmentSourceId: intake.id, returnedUnits: 1, custodyReference: 'CUSTODY-1', receivedBy: 'Recovery desk', receivedOn: '2026-10-24' })).toThrow('independent acceptance');
    const accepted = reviewLegacyShipmentAttestation(imported, { ...review, expectedRevision: imported.revision });
    expect(getRecallLineageBalance(accepted, intake.recallId)).toMatchObject({ tracedShipmentUnits: 20, untracedUnits: 25, complete: false });
    expect(accepted.shipmentSources[0]).toEqual(imported.shipmentSources[0]);
    expect(accepted.legacyShipmentReviews[0]).toMatchObject({ shipmentSourceId: intake.id, sourceRevision: 0, supportingEvidence: review.supportingEvidence, immutable: true });
  });

  it('retains rejected attestation while allowing a corrected source document for the same shipment line', () => {
    const imported = recordLegacyShipmentAttestation(initialRecallPortfolioState, intake);
    const rejected = reviewLegacyShipmentAttestation(imported, { ...review, expectedRevision: imported.revision, decision: 'rejected' });
    expect(getRecallLineageBalance(rejected, intake.recallId)?.untracedUnits).toBe(45);
    const corrected = recordRecallShipmentSource(rejected, { id: 'corrected-source', expectedRevision: rejected.revision, authority: 'Quality Analyst', recallId: intake.recallId, shipmentReference: intake.shipmentReference, lineReference: intake.lineReference, customerId: intake.customerId, lotReference: intake.lotReference, affectedUnits: 20, sourceDocument: 'SIGNED-DISPATCH-77', recordedBy: 'Traceability analyst' });
    expect(corrected.shipmentSources).toHaveLength(2);
    expect(corrected.legacyShipmentReviews).toEqual(rejected.legacyShipmentReviews);
    expect(getRecallLineageBalance(corrected, intake.recallId)?.tracedShipmentUnits).toBe(20);
  });

  it('loads older saved attestations with absent source evidence as unverified', () => {
    const imported = recordLegacyShipmentAttestation(initialRecallPortfolioState, intake);
    const stored = structuredClone(imported) as unknown as Record<string, unknown>;
    const sources = stored['shipmentSources'] as Record<string, unknown>[];
    delete sources[0]?.['sourceDocument'];
    delete sources[0]?.['sourceRevision'];
    delete stored['legacyShipmentReviews'];
    const persistence = new BrowserRecallAttemptPersistence({ getItem: () => JSON.stringify(stored), setItem: () => undefined });
    expect(persistence.load()).toMatchObject({ shipmentSources: [{ sourceDocument: '', sourceRevision: 0 }], legacyShipmentReviews: [] });
    expect(getRecallLineageBalance(persistence.load()!, intake.recallId)?.untracedUnits).toBe(45);
  });
});

import { describe, expect, it } from 'vitest';
import { BrowserRecallAttemptPersistence, getRecallLineageBalance, initialRecallPortfolioState, openRecallLineageInvestigation, proposeRecallResidualDisposition, reviewRecallResidualDisposition, recordLegacyShipmentAttestation, recordRecallShipmentReturn, recordRecallShipmentSource, reviewLegacyShipmentAttestation } from './recall-control-domain';

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

it('reconciles partial non-shipped quantity only after independent evidence review', () => {
  const opened = openRecallLineageInvestigation(initialRecallPortfolioState, { id: 'investigate-residual', expectedRevision: 0, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', conflictingShipmentReference: null, owner: 'Traceability analyst', evidenceRequired: 'Scrap log and lot quantity reconciliation', openedOn: '2026-10-22' });
  const proposal = { id: 'scrap-proposal', expectedRevision: opened.revision, authority: 'Quality Analyst' as const, investigationId: 'investigate-residual', kind: 'scrap' as const, units: 10, evidenceReference: 'SCRAP-LOG-B88', investigator: 'Traceability analyst', proposedOn: '2026-10-23' };
  expect(() => proposeRecallResidualDisposition(opened, { ...proposal, units: 46 })).toThrow('quantity');
  const submitted = proposeRecallResidualDisposition(opened, proposal);
  expect(getRecallLineageBalance(submitted, 'RECALL-SEAL-B88')).toMatchObject({ affectedUnits: 45, tracedShipmentUnits: 0, nonShippedUnits: 0, untracedUnits: 45 });
  const review = { id: 'scrap-review', expectedRevision: submitted.revision, authority: 'Quality Director' as const, dispositionId: proposal.id, decision: 'accepted' as const, reviewer: 'Quality director', reviewEvidence: 'Signed scrap count and lot log checked.', reviewedOn: '2026-10-24' };
  expect(() => reviewRecallResidualDisposition(submitted, { ...review, reviewer: proposal.investigator })).toThrow('Independent reviewer');
  const accepted = reviewRecallResidualDisposition(submitted, review);
  expect(getRecallLineageBalance(accepted, 'RECALL-SEAL-B88')).toMatchObject({ affectedUnits: 45, tracedShipmentUnits: 0, nonShippedUnits: 10, untracedUnits: 35, complete: false });
  expect(accepted.residualDispositions).toEqual(submitted.residualDispositions);
  expect(() => reviewRecallResidualDisposition(accepted, { ...review, id: 'duplicate-review', expectedRevision: accepted.revision })).toThrow('unreviewed');
  const second = proposeRecallResidualDisposition(accepted, { ...proposal, id: 'internal-proposal', expectedRevision: accepted.revision, kind: 'internal use', units: 35 });
  const final = reviewRecallResidualDisposition(second, { ...review, id: 'internal-review', dispositionId: 'internal-proposal', expectedRevision: second.revision });
  expect(getRecallLineageBalance(final, 'RECALL-SEAL-B88')).toMatchObject({ tracedShipmentUnits: 0, nonShippedUnits: 45, untracedUnits: 0, complete: true });
  const legacy = { getItem: () => JSON.stringify({ ...submitted, residualDispositions: undefined, residualReviews: undefined }), setItem: () => undefined };
  expect(new BrowserRecallAttemptPersistence(legacy).load()).toMatchObject({ residualDispositions: [], residualReviews: [] });
});

import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecallWorkloadControl } from './RecallWorkloadControl'
import { describe, expect, it } from 'vitest'
import { prepareRecallEffectivenessReview, getRecallCustomerIdentityCoverage, getRecallEffectivenessCoverage, proposeCustomerRecallDisposition, reviewCustomerRecallDisposition, getRecallReturnProcessing, processReturnedRecallUnits, browseRecallRecovery, BrowserRecallAttemptPersistence, determineRecallEffectiveness, getRecallLineageBalance, getRecallOperationalDrillDown, getRecallProductionLink, getRecallRecoveryTimeline, getRecallShipmentRecovery, initialRecallPortfolioState, inspectRecallIntegrity, openRecallLineageInvestigation, RecallControlError, reassignCriticalRecall, reconcileRecallDisposition, recordRecallNotification, recordRecallShipmentReturn, recordRecallShipmentSource, resolveRecallLineageInvestigation, reviewRecallLineageEvidence } from './recall-control-domain'

it('resolves only source-backed recall lineage and preserves residual quantity and original investigation', () => {
  const opened = openRecallLineageInvestigation(initialRecallPortfolioState, { id: 'investigate-1', expectedRevision: 0, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', conflictingShipmentReference: 'SHIP-UNKNOWN', owner: 'Traceability analyst', evidenceRequired: 'Original dispatch manifest and customer shipment line', openedOn: '2026-10-22' })
  expect(getRecallLineageBalance(opened, 'RECALL-SEAL-B88')).toMatchObject({ affectedUnits: 45, tracedShipmentUnits: 0, untracedUnits: 45 })
  expect(() => openRecallLineageInvestigation(initialRecallPortfolioState, { id: 'wrong-owner', expectedRevision: 0, authority: 'Quality Analyst', recallId: 'RECALL-SEAL-B88', conflictingShipmentReference: null, owner: 'analyst', evidenceRequired: 'Original dispatch manifest and customer shipment line', openedOn: '2026-10-22' })).toThrow('quality director')
  const line = recordRecallShipmentSource(opened, { id: 'line-after', expectedRevision: opened.revision, authority: 'Quality Analyst', recallId: 'RECALL-SEAL-B88', shipmentReference: 'SHIP-77', lineReference: 'LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 20, sourceDocument: 'DESPATCH-MANIFEST-77', recordedBy: 'analyst' })
  expect(getRecallLineageBalance(line, 'RECALL-SEAL-B88')?.untracedUnits).toBe(45)
  const resolution = { id: 'resolution-1', expectedRevision: line.revision, authority: 'Quality Analyst' as const, investigationId: 'investigate-1', shipmentSourceIds: ['line-after'], evidenceReference: 'DESPATCH-MANIFEST-77', resolvedBy: 'analyst', resolvedOn: '2026-10-23' }
  expect(() => resolveRecallLineageInvestigation(line, { ...resolution, shipmentSourceIds: ['made-up-line'] })).toThrow('attested shipment lines')
  const resolved = resolveRecallLineageInvestigation(line, resolution)
  expect(resolved.lineageResolutions[0]).toMatchObject({ resolvedUnits: 20, residualUnits: 25, immutable: true })
  expect(resolved.lineageInvestigations[0]).toEqual(opened.lineageInvestigations[0])
  expect(getRecallLineageBalance(resolved, 'RECALL-SEAL-B88')).toMatchObject({ tracedShipmentUnits: 0, untracedUnits: 45, complete: false })
  expect(resolveRecallLineageInvestigation(resolved, resolution)).toBe(resolved)
  const review = { id: 'review-1', expectedRevision: resolved.revision, authority: 'Quality Director' as const, resolutionId: 'resolution-1', decision: 'accepted' as const, reviewer: 'independent director', reviewEvidence: 'MANIFEST-REVIEW-77', reviewedOn: '2026-10-24' }
  expect(() => reviewRecallLineageEvidence(resolved, { ...review, reviewer: 'analyst' })).toThrow('Independent')
  expect(() => reviewRecallLineageEvidence(resolved, { ...review, expectedRevision: 0 })).toThrow('changed')
  const rejected = reviewRecallLineageEvidence(resolved, { ...review, decision: 'rejected' })
  expect(getRecallLineageBalance(rejected, 'RECALL-SEAL-B88')?.untracedUnits).toBe(45)
  expect(rejected.lineageResolutions).toEqual(resolved.lineageResolutions)
  const revised = resolveRecallLineageInvestigation(rejected, { ...resolution, id: 'resolution-2', expectedRevision: rejected.revision })
  const accepted = reviewRecallLineageEvidence(revised, { ...review, id: 'review-2', expectedRevision: revised.revision, resolutionId: 'resolution-2' })
  expect(getRecallLineageBalance(accepted, 'RECALL-SEAL-B88')).toMatchObject({ tracedShipmentUnits: 20, untracedUnits: 25, complete: false })
  expect(accepted.lineageReviews).toHaveLength(2)
  const old = { ...accepted } as Record<string, unknown>; delete old['lineageInvestigations']; delete old['lineageResolutions']; delete old['lineageReviews']
  expect(new BrowserRecallAttemptPersistence({ getItem: () => JSON.stringify(old), setItem: () => undefined }).load()).toMatchObject({ lineageInvestigations: [], lineageResolutions: [], lineageReviews: [] })
})
import { initialFactoryExecution } from '../factory/execution-control'

it('reports recall evidence integrity gaps without changing persisted business facts', () => {
  const state = structuredClone(initialRecallPortfolioState)
  state.shipmentSources.push({ id: 'line-1', recallId: 'RECALL-SEAL-B88', shipmentReference: '', lineReference: 'LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 50, sourceDocument: '', recordedBy: 'analyst', sourceRevision: 1, immutable: true })
  state.lineageInvestigations.push({ id: 'investigation-1', recallId: 'RECALL-SEAL-B88', affectedUnits: 45, tracedAtOpening: 0, openedAtRevision: 0, conflictingShipmentReference: null, owner: 'analyst', evidenceRequired: 'Original dispatch line', openedOn: '2026-10-22', immutable: true })
  state.lineageResolutions.push({ id: 'resolution-1', investigationId: 'investigation-1', shipmentSourceIds: ['missing-line'], sourceRevisions: { 'missing-line': 1 }, reviewRequired: true, resolvedUnits: 20, residualUnits: 25, evidenceReference: 'document-1', resolvedBy: 'analyst', resolvedOn: '2026-10-23', immutable: true })
  state.notificationAttempts.push({ id: 'attempt-1', recallId: 'RECALL-SEAL-B88', customerId: 'CUSTOMER-1', shipmentReference: 'SHIP-77', lotReference: 'SEAL-B88', unitReferences: ['UNIT-1'], recallRevision: 1, action: 'recall-notification', outcome: 'failed', failureReason: 'gateway failure', actor: 'operator', attemptedOn: '2026-10-22', retryOf: null, immutable: true })
  state.acknowledgements.push({ id: 'ack-1', recallId: 'RECALL-SEAL-B88', customerId: 'CUSTOMER-1', notificationAttemptId: 'attempt-1', acknowledgedBy: 'operator', acknowledgedOn: '2026-10-22', recallRevision: 1, immutable: true })
  const original = structuredClone(state)
  const findings = inspectRecallIntegrity(state, initialFactoryExecution, 'RECALL-SEAL-B88')
  expect(findings.map((item) => item.code)).toEqual(expect.arrayContaining(['PRODUCTION_SOURCE', 'QUANTITY', 'SHIPMENT_SOURCE', 'LINEAGE_REVIEW', 'ACKNOWLEDGEMENT']))
  expect(findings.every((item) => item.recordId && item.remediation)).toBe(true)
  expect(state).toEqual(original)
})

it('accepts verified production linkage and keeps notification retries from double-counting unit ownership', () => {
  const execution = structuredClone(initialFactoryExecution)
  execution.genealogy.push({ id: 'genealogy-1', orderId: 'order-1', inputLotId: 'lot-1', outputLotId: 'SEAL-B88', quantity: 100, verifiedBy: 'quality-a', at: '2026-10-20' })
  execution.allocations.push({ id: 'allocation-1', orderId: 'order-1', lotId: 'lot-1', kilograms: 200, requestedBy: 'supervisor-a', status: 'consumed', revision: 2 })
  const state = structuredClone(initialRecallPortfolioState)
  state.notificationAttempts.push({ id: 'attempt-1', recallId: 'RECALL-SEAL-B88', customerId: 'CUSTOMER-1', shipmentReference: 'SHIP-77', lotReference: 'SEAL-B88', unitReferences: ['UNIT-1'], recallRevision: 0, action: 'recall-notification', outcome: 'failed', failureReason: 'gateway failure', actor: 'operator', attemptedOn: '2026-10-22', retryOf: null, immutable: true })
  state.notificationAttempts.push({ ...state.notificationAttempts[0]!, id: 'attempt-2', outcome: 'acknowledged', failureReason: null, retryOf: 'attempt-1' })
  expect(inspectRecallIntegrity(state, execution, 'RECALL-SEAL-B88')).toEqual([])
  state.notificationAttempts.push({ ...state.notificationAttempts[0]!, id: 'attempt-3', customerId: 'CUSTOMER-2', retryOf: null })
  expect(inspectRecallIntegrity(state, execution, 'RECALL-SEAL-B88')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_UNIT', recordId: 'attempt-3' })]))
})

it('resolves recalled lot only through matching consumed allocation and verified factory genealogy', () => { const missing = getRecallProductionLink(initialRecallPortfolioState, initialFactoryExecution, 'RECALL-SEAL-B88'); expect(missing).toMatchObject({ status: 'missing', orderId: null }); const execution = structuredClone(initialFactoryExecution); execution.revision = 3; execution.genealogy.push({ id: 'genealogy-1', orderId: 'order-1', inputLotId: 'lot-1', outputLotId: 'SEAL-B88', quantity: 100, verifiedBy: 'quality-a', at: '2026-10-20' }); expect(getRecallProductionLink(initialRecallPortfolioState, execution, 'RECALL-SEAL-B88')?.status).toBe('incomplete'); execution.allocations.push({ id: 'allocation-1', orderId: 'order-1', lotId: 'lot-1', kilograms: 200, requestedBy: 'supervisor-a', status: 'consumed', revision: 2 }); expect(getRecallProductionLink(initialRecallPortfolioState, execution, 'RECALL-SEAL-B88')).toMatchObject({ status: 'verified', orderId: 'order-1', inputLotId: 'lot-1', genealogyId: 'genealogy-1', sourceRevision: 3 }); execution.genealogy.push({ ...execution.genealogy[0]!, id: 'genealogy-2', orderId: 'order-2' }); expect(getRecallProductionLink(initialRecallPortfolioState, execution, 'RECALL-SEAL-B88')?.status).toBe('conflicting') })

it('attests split shipment lines and reconciles partial returned units without inventing missing links', () => {
  const source = { id: 'line-1', expectedRevision: 0, authority: 'Quality Analyst' as const, recallId: 'RECALL-SEAL-B88', shipmentReference: 'SHIP-77', lineReference: 'LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 20, sourceDocument: 'DESPATCH-MANIFEST-77', recordedBy: 'analyst' }
  expect(getRecallShipmentRecovery(initialRecallPortfolioState, source.recallId)).toEqual([])
  expect(() => recordRecallShipmentSource(initialRecallPortfolioState, { ...source, lotReference: 'UNKNOWN' })).toThrow('affected recall lot')
  const first = recordRecallShipmentSource(initialRecallPortfolioState, source)
  const second = recordRecallShipmentSource(first, { ...source, id: 'line-2', expectedRevision: first.revision, lineReference: 'LINE-2', customerId: 'CUSTOMER-2', affectedUnits: 25 })
  expect(() => recordRecallShipmentSource(second, { ...source, id: 'extra', expectedRevision: second.revision, lineReference: 'LINE-3', affectedUnits: 1 })).toThrow('exceeds the traced')
  const receipt = { id: 'return-1', expectedRevision: second.revision, authority: 'Quality Director' as const, shipmentSourceId: 'line-1', returnedUnits: 8, custodyReference: 'CUSTODY-77-A', receivedBy: 'recovery desk', receivedOn: '2026-10-23' }
  expect(() => recordRecallShipmentReturn(second, { ...receipt, authority: 'Quality Analyst' })).toThrow('quality director')
  const partial = recordRecallShipmentReturn(second, receipt)
  expect(partial.recalls.find((item) => item.recallId === source.recallId)?.recoveredUnits).toBe(8)
  expect(getRecallShipmentRecovery(partial, source.recallId)).toMatchObject([{ status: 'partially recovered', returnedUnits: 8, outstandingUnits: 12 }, { status: 'awaiting recovery', outstandingUnits: 25 }])
  expect(() => recordRecallShipmentReturn(partial, { ...receipt, id: 'over-return', expectedRevision: partial.revision, returnedUnits: 13 })).toThrow('valid remaining units')
  expect(recordRecallShipmentReturn(partial, receipt)).toBe(partial)
  const old = { ...partial } as Record<string, unknown>; delete old['shipmentSources']; delete old['shipmentReturns']
  expect(new BrowserRecallAttemptPersistence({ getItem: () => JSON.stringify(old), setItem: () => undefined }).load()).toMatchObject({ shipmentSources: [], shipmentReturns: [] })
})

const command = { id: 'assign-1', expectedRevision: 0, authority: 'Quality Director' as const, recallId: 'RECALL-SEAL-B88', toOwner: 'Senior recall cell', reviewOn: '2026-10-23', asOf: '2026-10-20', reason: 'Low recovery coverage requires dedicated senior recall ownership.' }
function recallReadyForDetermination() {
  const assigned = reassignCriticalRecall(initialRecallPortfolioState, command)
  const first = recordRecallNotification(assigned, { id: 'notify-1', expectedRevision: 1, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', outcome: 'acknowledged', failureReason: null, actor: 'Recall desk', attemptedOn: '2026-10-22T09:00:00Z', retryOf: null })
  return recordRecallNotification(first, { id: 'notify-2', expectedRevision: 2, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-2', outcome: 'acknowledged', failureReason: null, actor: 'Recall desk', attemptedOn: '2026-10-22T09:05:00Z', retryOf: null })
}
describe('critical recall reassignment', () => {
  it('reassigns only the critical recall and schedules its review', () => { const next = reassignCriticalRecall(initialRecallPortfolioState, command); expect(next.recalls.find((item) => item.recallId === command.recallId)?.owner).toBe('Senior recall cell'); expect(next.assignmentHistory[0]).toMatchObject({ fromOwner: 'Customer recovery team', reviewOn: '2026-10-23', tracedPopulation: 45 }) })
  it('enforces director authority and current revision', () => { expect(() => reassignCriticalRecall(initialRecallPortfolioState, { ...command, authority: 'Quality Analyst' })).toThrow('quality director'); expect(() => reassignCriticalRecall(initialRecallPortfolioState, { ...command, expectedRevision: 3 })).toThrow('changed') })
  it('does not duplicate an already applied assignment command', () => { const next = reassignCriticalRecall(initialRecallPortfolioState, command); expect(reassignCriticalRecall(next, command)).toBe(next) })
})
describe('recall effectiveness closure', () => {
  it('drills from a recalled shipment to customer notice and authoritative genealogy without copying production records', () => { const assigned = reassignCriticalRecall(initialRecallPortfolioState, command); const failed = recordRecallNotification(assigned, { id: 'attempt-ship', expectedRevision: 1, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', shipmentReference: 'SHIP-77', lotReference: 'SEAL-B88', unitReferences: ['UNIT-7'], outcome: 'failed', failureReason: 'Gateway timeout', actor: 'desk', attemptedOn: '2026-10-22T08:55:00Z', retryOf: null }); expect(getRecallOperationalDrillDown(failed, command.recallId, 'CUSTOMER-1')).toMatchObject({ authoritativeGenealogy: 'SEAL-B88', shipments: [{ shipmentReference: 'SHIP-77', customerId: 'CUSTOMER-1', unitReferences: ['UNIT-7'], notificationOutcome: 'failed', acknowledged: false }], physicalRecovery: { recoveredUnits: 0, tracedUnits: 45 }, effectivenessDecision: null }); expect(getRecallOperationalDrillDown(failed, 'UNKNOWN')).toBeNull() })
  const closure = { id: 'close-1', expectedRevision: 3, authority: 'Quality Director' as const, recallId: 'RECALL-SEAL-B88', customerAcknowledgements: 2, repairedUnits: 30, scrappedUnits: 15, releasedUnits: 0, genealogyEvidence: 'GEN-FINAL', determination: 'effective' as const, decidedBy: 'director', decidedOn: '2026-10-24' }
  it('closes only a fully reconciled population with immutable evidence', () => { const active = recallReadyForDetermination(); const closed = determineRecallEffectiveness(active, closure); expect(closed.recalls[0]).toMatchObject({ recoveredUnits: 45, quarantinedUnits: 0, escalated: false }); expect(closed.closures[0]).toMatchObject({ assignmentId: 'assign-1', immutable: true }); expect(getRecallRecoveryTimeline(closed, command.recallId)).toMatchObject({ acknowledgements: [{ customerId: 'CUSTOMER-1' }, { customerId: 'CUSTOMER-2' }], dispositions: [{ repairedUnits: 30, scrappedUnits: 15 }], decisions: [{ id: 'close-1' }] }) })
  it('blocks incomplete, unauthorized, stale, and duplicate determinations', () => { const active = recallReadyForDetermination(); expect(() => determineRecallEffectiveness(active, { ...closure, scrappedUnits: 14 })).toThrow('fully reconcile'); expect(() => determineRecallEffectiveness(active, { ...closure, authority: 'Quality Analyst' })).toThrow('quality director'); expect(() => determineRecallEffectiveness(active, { ...closure, expectedRevision: 0 })).toThrow('changed'); const closed = determineRecallEffectiveness(active, closure); expect(determineRecallEffectiveness(closed, closure)).toBe(closed) })
  it('preserves failed notification evidence and requires a valid retry chain', () => { const assigned = reassignCriticalRecall(initialRecallPortfolioState, command); const failed = recordRecallNotification(assigned, { id: 'notify-fail', expectedRevision: 1, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', outcome: 'failed', failureReason: 'Gateway timeout', actor: 'Recall desk', attemptedOn: '2026-10-22T08:55:00Z', retryOf: null }); const retried = recordRecallNotification(failed, { id: 'notify-retry', expectedRevision: 2, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', outcome: 'acknowledged', failureReason: null, actor: 'Recall desk', attemptedOn: '2026-10-22T09:00:00Z', retryOf: 'notify-fail' }); expect(retried.notificationAttempts).toMatchObject([{ outcome: 'failed', immutable: true }, { outcome: 'acknowledged', retryOf: 'notify-fail', immutable: true }]); expect(recordRecallNotification(retried, { id: 'notify-retry', expectedRevision: 2, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', outcome: 'acknowledged', failureReason: null, actor: 'Recall desk', attemptedOn: '2026-10-22T09:00:00Z', retryOf: 'notify-fail' })).toBe(retried) })
  it('exposes exact unit variance and structured command failures', () => { expect(reconcileRecallDisposition(45, 30, 14, 0)).toEqual({ tracedUnits: 45, dispositionTotal: 44, balanced: false, variance: 1 }); const active = recallReadyForDetermination(); try { determineRecallEffectiveness(active, { ...closure, scrappedUnits: 14 }) } catch (error) { expect(error).toBeInstanceOf(RecallControlError); expect((error as RecallControlError).code).toBe('DISPOSITION_MISMATCH') } })
  it('filters operator recovery timelines and retains retry lineage', () => { const assigned = reassignCriticalRecall(initialRecallPortfolioState, command); const failed = recordRecallNotification(assigned, { id: 'notify-fail', expectedRevision: 1, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', shipmentReference: 'SHIP-77', lotReference: 'SEAL-B88', unitReferences: ['UNIT-7'], outcome: 'failed', failureReason: 'Gateway timeout', actor: 'Recall desk', attemptedOn: '2026-10-22T08:55:00Z', retryOf: null }); expect(browseRecallRecovery(failed, { shipmentReference: 'SHIP-77', lotReference: 'SEAL-B88', unitReference: 'UNIT-7', retryState: 'unrecovered-failure' })).toHaveLength(1); const recovered = recordRecallNotification(failed, { id: 'notify-retry', expectedRevision: 2, authority: 'Quality Director', recallId: command.recallId, customerId: 'CUSTOMER-1', shipmentReference: 'SHIP-77', lotReference: 'SEAL-B88', unitReferences: ['UNIT-7'], outcome: 'acknowledged', failureReason: null, actor: 'Recall desk', attemptedOn: '2026-10-22T09:00:00Z', retryOf: 'notify-fail' }); const result = browseRecallRecovery(recovered, { outcome: 'failed', customerId: 'CUSTOMER-1', retryState: 'recovered-failure' }); expect(result[0]).toMatchObject({ recall: { recallId: command.recallId }, outstandingAcknowledgements: 1 }); expect(result[0]?.retryLineage[0]).toMatchObject({ attemptId: 'notify-fail', recoveredBy: 'notify-retry' }); expect(browseRecallRecovery(recovered, { acknowledgement: 'acknowledged' })).toHaveLength(1) })
})

it('reconciles cumulative return custody per shipment without using another line allowance', () => {
  const state = recordRecallShipmentSource(initialRecallPortfolioState, { id: 'line-cumulative', expectedRevision: 0, authority: 'Quality Analyst', recallId: 'RECALL-SEAL-B88', shipmentReference: 'SHIP-77', lineReference: 'LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 20, sourceDocument: 'MANIFEST-77', recordedBy: 'analyst' })
  state.shipmentReturns.push(...[12, 9].map((returnedUnits, index) => ({ id: `return-${String(index)}`, shipmentSourceId: 'line-cumulative', returnedUnits, custodyReference: `CUSTODY-${String(index)}`, receivedBy: 'director', receivedOn: '2026-10-27', immutable: true as const })))
  const before = structuredClone(state)
  expect(inspectRecallIntegrity(state, initialFactoryExecution, 'RECALL-SEAL-B88').find((item) => item.code === 'RETURN_SOURCE' && item.recordId === 'line-cumulative')?.detail).toContain('21 returned units against 20')
  expect(state).toEqual(before)
  state.shipmentReturns[1]!.returnedUnits = 8
  expect(inspectRecallIntegrity(state, initialFactoryExecution, 'RECALL-SEAL-B88').filter((item) => item.code === 'RETURN_SOURCE')).toEqual([])
  state.shipmentReturns[1]!.returnedUnits = -1
  expect(inspectRecallIntegrity(state, initialFactoryExecution, 'RECALL-SEAL-B88').some((item) => item.code === 'RETURN_SOURCE')).toBe(true)
})

function returnedRecallCustody(units = 10) {
  const source = recordRecallShipmentSource(initialRecallPortfolioState, { id: 'processing-line', expectedRevision: 0, authority: 'Quality Analyst', recallId: 'RECALL-SEAL-B88', shipmentReference: 'SHIP-77', lineReference: 'LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 45, sourceDocument: 'MANIFEST-77', recordedBy: 'analyst' })
  return recordRecallShipmentReturn(source, { id: 'physical-return', expectedRevision: source.revision, authority: 'Quality Director', shipmentSourceId: 'processing-line', returnedUnits: units, custodyReference: 'CUSTODY-77', receivedBy: 'Recovery desk', receivedOn: '2026-10-23' })
}

it('partitions physical return custody into inspected repair scrap release and remaining held units', () => {
  const state = returnedRecallCustody()
  const processing = { id: 'process-1', expectedRevision: state.revision, authority: 'Quality Director' as const, returnId: 'physical-return', repairedUnits: 5, scrappedUnits: 2, releasedUnits: 0, inspectionEvidence: 'INSPECTION-77', decidedBy: 'Quality director', decidedOn: '2026-10-25' }
  const before = structuredClone(state)
  expect(() => processReturnedRecallUnits(state, { ...processing, authority: 'Quality Analyst' })).toThrow('quality director')
  expect(() => processReturnedRecallUnits(state, { ...processing, expectedRevision: 0 })).toThrow('Refresh')
  expect(() => processReturnedRecallUnits(state, { ...processing, decidedBy: 'Recovery desk' })).toThrow('Independent')
  expect(() => processReturnedRecallUnits(state, { ...processing, repairedUnits: 9 })).toThrow('held return quantity')
  expect(() => processReturnedRecallUnits(state, { ...processing, decidedOn: '2026-10-22' })).toThrow('date after')
  expect(() => processReturnedRecallUnits(state, { ...processing, decidedOn: '2026-11-31' })).toThrow('date after')
  expect(state).toEqual(before)
  const partial = processReturnedRecallUnits(state, processing)
  expect(getRecallReturnProcessing(partial, 'RECALL-SEAL-B88')[0]).toMatchObject({ repairedUnits: 5, scrappedUnits: 2, releasedUnits: 0, heldUnits: 3 })
  const complete = processReturnedRecallUnits(partial, { ...processing, id: 'process-2', expectedRevision: partial.revision, repairedUnits: 0, scrappedUnits: 0, releasedUnits: 3 })
  expect(getRecallReturnProcessing(complete, 'RECALL-SEAL-B88')[0]).toMatchObject({ repairedUnits: 5, scrappedUnits: 2, releasedUnits: 3, heldUnits: 0 })
  expect(complete.shipmentReturns).toEqual(state.shipmentReturns)
  expect(complete.returnProcessing[0]).toEqual(partial.returnProcessing[0])
  expect(processReturnedRecallUnits(complete, { ...processing, id: 'process-2' })).toBe(complete)
  expect(() => processReturnedRecallUnits(complete, { ...processing, id: 'over-process', expectedRevision: complete.revision, repairedUnits: 1, scrappedUnits: 0 })).toThrow('held return quantity')
})

it('requires inspected returned-unit disposition before closure and preserves its category totals', () => {
  let state = returnedRecallCustody()
  state = reassignCriticalRecall(state, { id: 'processing-assignment', expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', toOwner: 'Senior recall cell', reviewOn: '2026-10-22', asOf: '2026-10-20', reason: 'Critical recovery requires independent reviewed disposition.' })
  for (const [index, customerId] of ['CUSTOMER-1', 'CUSTOMER-2'].entries()) state = recordRecallNotification(state, { id: `processing-notice-${String(index)}`, expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', customerId, actor: 'quality', attemptedOn: '2026-10-24', outcome: 'acknowledged', failureReason: null, retryOf: null })
  const closure = { id: 'processing-close', expectedRevision: state.revision, authority: 'Quality Director' as const, recallId: 'RECALL-SEAL-B88', customerAcknowledgements: 2, repairedUnits: 30, scrappedUnits: 15, releasedUnits: 0, genealogyEvidence: 'GENEALOGY-77', determination: 'effective' as const, decidedBy: 'director', decidedOn: '2026-10-26' }
  expect(() => determineRecallEffectiveness(state, closure)).toThrow('still held')
  const processed = processReturnedRecallUnits(state, { id: 'inspected-return', expectedRevision: state.revision, authority: 'Quality Director', returnId: 'physical-return', repairedUnits: 7, scrappedUnits: 3, releasedUnits: 0, inspectionEvidence: 'INSPECT-77', decidedBy: 'Quality director', decidedOn: '2026-10-25' })
  expect(() => determineRecallEffectiveness(processed, { ...closure, expectedRevision: processed.revision, repairedUnits: 43, scrappedUnits: 2 })).toThrow('contradicts')
  expect(() => determineRecallEffectiveness(processed, { ...closure, expectedRevision: processed.revision })).toThrow('Unresolved customer shipment')
  const proposed = proposeCustomerRecallDisposition(processed, { id: 'processing-customer-disposition', expectedRevision: processed.revision, authority: 'Quality Analyst', shipmentSourceId: 'processing-line', repairedUnits: 23, scrappedUnits: 12, releasedUnits: 0, customerEvidence: 'CUSTOMER-INSPECTION-77', submittedBy: 'analyst', submittedOn: '2026-10-25' })
  const accepted = reviewCustomerRecallDisposition(proposed, { id: 'processing-customer-review', expectedRevision: proposed.revision, authority: 'Quality Director', customerDispositionId: 'processing-customer-disposition', decision: 'accepted', reviewEvidence: 'SIGNED-CUSTOMER-REVIEW-77', reviewer: 'director', reviewedOn: '2026-10-26' })
  const beforeClosure = structuredClone(accepted)
  expect(() => determineRecallEffectiveness(accepted, { ...closure, expectedRevision: accepted.revision, decidedOn: '2026-10-25' })).toThrow('on or after accepted recovery evidence')
  expect(accepted).toEqual(beforeClosure)
  const closed = determineRecallEffectiveness(accepted, { ...closure, expectedRevision: accepted.revision })
  expect(closed.returnProcessing).toEqual(processed.returnProcessing)
  expect(closed.recalls[0]?.recoveredUnits).toBe(45)
  expect(() => recordRecallShipmentReturn(closed, { id: 'late-return', expectedRevision: closed.revision, authority: 'Quality Director', shipmentSourceId: 'processing-line', returnedUnits: 1, custodyReference: 'LATE-77', receivedBy: 'Recovery desk', receivedOn: '2026-10-27' })).toThrow('Closed recall')
})

it('loads legacy returns as held custody without inventing inspected disposition', () => {
  const state = returnedRecallCustody()
  const legacy = { ...state, returnProcessing: undefined }
  const loaded = new BrowserRecallAttemptPersistence({ getItem: () => JSON.stringify(legacy), setItem: () => undefined }).load()
  expect(loaded?.returnProcessing).toEqual([])
  expect(getRecallReturnProcessing(loaded!, 'RECALL-SEAL-B88')[0]?.heldUnits).toBe(10)
})

function acknowledgedCustomerShipment() {
  let state = recordRecallShipmentSource(initialRecallPortfolioState, { id: 'customer-site-line', expectedRevision: 0, authority: 'Quality Analyst', recallId: 'RECALL-SEAL-B88', shipmentReference: 'SITE-SHIP-77', lineReference: 'SITE-LINE-1', customerId: 'CUSTOMER-1', lotReference: 'SEAL-B88', affectedUnits: 20, sourceDocument: 'SITE-MANIFEST-77', recordedBy: 'analyst' })
  state = recordRecallNotification(state, { id: 'site-ack-notice', expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', customerId: 'CUSTOMER-1', outcome: 'acknowledged', failureReason: null, actor: 'Customer recovery desk', attemptedOn: '2026-10-22', retryOf: null })
  return state
}
const siteProposal = { id: 'site-disposition-1', expectedRevision: 0, authority: 'Quality Analyst' as const, shipmentSourceId: 'customer-site-line', repairedUnits: 6, scrappedUnits: 2, releasedUnits: 2, customerEvidence: 'CUSTOMER-SIGNED-INSPECTION-01', submittedBy: 'analyst', submittedOn: '2026-10-24' }
const siteReview = { id: 'site-review-1', expectedRevision: 0, authority: 'Quality Director' as const, customerDispositionId: 'site-disposition-1', decision: 'accepted' as const, reviewEvidence: 'DIRECTOR-INSPECTION-REVIEW-01', reviewer: 'independent director', reviewedOn: '2026-10-25' }

it('conserves shipment units across physical returns and independently reviewed customer-site disposition', () => {
  const state = acknowledgedCustomerShipment()
  const returned = recordRecallShipmentReturn(state, { id: 'site-return', expectedRevision: state.revision, authority: 'Quality Director', shipmentSourceId: 'customer-site-line', returnedUnits: 10, custodyReference: 'SITE-CUSTODY-77', receivedBy: 'Recovery desk', receivedOn: '2026-10-23' })
  const proposed = proposeCustomerRecallDisposition(returned, { ...siteProposal, expectedRevision: returned.revision })
  expect(getRecallShipmentRecovery(proposed, 'RECALL-SEAL-B88')[0]).toMatchObject({ returnedUnits: 10, controlledAtCustomer: 0, outstandingUnits: 10 })
  const accepted = reviewCustomerRecallDisposition(proposed, { ...siteReview, expectedRevision: proposed.revision })
  expect(getRecallShipmentRecovery(accepted, 'RECALL-SEAL-B88')[0]).toMatchObject({ returnedUnits: 10, controlledAtCustomer: 10, outstandingUnits: 0, customerRepairedUnits: 6, customerScrappedUnits: 2, customerReleasedUnits: 2 })
  expect(accepted.shipmentReturns).toEqual(returned.shipmentReturns)
  expect(accepted.recalls[0]?.recoveredUnits).toBe(10)
  expect(accepted.customerDispositions[0]).toMatchObject({ acknowledgementId: 'site-ack-notice:ack', sourceRevision: 0, immutable: true })
  expect(() => recordRecallShipmentReturn(accepted, { id: 'double-return', expectedRevision: accepted.revision, authority: 'Quality Director', shipmentSourceId: 'customer-site-line', returnedUnits: 1, custodyReference: 'DUPLICATE-CUSTODY', receivedBy: 'desk', receivedOn: '2026-10-26' })).toThrow('remaining units')
  expect(() => proposeCustomerRecallDisposition(accepted, { ...siteProposal, id: 'over-site', expectedRevision: accepted.revision, repairedUnits: 1, scrappedUnits: 0, releasedUnits: 0 })).toThrow('whole unresolved units')
})

it('rejects unauthorized, stale, invalid or foreign customer-site decisions without partial mutation', () => {
  const state = acknowledgedCustomerShipment()
  const before = structuredClone(state)
  const command = { ...siteProposal, expectedRevision: state.revision }
  expect(() => proposeCustomerRecallDisposition(state, { ...command, authority: 'Quality Director' })).toThrow('quality analyst')
  expect(() => proposeCustomerRecallDisposition(state, { ...command, expectedRevision: 0 })).toThrow('Refresh')
  expect(() => proposeCustomerRecallDisposition(state, { ...command, repairedUnits: 0.5 })).toThrow('whole unresolved units')
  expect(() => proposeCustomerRecallDisposition(state, { ...command, submittedOn: '2026-11-31' })).toThrow('Dated customer')
  expect(() => proposeCustomerRecallDisposition(state, { ...command, shipmentSourceId: 'missing-line' })).toThrow('verified shipment')
  expect(() => proposeCustomerRecallDisposition({ ...state, acknowledgements: [] }, command)).toThrow('customer acknowledgement')
  expect(state).toEqual(before)
  const proposed = proposeCustomerRecallDisposition(state, command)
  expect(() => reviewCustomerRecallDisposition(proposed, { ...siteReview, expectedRevision: proposed.revision, reviewer: 'analyst' })).toThrow('Independent')
  expect(() => reviewCustomerRecallDisposition(proposed, { ...siteReview, expectedRevision: 0 })).toThrow('Refresh')
  const changed = structuredClone(proposed); changed.shipmentSources[0]!.sourceRevision += 1
  expect(() => reviewCustomerRecallDisposition(changed, { ...siteReview, expectedRevision: changed.revision })).toThrow('exact shipment')
  expect(proposed.customerDispositionReviews).toEqual([])
})

it('returns a proposal overtaken by physical returns and accepts corrected evidence without deleting history', () => {
  const state = acknowledgedCustomerShipment()
  const proposed = proposeCustomerRecallDisposition(state, { ...siteProposal, expectedRevision: state.revision, repairedUnits: 18, scrappedUnits: 0, releasedUnits: 0 })
  const returned = recordRecallShipmentReturn(proposed, { id: 'later-custody', expectedRevision: proposed.revision, authority: 'Quality Director', shipmentSourceId: 'customer-site-line', returnedUnits: 10, custodyReference: 'LATER-CUSTODY-77', receivedBy: 'desk', receivedOn: '2026-10-25' })
  const before = structuredClone(returned)
  expect(() => reviewCustomerRecallDisposition(returned, { ...siteReview, expectedRevision: returned.revision })).toThrow('return this proposal')
  expect(returned).toEqual(before)
  const sentBack = reviewCustomerRecallDisposition(returned, { ...siteReview, expectedRevision: returned.revision, decision: 'returned' })
  const corrected = proposeCustomerRecallDisposition(sentBack, { ...siteProposal, id: 'site-disposition-2', expectedRevision: sentBack.revision, customerEvidence: 'CORRECTED-CUSTOMER-INSPECTION-02', submittedOn: '2026-10-26' })
  const accepted = reviewCustomerRecallDisposition(corrected, { ...siteReview, id: 'site-review-2', expectedRevision: corrected.revision, customerDispositionId: 'site-disposition-2', reviewedOn: '2026-10-27' })
  expect(accepted.customerDispositions[0]).toEqual(proposed.customerDispositions[0])
  expect(accepted.customerDispositionReviews.map((item) => item.decision)).toEqual(['returned', 'accepted'])
  expect(getRecallShipmentRecovery(accepted, 'RECALL-SEAL-B88')[0]?.outstandingUnits).toBe(0)
  const legacy = { ...accepted, customerDispositions: undefined, customerDispositionReviews: undefined }
  const loaded = new BrowserRecallAttemptPersistence({ getItem: () => JSON.stringify(legacy), setItem: () => undefined }).load()
  expect(loaded?.customerDispositions).toEqual([])
  expect(loaded?.customerDispositionReviews).toEqual([])
  expect(loaded?.shipmentReturns).toEqual(accepted.shipmentReturns)
})


it('preserves shipment-scoped customer disposition evidence through stale refresh and independent review', async () => {
  localStorage.clear()
  const firstSource = acknowledgedCustomerShipment()
  const state = recordRecallShipmentSource(firstSource, { id: 'second-customer-line', expectedRevision: firstSource.revision, authority: 'Quality Analyst', recallId: 'RECALL-SEAL-B88', shipmentReference: 'SITE-SHIP-88', lineReference: 'SITE-LINE-2', customerId: 'CUSTOMER-2', lotReference: 'SEAL-B88', affectedUnits: 25, sourceDocument: 'SECOND-CUSTOMER-MANIFEST-88', recordedBy: 'analyst' })
  localStorage.setItem(BrowserRecallAttemptPersistence.key, JSON.stringify(state))
  const user = userEvent.setup()
  render(createElement(RecallWorkloadControl))
  await user.selectOptions(screen.getByLabelText('Shipment line for recovery'), 'customer-site-line')
  await user.click(screen.getByLabelText('Customer inspection evidence'))
  await user.paste('CUSTOMER-UI-INSPECTION-77')
  await user.selectOptions(screen.getByLabelText('Shipment line for recovery'), 'second-customer-line')
  expect(screen.getByLabelText('Customer inspection evidence')).toHaveValue('')
  await user.click(screen.getByLabelText('Customer inspection evidence'))
  await user.paste('SECOND-CUSTOMER-DRAFT-88')
  await user.selectOptions(screen.getByLabelText('Shipment line for recovery'), 'customer-site-line')
  expect(screen.getByLabelText('Customer inspection evidence')).toHaveValue('CUSTOMER-UI-INSPECTION-77')
  const external = recordRecallShipmentReturn(state, { id: 'external-return', expectedRevision: state.revision, authority: 'Quality Director', shipmentSourceId: 'customer-site-line', returnedUnits: 11, custodyReference: 'EXTERNAL-CUSTODY-77', receivedBy: 'desk', receivedOn: '2026-10-23' })
  localStorage.setItem(BrowserRecallAttemptPersistence.key, JSON.stringify(external))
  await user.click(screen.getByRole('button', { name: 'Submit customer-site disposition' }))
  expect(screen.getByRole('status')).toHaveTextContent('Shipment recovery changed')
  expect(screen.getByRole('status')).toHaveFocus()
  expect(screen.getByLabelText('Customer inspection evidence')).toHaveValue('CUSTOMER-UI-INSPECTION-77')
  await user.click(screen.getByRole('button', { name: 'Refresh customer recovery' }))
  expect(screen.getByLabelText('Customer-site unit reconciliation')).toHaveTextContent('unresolved 9')
  expect(screen.getByLabelText('Customer inspection evidence')).toHaveValue('CUSTOMER-UI-INSPECTION-77')
  await user.clear(screen.getByLabelText('Customer repaired units'))
  await user.type(screen.getByLabelText('Customer repaired units'), '9')
  await user.click(screen.getByRole('button', { name: 'Submit customer-site disposition' }))
  expect(screen.getByLabelText('Customer-site unit reconciliation')).toHaveTextContent('controlled at customer 0 + unresolved 9')
  expect(screen.getByRole('button', { name: 'Accept customer-site disposition' })).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('Recall portfolio authority'), 'Quality Director')
  await user.click(screen.getByLabelText('Customer disposition review evidence'))
  await user.paste('INDEPENDENT-UI-REVIEW-77')
  await user.selectOptions(screen.getByLabelText('Shipment line for recovery'), 'second-customer-line')
  expect(screen.queryByLabelText('Customer disposition review evidence')).not.toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Shipment line for recovery'), 'customer-site-line')
  expect(screen.getByLabelText('Customer disposition review evidence')).toHaveValue('INDEPENDENT-UI-REVIEW-77')
  await user.click(screen.getByRole('button', { name: 'Accept customer-site disposition' }))
  expect(screen.getByLabelText('Customer-site unit reconciliation')).toHaveTextContent('returned 11 + controlled at customer 9 + unresolved 0')
  expect(new BrowserRecallAttemptPersistence(localStorage).load()?.recalls[0]?.recoveredUnits).toBe(11)
  expect(screen.getByLabelText('Final recall decision date')).toHaveValue('2026-10-25')
  await user.selectOptions(screen.getByLabelText('Shipment line for recovery'), 'second-customer-line')
  expect(screen.getByLabelText('Customer inspection evidence')).toHaveValue('SECOND-CUSTOMER-DRAFT-88')
  expect(screen.getByLabelText('Customer-site unit reconciliation')).toHaveTextContent('controlled at customer 0 + unresolved 25')
  cleanup()
  localStorage.clear()
})


it('prepares noncritical recalls for governed review without altering another product recall', () => {
  const command = { id: 'valve-review', expectedRevision: 0, authority: 'Quality Director' as const, recallId: 'RECALL-VALVE-C14', reviewPreparation: true as const, toOwner: 'Valve quality cell', reviewOn: '2026-10-23', asOf: '2026-10-20', reason: 'Review actual repair, scrap and release evidence for the valve recall.', preparedBy: 'independent director' }
  const before = structuredClone(initialRecallPortfolioState)
  expect(() => prepareRecallEffectivenessReview(before, { ...command, authority: 'Quality Analyst' })).toThrow('quality director')
  expect(() => prepareRecallEffectivenessReview(before, { ...command, reviewOn: '2026-11-31' })).toThrow('valid future')
  expect(() => prepareRecallEffectivenessReview(before, { ...command, asOf: '2026-02-30' })).toThrow('valid future')
  expect(() => prepareRecallEffectivenessReview(before, { ...command, reason: '' })).toThrow('specific reason')
  expect(before).toEqual(initialRecallPortfolioState)
  const prepared = prepareRecallEffectivenessReview(before, command)
  expect(prepared.assignmentHistory[0]).toMatchObject({ recallId: 'RECALL-VALVE-C14', tracedPopulation: 80, preparedBy: 'independent director', immutable: true })
  expect(prepared.recalls[0]).toEqual(before.recalls[0])
  expect(() => prepareRecallEffectivenessReview(prepared, { ...command, id: 'duplicate-preparation', expectedRevision: prepared.revision })).toThrow('existing governed review')
})

it('requires whole final categories and prevents a second immutable decision for the same recall', () => {
  let state = prepareRecallEffectivenessReview(initialRecallPortfolioState, { id: 'shaft-review', expectedRevision: 0, authority: 'Quality Director', recallId: 'RECALL-SHAFT-A03', reviewPreparation: true, toOwner: 'Machining quality', reviewOn: '2026-10-23', asOf: '2026-10-20', reason: 'Verify actual shaft recall disposition and customer receipt.', preparedBy: 'director' })
  state = recordRecallNotification(state, { id: 'shaft-ack', expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SHAFT-A03', customerId: 'SHAFT-CUSTOMER-1', outcome: 'acknowledged', failureReason: null, actor: 'desk', attemptedOn: '2026-10-22', retryOf: null })
  const decision = { id: 'shaft-final', expectedRevision: state.revision, authority: 'Quality Director' as const, recallId: 'RECALL-SHAFT-A03', customerAcknowledgements: 1, repairedUnits: 20, scrappedUnits: 5, releasedUnits: 5, genealogyEvidence: 'SHAFT-FINAL-INSPECTION', determination: 'effective' as const, decidedBy: 'director', decidedOn: '2026-10-24' }
  expect(getRecallEffectivenessCoverage(state, decision.recallId)).toMatchObject({ acknowledgedCustomers: 1, unclassifiedUnits: 30 })
  const before = structuredClone(state)
  expect(() => determineRecallEffectiveness(state, { ...decision, repairedUnits: 20.5, scrappedUnits: 4.5 })).toThrow('whole unit')
  expect(() => determineRecallEffectiveness(state, { ...decision, releasedUnits: 4 })).toThrow('fully reconcile')
  expect(() => recordRecallNotification(state, { id: 'extra-shaft-ack', expectedRevision: state.revision, authority: 'Quality Director', recallId: decision.recallId, customerId: 'EXTRA-CUSTOMER', outcome: 'acknowledged', failureReason: null, actor: 'desk', attemptedOn: '2026-10-22', retryOf: null })).toThrow('already acknowledged')
  expect(state).toEqual(before)
  const closed = determineRecallEffectiveness(state, decision)
  expect(closed.closures[0]).toMatchObject({ recallId: decision.recallId, repairedUnits: 20, scrappedUnits: 5, releasedUnits: 5 })
  expect(closed.recalls[0]).toEqual(state.recalls[0])
  expect(() => determineRecallEffectiveness(closed, { ...decision, id: 'second-final', expectedRevision: closed.revision })).toThrow('immutable effectiveness')
})

it('preserves selected recall final-review drafts through switching and a stale review recovery', async () => {
  cleanup(); localStorage.clear()
  const user = userEvent.setup()
  render(createElement(RecallWorkloadControl))
  await user.click(screen.getByRole('button', { name: 'RECALL-SHAFT-A03' }))
  await user.selectOptions(screen.getByLabelText('Recall portfolio authority'), 'Quality Director')
  await user.click(screen.getByLabelText('Effectiveness review reason')); await user.paste('Review the shaft customer acknowledgement and inspected actual disposition.')
  await user.click(screen.getByRole('button', { name: 'Prepare selected recall review' }))
  expect(screen.getByRole('status')).toHaveTextContent('review prepared')
  await user.click(screen.getByLabelText('Effectiveness customer ID')); await user.paste('SHAFT-CUSTOMER-1')
  await user.click(screen.getByRole('button', { name: 'Record selected customer acknowledgement' }))
  for (const [label, value] of [['Final repaired units', '20'], ['Final scrapped units', '5'], ['Final released units', '4']] as const) { await user.clear(screen.getByLabelText(label)); await user.click(screen.getByLabelText(label)); await user.paste(value); }
  await user.click(screen.getByLabelText('Final genealogy evidence')); await user.paste('SHAFT-FINAL-INSPECTION')
  await user.click(screen.getByRole('button', { name: 'Confirm final recall effectiveness' }))
  expect(screen.getByRole('status')).toHaveTextContent('fully reconcile'); expect(screen.getByRole('status')).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'RECALL-SEAL-B88' }))
  expect(screen.getByLabelText('Final genealogy evidence')).toHaveValue('GEN-SEAL-B88-FINAL')
  await user.click(screen.getByRole('button', { name: 'RECALL-SHAFT-A03' }))
  expect(screen.getByLabelText('Final genealogy evidence')).toHaveValue('SHAFT-FINAL-INSPECTION')
  await user.clear(screen.getByLabelText('Final released units')); await user.type(screen.getByLabelText('Final released units'), '5')
  const sibling = new BrowserRecallAttemptPersistence(localStorage), current = sibling.load()!
  sibling.save(prepareRecallEffectivenessReview(current, { id: 'sibling-valve-review', expectedRevision: current.revision, authority: 'Quality Director', recallId: 'RECALL-VALVE-C14', reviewPreparation: true, toOwner: 'Valve quality cell', reviewOn: '2026-10-23', asOf: '2026-10-20', reason: 'Prepare the unrelated valve recall for independent final review.', preparedBy: 'director' }))
  await user.click(screen.getByRole('button', { name: 'Confirm final recall effectiveness' }))
  expect(screen.getByRole('status')).toHaveTextContent('changed. Refresh')
  await user.click(screen.getByRole('button', { name: 'Refresh effectiveness review' }))
  expect(screen.getByLabelText('Final released units')).toHaveValue('5')
  await user.click(screen.getByRole('button', { name: 'Confirm final recall effectiveness' }))
  expect(sibling.load()?.closures).toMatchObject([{ recallId: 'RECALL-SHAFT-A03', repairedUnits: 20, scrappedUnits: 5, releasedUnits: 5 }])
  cleanup(); localStorage.clear()
})


it('reconciles reviewed non-shipped scrap with customer-site categories before final effectiveness', async () => {
  const { proposeRecallResidualDisposition, reviewRecallResidualDisposition } = await import('./recall-control-domain')
  let state = acknowledgedCustomerShipment()
  state = proposeCustomerRecallDisposition(state, { ...siteProposal, expectedRevision: state.revision, repairedUnits: 20, scrappedUnits: 0, releasedUnits: 0 })
  state = reviewCustomerRecallDisposition(state, { ...siteReview, expectedRevision: state.revision })
  state = openRecallLineageInvestigation(state, { id: 'residual-final-investigation', expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', conflictingShipmentReference: null, owner: 'analyst', evidenceRequired: 'Actual non-shipped scrap log', openedOn: '2026-10-25' })
  state = proposeRecallResidualDisposition(state, { id: 'residual-final-scrap', expectedRevision: state.revision, authority: 'Quality Analyst', investigationId: 'residual-final-investigation', kind: 'scrap', units: 25, evidenceReference: 'ACTUAL-SCRAP-25', investigator: 'analyst', proposedOn: '2026-10-25' })
  state = reviewRecallResidualDisposition(state, { id: 'residual-final-review', expectedRevision: state.revision, authority: 'Quality Director', dispositionId: 'residual-final-scrap', decision: 'accepted', reviewer: 'director', reviewEvidence: 'Scrap quantity and actual lot verified.', reviewedOn: '2026-10-26' })
  state = prepareRecallEffectivenessReview(state, { id: 'residual-final-preparation', expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', reviewPreparation: true, toOwner: 'recall team', reviewOn: '2026-10-26', asOf: '2026-10-20', reason: 'Reconcile customer repair and independently verified non-shipped scrap.', preparedBy: 'director' })
  state = recordRecallNotification(state, { id: 'residual-final-customer-2', expectedRevision: state.revision, authority: 'Quality Director', recallId: 'RECALL-SEAL-B88', customerId: 'CUSTOMER-2', outcome: 'acknowledged', failureReason: null, actor: 'desk', attemptedOn: '2026-10-22', retryOf: null })
  expect(getRecallEffectivenessCoverage(state, 'RECALL-SEAL-B88')).toMatchObject({ repairedUnits: 20, scrappedUnits: 25, releasedUnits: 0, unclassifiedUnits: 0 })
  const decision = { id: 'residual-final-close', expectedRevision: state.revision, authority: 'Quality Director' as const, recallId: 'RECALL-SEAL-B88', customerAcknowledgements: 2, repairedUnits: 30, scrappedUnits: 15, releasedUnits: 0, genealogyEvidence: 'ACTUAL-FINAL-COVERAGE', determination: 'effective' as const, decidedBy: 'director', decidedOn: '2026-10-26' }
  const before = structuredClone(state)
  expect(() => determineRecallEffectiveness(state, decision)).toThrow('non-shipped disposition evidence')
  expect(state).toEqual(before)
  const closed = determineRecallEffectiveness(state, { ...decision, repairedUnits: 20, scrappedUnits: 25 })
  expect(closed.closures[0]).toMatchObject({ repairedUnits: 20, scrappedUnits: 25 })
  expect(closed.residualDispositions).toEqual(before.residualDispositions)
  expect(closed.customerDispositions).toEqual(before.customerDispositions)
})

it('binds complete customer populations to source identities while preserving explicit unknown legacy attribution', () => {
  const initial = structuredClone(initialRecallPortfolioState)
  initial.recalls.find((item) => item.recallId === 'RECALL-SHAFT-A03')!.recoveredUnits = 0
  const source = recordRecallShipmentSource(initial, { id: 'shaft-authoritative-line', expectedRevision: 0, authority: 'Quality Analyst', recallId: 'RECALL-SHAFT-A03', shipmentReference: 'SHAFT-DISPATCH-33', lineReference: 'SHAFT-LINE-1', customerId: 'SHAFT-REAL-CUSTOMER', lotReference: 'SHAFT-A03', affectedUnits: 30, sourceDocument: 'SHAFT-SIGNED-DISPATCH', recordedBy: 'dispatch' })
  const notification = { id: 'shaft-source-ack', expectedRevision: source.revision, authority: 'Quality Director' as const, recallId: 'RECALL-SHAFT-A03', customerId: 'UNRELATED-CUSTOMER', outcome: 'acknowledged' as const, failureReason: null, actor: 'desk', attemptedOn: '2026-10-22', retryOf: null }
  expect(getRecallCustomerIdentityCoverage(source, notification.recallId)).toMatchObject({ complete: true, unresolvedIdentities: 0, customerIds: ['SHAFT-REAL-CUSTOMER'] })
  const before = structuredClone(source)
  expect(() => recordRecallNotification(source, notification)).toThrow('authoritative affected shipment population')
  expect(source).toEqual(before)
  let accepted = recordRecallNotification(source, { ...notification, customerId: 'SHAFT-REAL-CUSTOMER' })
  expect(accepted.acknowledgements.at(-1)).toMatchObject({ identityBasis: 'reviewed shipment', customerSources: [{ id: 'shaft-authoritative-line', sourceRevision: 0 }] })
  accepted = recordRecallShipmentReturn(accepted, { id: 'shaft-full-return', expectedRevision: accepted.revision, authority: 'Quality Director', shipmentSourceId: 'shaft-authoritative-line', returnedUnits: 30, custodyReference: 'SHAFT-RETURN-CUSTODY', receivedBy: 'returns', receivedOn: '2026-10-23' })
  accepted = processReturnedRecallUnits(accepted, { id: 'shaft-return-inspection', expectedRevision: accepted.revision, authority: 'Quality Director', returnId: 'shaft-full-return', repairedUnits: 30, scrappedUnits: 0, releasedUnits: 0, inspectionEvidence: 'SHAFT-INSPECTED-30', decidedBy: 'independent inspector', decidedOn: '2026-10-24' })
  accepted = prepareRecallEffectivenessReview(accepted, { id: 'shaft-known-review', expectedRevision: accepted.revision, authority: 'Quality Director', recallId: notification.recallId, reviewPreparation: true, toOwner: 'Shaft recall team', reviewOn: '2026-10-24', asOf: '2026-10-20', reason: 'Review the complete authoritative customer and inspected shaft population.', preparedBy: 'director' })
  const forgedLegacy = structuredClone(accepted); forgedLegacy.acknowledgements[0]!.customerId = 'UNRELATED-CUSTOMER'
  const closure = { id: 'shaft-known-final', expectedRevision: accepted.revision, authority: 'Quality Director' as const, recallId: notification.recallId, customerAcknowledgements: 1, repairedUnits: 30, scrappedUnits: 0, releasedUnits: 0, genealogyEvidence: 'SHAFT-FINAL-PROOF', determination: 'effective' as const, decidedBy: 'director', decidedOn: '2026-10-24' }
  expect(() => determineRecallEffectiveness(forgedLegacy, closure)).toThrow('Acknowledgement identities')
  expect(determineRecallEffectiveness(accepted, closure).closures.at(-1)?.recallId).toBe(notification.recallId)
  const legacy = recordRecallNotification(initialRecallPortfolioState, { ...notification, id: 'legacy-shaft-ack', expectedRevision: 0, customerId: 'OPERATOR-IDENTIFIED-LEGACY-CUSTOMER' })
  expect(legacy.acknowledgements.at(-1)).toMatchObject({ identityBasis: 'operator attributed', customerSources: [] })
  expect(getRecallCustomerIdentityCoverage(legacy, notification.recallId)?.unresolvedIdentities).toBe(1)
})

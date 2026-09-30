import { rankRecallWorkload, seededRecallWorkload, type RecallWorkload } from './recall-portfolio'
import type { FactoryExecutionState } from '../factory/execution-control'

export type RecallAuthority = 'Quality Analyst' | 'Quality Director'
export class RecallControlError extends Error {
  readonly code: 'UNAUTHORIZED' | 'STALE_REVISION' | 'DISPOSITION_MISMATCH'
  constructor(code: 'UNAUTHORIZED' | 'STALE_REVISION' | 'DISPOSITION_MISMATCH', message: string) { super(message); this.code = code; this.name = 'RecallControlError' }
}
export function reconcileRecallDisposition(tracedUnits: number, repairedUnits: number, scrappedUnits: number, releasedUnits: number) {
  const dispositionTotal = repairedUnits + scrappedUnits + releasedUnits
  return { tracedUnits, dispositionTotal, balanced: dispositionTotal === tracedUnits, variance: tracedUnits - dispositionTotal } as const
}
export interface RecallAssignmentEvent { id: string; recallId: string; fromOwner: string; toOwner: string; reviewOn: string; reason: string; tracedPopulation: number; immutable: true }
export interface RecallClosure { id: string; recallId: string; assignmentId: string; customerAcknowledgements: number; repairedUnits: number; scrappedUnits: number; releasedUnits: number; genealogyEvidence: string; determination: 'effective' | 'unsuccessful'; decidedBy: string; decidedOn: string; immutable: true }
export interface RecallNotificationAttempt { id: string; recallId: string; customerId: string; shipmentReference: string; lotReference: string; unitReferences: string[]; recallRevision: number; action: 'recall-notification'; outcome: 'failed' | 'acknowledged'; failureReason: string | null; actor: string; attemptedOn: string; retryOf: string | null; immutable: true }
export interface RecallCustomerAcknowledgement { id: string; recallId: string; customerId: string; notificationAttemptId: string; acknowledgedBy: string; acknowledgedOn: string; recallRevision: number; immutable: true }
export interface RecallUnitDisposition { id: string; recallId: string; repairedUnits: number; scrappedUnits: number; releasedUnits: number; genealogyEvidence: string; decidedOn: string; effectivenessDecisionId: string; immutable: true }
export interface RecallShipmentSource { id: string; recallId: string; shipmentReference: string; lineReference: string; customerId: string; lotReference: string; affectedUnits: number; sourceDocument: string; legacyAttestation?: string; recordedBy: string; sourceRevision: number; immutable: true }
export interface LegacyShipmentReview { id: string; shipmentSourceId: string; sourceRevision: number; decision: 'accepted' | 'rejected'; supportingEvidence: string; reviewer: string; reviewedOn: string; immutable: true }
export interface RecallShipmentReturn { id: string; shipmentSourceId: string; returnedUnits: number; custodyReference: string; receivedBy: string; receivedOn: string; immutable: true }
export interface RecallLineageInvestigation { id: string; recallId: string; affectedUnits: number; tracedAtOpening: number; openedAtRevision: number; conflictingShipmentReference: string | null; owner: string; evidenceRequired: string; openedOn: string; immutable: true }
export interface RecallLineageResolution { id: string; investigationId: string; shipmentSourceIds: string[]; sourceRevisions?: Record<string, number>; reviewRequired?: true; resolvedUnits: number; residualUnits: number; evidenceReference: string; resolvedBy: string; resolvedOn: string; immutable: true }
export interface RecallLineageReview { id: string; resolutionId: string; decision: 'accepted' | 'rejected'; reviewer: string; reviewEvidence: string; reviewedOn: string; immutable: true }
export interface RecallResidualDisposition { id: string; recallId: string; investigationId: string; kind: 'internal use' | 'scrap' | 'manufacturing variance'; units: number; evidenceReference: string; investigator: string; proposedOn: string; immutable: true }
export interface RecallResidualReview { id: string; dispositionId: string; decision: 'accepted' | 'rejected'; reviewer: string; reviewEvidence: string; reviewedOn: string; immutable: true }
export interface RecallReturnProcessing { id: string; returnId: string; shipmentSourceId: string; sourceRevision: number; repairedUnits: number; scrappedUnits: number; releasedUnits: number; inspectionEvidence: string; decidedBy: string; decidedOn: string; immutable: true }
export interface RecallPortfolioState { revision: number; recalls: RecallWorkload[]; assignmentHistory: RecallAssignmentEvent[]; notificationAttempts: RecallNotificationAttempt[]; acknowledgements: RecallCustomerAcknowledgement[]; unitDispositions: RecallUnitDisposition[]; shipmentSources: RecallShipmentSource[]; legacyShipmentReviews: LegacyShipmentReview[]; shipmentReturns: RecallShipmentReturn[]; returnProcessing: RecallReturnProcessing[]; lineageInvestigations: RecallLineageInvestigation[]; lineageResolutions: RecallLineageResolution[]; lineageReviews: RecallLineageReview[]; residualDispositions: RecallResidualDisposition[]; residualReviews: RecallResidualReview[]; closures: RecallClosure[] }
export const recallCapacityPolicy = { maximumActiveRecalls: 2 } as const
export const initialRecallPortfolioState: RecallPortfolioState = { revision: 0, recalls: structuredClone(seededRecallWorkload), assignmentHistory: [], notificationAttempts: [], acknowledgements: [], unitDispositions: [], shipmentSources: [], legacyShipmentReviews: [], shipmentReturns: [], returnProcessing: [], lineageInvestigations: [], lineageResolutions: [], lineageReviews: [], residualDispositions: [], residualReviews: [], closures: [] }

function reviewedLegacySource(state: RecallPortfolioState, source: RecallShipmentSource) {
  if (source.sourceDocument.trim()) return true
  return state.legacyShipmentReviews.some((review) => review.shipmentSourceId === source.id && review.sourceRevision === source.sourceRevision && review.decision === 'accepted')
}

function rejectedLegacySource(state: RecallPortfolioState, source: RecallShipmentSource) {
  return !source.sourceDocument.trim() && state.legacyShipmentReviews.some((review) => review.shipmentSourceId === source.id && review.decision === 'rejected')
}

export function getRecallLineageBalance(state: RecallPortfolioState, recallId: string) {
  const recall = state.recalls.find((item) => item.recallId === recallId)
  if (!recall) return null
  const tracedShipmentUnits = state.shipmentSources.filter((item) => {
    if (item.recallId !== recallId) return false
    if (!reviewedLegacySource(state, item)) return false
    const investigation = state.lineageInvestigations.find((entry) => entry.recallId === recallId && item.sourceRevision > entry.openedAtRevision)
    if (!investigation) return true
    return state.lineageResolutions.some((resolution) => resolution.investigationId === investigation.id && resolution.shipmentSourceIds.includes(item.id) && (!resolution.reviewRequired || state.lineageReviews.some((review) => review.resolutionId === resolution.id && review.decision === 'accepted')))
  }).reduce((sum, item) => sum + item.affectedUnits, 0)
  const nonShippedUnits = state.residualDispositions.filter((item) => item.recallId === recallId && state.residualReviews.some((review) => review.dispositionId === item.id && review.decision === 'accepted')).reduce((sum, item) => sum + item.units, 0)
  const untracedUnits = recall.tracedUnits - tracedShipmentUnits - nonShippedUnits
  return { affectedUnits: recall.tracedUnits, tracedShipmentUnits, nonShippedUnits, untracedUnits, complete: untracedUnits === 0 }
}

export function proposeRecallResidualDisposition(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; investigationId: string; kind: RecallResidualDisposition['kind']; units: number; evidenceReference: string; investigator: string; proposedOn: string }) {
  if (state.residualDispositions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before residual disposition proposal.')
  if (command.authority !== 'Quality Analyst') throw new RecallControlError('UNAUTHORIZED', 'Only the quality analyst can propose residual disposition.')
  const investigation = state.lineageInvestigations.find((item) => item.id === command.investigationId)
  const balance = investigation ? getRecallLineageBalance(state, investigation.recallId) : null
  if (!investigation || !balance || state.residualDispositions.some((item) => item.recallId === investigation.recallId && !state.residualReviews.some((review) => review.dispositionId === item.id))) throw new Error('An active investigated residual without a pending proposal is required.')
  if (!Number.isSafeInteger(command.units) || command.units <= 0 || command.units > balance.untracedUnits || !command.evidenceReference.trim() || !command.investigator.trim() || command.proposedOn < investigation.openedOn) throw new Error('Positive residual quantity and source-backed disposition evidence are required.')
  const next = structuredClone(state)
  next.residualDispositions.push({ id: command.id, recallId: investigation.recallId, investigationId: investigation.id, kind: command.kind, units: command.units, evidenceReference: command.evidenceReference.trim(), investigator: command.investigator.trim(), proposedOn: command.proposedOn, immutable: true })
  next.revision += 1
  return next
}

export function reviewRecallResidualDisposition(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; dispositionId: string; decision: RecallResidualReview['decision']; reviewer: string; reviewEvidence: string; reviewedOn: string }) {
  if (state.residualReviews.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before residual review.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can review residual disposition.')
  const proposal = state.residualDispositions.find((item) => item.id === command.dispositionId)
  if (!proposal || state.residualReviews.some((item) => item.dispositionId === proposal.id)) throw new Error('An unreviewed residual proposal is required.')
  const balance = getRecallLineageBalance(state, proposal.recallId)
  if (command.decision === 'accepted' && (!balance || proposal.units > balance.untracedUnits)) throw new Error('The remaining affected quantity changed before residual acceptance.')
  if (!command.reviewer.trim() || command.reviewer === proposal.investigator || !command.reviewEvidence.trim() || command.reviewedOn < proposal.proposedOn) throw new Error('Independent reviewer and current review evidence are required.')
  const next = structuredClone(state)
  next.residualReviews.push({ id: command.id, dispositionId: proposal.id, decision: command.decision, reviewer: command.reviewer.trim(), reviewEvidence: command.reviewEvidence.trim(), reviewedOn: command.reviewedOn, immutable: true })
  next.revision += 1
  return next
}

export function openRecallLineageInvestigation(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; conflictingShipmentReference: string | null; owner: string; evidenceRequired: string; openedOn: string }) {
  if (state.lineageInvestigations.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before lineage investigation opened.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can assign unresolved shipment lineage.')
  const balance = getRecallLineageBalance(state, command.recallId)
  if (!balance || balance.untracedUnits <= 0 || state.lineageInvestigations.some((item) => item.recallId === command.recallId && !state.lineageResolutions.some((resolution) => resolution.investigationId === item.id && (!resolution.reviewRequired || state.lineageReviews.some((review) => review.resolutionId === resolution.id && review.decision === 'accepted'))))) throw new Error('Untraced affected quantity without an active investigation is required.')
  if (!command.owner.trim() || command.evidenceRequired.trim().length < 15) throw new Error('An investigation owner and specific source evidence requirement are required.')
  const next = structuredClone(state)
  next.lineageInvestigations.push({ id: command.id, recallId: command.recallId, affectedUnits: balance.affectedUnits, tracedAtOpening: balance.tracedShipmentUnits, openedAtRevision: state.revision, conflictingShipmentReference: command.conflictingShipmentReference?.trim() ?? null, owner: command.owner.trim(), evidenceRequired: command.evidenceRequired.trim(), openedOn: command.openedOn, immutable: true })
  next.revision += 1
  return next
}

export function resolveRecallLineageInvestigation(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; investigationId: string; shipmentSourceIds: string[]; evidenceReference: string; resolvedBy: string; resolvedOn: string }) {
  if (state.lineageResolutions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before lineage resolution.')
  if (command.authority !== 'Quality Analyst') throw new RecallControlError('UNAUTHORIZED', 'Only the quality analyst can submit investigated shipment lineage for review.')
  const investigation = state.lineageInvestigations.find((item) => item.id === command.investigationId)
  if (!investigation || state.lineageResolutions.some((item) => item.investigationId === investigation.id && (!item.reviewRequired || !state.lineageReviews.some((review) => review.resolutionId === item.id && review.decision === 'rejected')))) throw new Error('An unresolved lineage investigation without a pending proposal is required.')
  const sources = command.shipmentSourceIds.map((id) => state.shipmentSources.find((item) => item.id === id))
  if (sources.length === 0 || sources.some((item) => item?.recallId !== investigation.recallId || item.sourceRevision <= investigation.openedAtRevision) || new Set(command.shipmentSourceIds).size !== command.shipmentSourceIds.length) throw new Error('Resolution must reference distinct newly attested shipment lines for this recall.')
  const resolvedUnits = sources.reduce((sum, item) => sum + (item?.affectedUnits ?? 0), 0)
  const balance = getRecallLineageBalance(state, investigation.recallId)
  if (!balance || resolvedUnits <= 0 || resolvedUnits > balance.untracedUnits || !command.evidenceReference.trim() || !command.resolvedBy.trim()) throw new Error('A source-backed quantity, decision evidence, and investigating operator are required.')
  const next = structuredClone(state)
  next.lineageResolutions.push({ id: command.id, investigationId: investigation.id, shipmentSourceIds: [...command.shipmentSourceIds], sourceRevisions: Object.fromEntries(sources.flatMap((item) => item ? [[item.id, item.sourceRevision]] : [])), reviewRequired: true, resolvedUnits, residualUnits: balance.untracedUnits - resolvedUnits, evidenceReference: command.evidenceReference.trim(), resolvedBy: command.resolvedBy.trim(), resolvedOn: command.resolvedOn, immutable: true })
  next.revision += 1
  return next
}

export function reviewRecallLineageEvidence(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; resolutionId: string; decision: RecallLineageReview['decision']; reviewer: string; reviewEvidence: string; reviewedOn: string }) {
  if (state.lineageReviews.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before lineage evidence review.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can review investigated lineage.')
  const proposal = state.lineageResolutions.find((item) => item.id === command.resolutionId)
  const investigation = state.lineageInvestigations.find((item) => item.id === proposal?.investigationId)
  if (!proposal?.reviewRequired || !investigation || state.lineageReviews.some((item) => item.resolutionId === proposal.id)) throw new Error('An unreviewed investigated linkage is required.')
  if (!command.reviewer.trim() || command.reviewer.trim() === proposal.resolvedBy || !command.reviewEvidence.trim() || command.reviewedOn < proposal.resolvedOn) throw new Error('Independent reviewer and current review evidence are required.')
  if (command.decision === 'accepted' && proposal.shipmentSourceIds.some((id) => state.shipmentSources.find((item) => item.id === id)?.sourceRevision !== proposal.sourceRevisions?.[id])) throw new Error('Shipment source revisions changed before lineage approval.')
  const next = structuredClone(state)
  next.lineageReviews.push({ id: command.id, resolutionId: proposal.id, decision: command.decision, reviewer: command.reviewer.trim(), reviewEvidence: command.reviewEvidence.trim(), reviewedOn: command.reviewedOn, immutable: true })
  next.revision += 1
  return next
}

export function recordRecallShipmentSource(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; shipmentReference: string; lineReference: string; customerId: string; lotReference: string; affectedUnits: number; sourceDocument: string; recordedBy: string }) {
  if (state.shipmentSources.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before shipment source was recorded.')
  if (command.authority !== 'Quality Analyst') throw new RecallControlError('UNAUTHORIZED', 'Only the quality analyst can attest shipment source evidence.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  if (recall?.genealogyReference !== command.lotReference) throw new Error('Shipment source must reference the affected recall lot.')
  if (!command.shipmentReference.trim() || !command.lineReference.trim() || !command.customerId.trim() || !command.sourceDocument.trim() || !command.recordedBy.trim() || !Number.isSafeInteger(command.affectedUnits) || command.affectedUnits <= 0) throw new Error('Shipment line, customer, positive affected quantity, and source document are required.')
  if (state.shipmentSources.some((item) => item.shipmentReference === command.shipmentReference && item.lineReference === command.lineReference && !rejectedLegacySource(state, item))) throw new Error('Shipment line was already attested.')
  if (state.shipmentSources.filter((item) => item.recallId === command.recallId && !rejectedLegacySource(state, item)).reduce((sum, item) => sum + item.affectedUnits, 0) + command.affectedUnits > recall.tracedUnits - (getRecallLineageBalance(state, command.recallId)?.nonShippedUnits ?? 0)) throw new Error('Attested shipment quantity exceeds the traced recall population.')
  const next = structuredClone(state)
  next.shipmentSources.push({ id: command.id, recallId: command.recallId, shipmentReference: command.shipmentReference.trim(), lineReference: command.lineReference.trim(), customerId: command.customerId.trim(), lotReference: command.lotReference, affectedUnits: command.affectedUnits, sourceDocument: command.sourceDocument.trim(), recordedBy: command.recordedBy.trim(), sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function recordLegacyShipmentAttestation(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; shipmentReference: string; lineReference: string; customerId: string; lotReference: string; affectedUnits: number; attestationReference: string; recordedBy: string }) {
  if (state.shipmentSources.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before legacy attestation intake.')
  if (command.authority !== 'Quality Analyst') throw new RecallControlError('UNAUTHORIZED', 'Only quality analysts can intake legacy shipment attestations.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  if (recall?.genealogyReference !== command.lotReference || !command.shipmentReference.trim() || !command.lineReference.trim() || !command.customerId.trim() || !command.attestationReference.trim() || !command.recordedBy.trim() || !Number.isSafeInteger(command.affectedUnits) || command.affectedUnits <= 0) throw new Error('Existing lot, shipment, customer, positive quantity and historical attestation reference are required.')
  if (state.shipmentSources.some((item) => item.shipmentReference === command.shipmentReference && item.lineReference === command.lineReference && !rejectedLegacySource(state, item))) throw new Error('Shipment line already has an active attestation.')
  const allocated = state.shipmentSources.filter((item) => item.recallId === command.recallId && !rejectedLegacySource(state, item)).reduce((sum, item) => sum + item.affectedUnits, 0)
  if (allocated + command.affectedUnits > recall.tracedUnits - (getRecallLineageBalance(state, command.recallId)?.nonShippedUnits ?? 0)) throw new Error('Attested shipment quantity exceeds the traced recall population.')
  const next = structuredClone(state)
  next.shipmentSources.push({ id: command.id, recallId: command.recallId, shipmentReference: command.shipmentReference.trim(), lineReference: command.lineReference.trim(), customerId: command.customerId.trim(), lotReference: command.lotReference, affectedUnits: command.affectedUnits, sourceDocument: '', legacyAttestation: command.attestationReference.trim(), recordedBy: command.recordedBy.trim(), sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function reviewLegacyShipmentAttestation(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; shipmentSourceId: string; decision: LegacyShipmentReview['decision']; supportingEvidence: string; reviewer: string; reviewedOn: string }) {
  if (state.legacyShipmentReviews.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before legacy attestation review.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can review legacy shipment attestations.')
  const source = state.shipmentSources.find((item) => item.id === command.shipmentSourceId)
  if (!source || source.sourceDocument.trim() || state.legacyShipmentReviews.some((item) => item.shipmentSourceId === source.id)) throw new Error('An unreviewed legacy shipment attestation is required.')
  if (!command.supportingEvidence.trim() || !command.reviewer.trim() || command.reviewer === source.recordedBy) throw new Error('Independent reviewer and actual supporting or rejection evidence are required.')
  const next = structuredClone(state)
  next.legacyShipmentReviews.push({ id: command.id, shipmentSourceId: source.id, sourceRevision: source.sourceRevision, decision: command.decision, supportingEvidence: command.supportingEvidence.trim(), reviewer: command.reviewer.trim(), reviewedOn: command.reviewedOn, immutable: true })
  next.revision += 1
  return next
}

export function recordRecallShipmentReturn(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; shipmentSourceId: string; returnedUnits: number; custodyReference: string; receivedBy: string; receivedOn: string }) {
  if (state.shipmentReturns.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before shipment return was recorded.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can accept recovered shipment custody.')
  const source = state.shipmentSources.find((item) => item.id === command.shipmentSourceId)
  if (!source) throw new Error('Attested shipment source is required for returned units.')
  if (!reviewedLegacySource(state, source)) throw new Error('Legacy shipment attestation requires independent acceptance before returned-unit custody.')
  const alreadyReturned = state.shipmentReturns.filter((item) => item.shipmentSourceId === source.id).reduce((sum, item) => sum + item.returnedUnits, 0)
  if (!Number.isSafeInteger(command.returnedUnits) || command.returnedUnits <= 0 || alreadyReturned + command.returnedUnits > source.affectedUnits || !command.custodyReference.trim() || !command.receivedBy.trim()) throw new Error('Return requires valid remaining units and durable custody evidence.')
  const originalRecall = state.recalls.find((item) => item.recallId === source.recallId)
  if (!originalRecall) throw new Error('Recall disappeared during shipment recovery.')
  if (state.closures.some((item) => item.recallId === originalRecall.recallId)) throw new Error('Closed recall cannot receive additional return custody.')
  if (originalRecall.recoveredUnits + command.returnedUnits > originalRecall.tracedUnits) throw new Error('Recovered units cannot exceed the traced recall population.')
  const next = structuredClone(state)
  next.shipmentReturns.push({ id: command.id, shipmentSourceId: source.id, returnedUnits: command.returnedUnits, custodyReference: command.custodyReference.trim(), receivedBy: command.receivedBy.trim(), receivedOn: command.receivedOn, immutable: true })
  const recall = next.recalls.find((item) => item.recallId === source.recallId)
  if (!recall) throw new Error('Recall disappeared during shipment recovery.')
  recall.recoveredUnits += command.returnedUnits
  next.revision += 1
  return next
}

export function getRecallReturnProcessing(state: RecallPortfolioState, recallId: string) {
  return state.shipmentReturns.filter((receipt) => state.shipmentSources.some((source) => source.id === receipt.shipmentSourceId && source.recallId === recallId)).map((receipt) => {
    const source = state.shipmentSources.find((item) => item.id === receipt.shipmentSourceId)
    const history = state.returnProcessing.filter((item) => item.returnId === receipt.id)
    const repairedUnits = history.reduce((sum, item) => sum + item.repairedUnits, 0)
    const scrappedUnits = history.reduce((sum, item) => sum + item.scrappedUnits, 0)
    const releasedUnits = history.reduce((sum, item) => sum + item.releasedUnits, 0)
    return { receipt, source, history, repairedUnits, scrappedUnits, releasedUnits, heldUnits: receipt.returnedUnits - repairedUnits - scrappedUnits - releasedUnits }
  })
}

export function processReturnedRecallUnits(state: RecallPortfolioState, command: { id: string; expectedRevision: number; authority: RecallAuthority; returnId: string; repairedUnits: number; scrappedUnits: number; releasedUnits: number; inspectionEvidence: string; decidedBy: string; decidedOn: string }) {
  if (state.returnProcessing.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed. Refresh before disposition of returned units.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can authorize returned-unit disposition.')
  const receipt = state.shipmentReturns.find((item) => item.id === command.returnId)
  const source = state.shipmentSources.find((item) => item.id === receipt?.shipmentSourceId)
  if (!receipt || !source || !reviewedLegacySource(state, source)) throw new Error('An independently verified shipment source and physical return receipt are required.')
  if (state.closures.some((item) => item.recallId === source.recallId)) throw new Error('Closed recall disposition remains immutable.')
  const prior = getRecallReturnProcessing(state, source.recallId).find((item) => item.receipt.id === receipt.id)
  const quantities = [command.repairedUnits, command.scrappedUnits, command.releasedUnits]
  const processed = quantities.reduce((sum, value) => sum + value, 0)
  if (quantities.some((value) => !Number.isSafeInteger(value) || value < 0) || processed <= 0 || !prior || processed > prior.heldUnits) throw new RecallControlError('DISPOSITION_MISMATCH', 'Disposition must contain positive whole units within the physically held return quantity.')
  const decisionDate = new Date(command.decidedOn + 'T00:00:00Z')
  if (!command.inspectionEvidence.trim() || !command.decidedBy.trim() || command.decidedBy.trim() === receipt.receivedBy.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.decidedOn) || !Number.isFinite(decisionDate.getTime()) || decisionDate.toISOString().slice(0, 10) !== command.decidedOn || command.decidedOn < receipt.receivedOn.slice(0, 10)) throw new Error('Independent disposition authority, inspection evidence, and date after receipt are required.')
  const next = structuredClone(state)
  next.returnProcessing.push({ id: command.id, returnId: receipt.id, shipmentSourceId: source.id, sourceRevision: source.sourceRevision, repairedUnits: command.repairedUnits, scrappedUnits: command.scrappedUnits, releasedUnits: command.releasedUnits, inspectionEvidence: command.inspectionEvidence.trim(), decidedBy: command.decidedBy.trim(), decidedOn: command.decidedOn, immutable: true })
  next.revision += 1
  return next
}
export function getRecallShipmentRecovery(state: RecallPortfolioState, recallId: string) {
  return state.shipmentSources.filter((item) => item.recallId === recallId).map((source) => { const returns = state.shipmentReturns.filter((item) => item.shipmentSourceId === source.id); const returnedUnits = returns.reduce((sum, item) => sum + item.returnedUnits, 0); return { source, returns, returnedUnits, outstandingUnits: source.affectedUnits - returnedUnits, status: returnedUnits === 0 ? 'awaiting recovery' as const : returnedUnits < source.affectedUnits ? 'partially recovered' as const : 'recovered' as const, notification: state.notificationAttempts.filter((item) => item.shipmentReference === source.shipmentReference && item.customerId === source.customerId).at(-1) ?? null } })
}

interface ReassignRecallCommand { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; toOwner: string; reviewOn: string; asOf: string; reason: string }

export function reassignCriticalRecall(state: RecallPortfolioState, command: ReassignRecallCommand) {
  if (state.assignmentHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Recall workload changed. Refresh before reassigning.')
  if (command.authority !== 'Quality Director') throw new Error('Only the quality director can reassign an escalated recall.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  if (!recall) throw new Error('Recall was not found.')
  const ranked = rankRecallWorkload([recall], command.asOf)[0]
  if (ranked?.priority !== 'critical' || !recall.escalated) throw new Error('Recall does not require director reassignment.')
  const activeForOwner = state.recalls.filter((item) => item.owner === command.toOwner && item.recoveredUnits < item.tracedUnits).length
  if (activeForOwner >= recallCapacityPolicy.maximumActiveRecalls) throw new Error('Selected owner has no active recall capacity.')
  if (command.reviewOn <= command.asOf) throw new Error('Effectiveness review must be scheduled in the future.')
  const next = structuredClone(state)
  const target = next.recalls.find((item) => item.recallId === recall.recallId)
  if (!target) throw new Error('Recall disappeared during the portfolio update.')
  next.assignmentHistory.push({ id: command.id, recallId: recall.recallId, fromOwner: recall.owner, toOwner: command.toOwner, reviewOn: command.reviewOn, reason: command.reason.trim(), tracedPopulation: recall.tracedUnits, immutable: true })
  target.owner = command.toOwner
  next.revision += 1
  return next
}

interface RecordRecallNotification { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; customerId: string; shipmentReference?: string; lotReference?: string; unitReferences?: string[]; outcome: 'failed' | 'acknowledged'; failureReason: string | null; actor: string; attemptedOn: string; retryOf: string | null }
export function recordRecallNotification(state: RecallPortfolioState, command: RecordRecallNotification) {
  if (state.notificationAttempts.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before customer notification.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can record consequential recall notification.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  if (!recall) throw new Error('Recall was not found.')
  if (state.notificationAttempts.some((item) => item.recallId === command.recallId && item.customerId === command.customerId && item.outcome === 'acknowledged')) throw new Error('Customer already acknowledged this recall.')
  if (command.retryOf) {
    const previous = state.notificationAttempts.find((item) => item.id === command.retryOf)
    if (previous?.outcome !== 'failed' || previous.recallId !== command.recallId || previous.customerId !== command.customerId) throw new Error('Retry must reference a failed attempt for the same customer and recall.')
  }
  if (command.outcome === 'failed' && !command.failureReason) throw new Error('Failed notification requires a failure reason.')
  const next = structuredClone(state)
  next.notificationAttempts.push({ id: command.id, recallId: command.recallId, customerId: command.customerId, shipmentReference: command.shipmentReference ?? '', lotReference: command.lotReference ?? recall.genealogyReference, unitReferences: [...(command.unitReferences ?? [])], recallRevision: state.revision, action: 'recall-notification', outcome: command.outcome, failureReason: command.failureReason, actor: command.actor, attemptedOn: command.attemptedOn, retryOf: command.retryOf, immutable: true })
  if (command.outcome === 'acknowledged') next.acknowledgements.push({ id: `${command.id}:ack`, recallId: command.recallId, customerId: command.customerId, notificationAttemptId: command.id, acknowledgedBy: command.actor, acknowledgedOn: command.attemptedOn, recallRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

interface DetermineRecallEffectiveness { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; customerAcknowledgements: number; repairedUnits: number; scrappedUnits: number; releasedUnits: number; genealogyEvidence: string; determination: 'effective' | 'unsuccessful'; decidedBy: string; decidedOn: string }
export function determineRecallEffectiveness(state: RecallPortfolioState, command: DetermineRecallEffectiveness) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall workload changed. Refresh before effectiveness determination.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can make the final effectiveness determination.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  const assignment = [...state.assignmentHistory].reverse().find((item) => item.recallId === command.recallId)
  if (!recall || !assignment) throw new Error('A governed recall assignment is required before determination.')
  if (state.shipmentSources.some((item) => item.recallId === command.recallId) && !getRecallLineageBalance(state, command.recallId)?.complete) throw new Error('Untraced shipment lineage prevents effective recall closure.')
  const returnedCustody = getRecallReturnProcessing(state, command.recallId)
  if (returnedCustody.some((item) => item.heldUnits !== 0)) throw new Error('Returned units still held require inspected disposition before effectiveness closure.')
  if (returnedCustody.reduce((sum, item) => sum + item.repairedUnits, 0) > command.repairedUnits || returnedCustody.reduce((sum, item) => sum + item.scrappedUnits, 0) > command.scrappedUnits || returnedCustody.reduce((sum, item) => sum + item.releasedUnits, 0) > command.releasedUnits) throw new RecallControlError('DISPOSITION_MISMATCH', 'Final effectiveness disposition contradicts the inspected return history.')
  const acknowledgedCustomers = new Set(state.acknowledgements.filter((item) => item.recallId === command.recallId).map((item) => item.customerId))
  if (acknowledgedCustomers.size !== recall.customerCount) throw new Error('Every affected customer must have a durable acknowledgement before closure.')
  if (command.customerAcknowledgements !== acknowledgedCustomers.size) throw new RecallControlError('DISPOSITION_MISMATCH', 'The reported acknowledgement count must match the durable customer history.')
  const reconciliation = reconcileRecallDisposition(recall.tracedUnits, command.repairedUnits, command.scrappedUnits, command.releasedUnits)
  if (command.customerAcknowledgements !== recall.customerCount || !reconciliation.balanced || !command.genealogyEvidence.trim()) throw new RecallControlError('DISPOSITION_MISMATCH', 'Customer, population, disposition, and genealogy evidence must fully reconcile.')
  if (command.determination !== 'effective') throw new Error('An unsuccessful recall requires additional recovery action and cannot close.')
  const next = structuredClone(state)
  const target = next.recalls.find((item) => item.recallId === recall.recallId)
  if (!target) throw new Error('Recall disappeared during closure.')
  next.closures.push({ ...command, assignmentId: assignment.id, immutable: true })
  next.unitDispositions.push({ id: `${command.id}:disposition`, recallId: command.recallId, repairedUnits: command.repairedUnits, scrappedUnits: command.scrappedUnits, releasedUnits: command.releasedUnits, genealogyEvidence: command.genealogyEvidence, decidedOn: command.decidedOn, effectivenessDecisionId: command.id, immutable: true })
  target.recoveredUnits = recall.tracedUnits
  target.quarantinedUnits = 0
  target.escalated = false
  next.revision += 1
  return next
}

export function getRecallRecoveryTimeline(state: RecallPortfolioState, recallId: string, customerId?: string) {
  return {
    attempts: state.notificationAttempts.filter((item) => item.recallId === recallId && (!customerId || item.customerId === customerId)),
    acknowledgements: state.acknowledgements.filter((item) => item.recallId === recallId && (!customerId || item.customerId === customerId)),
    dispositions: state.unitDispositions.filter((item) => item.recallId === recallId),
    decisions: state.closures.filter((item) => item.recallId === recallId),
  }
}

export interface RecallRecoveryFilter {
  recallId?: string
  customerId?: string
  outcome?: RecallNotificationAttempt['outcome']
  acknowledgement?: 'acknowledged' | 'outstanding'
  physicalState?: 'undisposed' | 'disposed'
  effectiveness?: 'open' | RecallClosure['determination']
  shipmentReference?: string
  lotReference?: string
  unitReference?: string
  retryState?: 'unrecovered-failure' | 'recovered-failure'
}

export function browseRecallRecovery(state: RecallPortfolioState, filter: RecallRecoveryFilter = {}) {
  return state.recalls.filter((recall) => {
    const attempts = state.notificationAttempts.filter((item) => item.recallId === recall.recallId)
    const acknowledgements = state.acknowledgements.filter((item) => item.recallId === recall.recallId)
    const dispositions = state.unitDispositions.filter((item) => item.recallId === recall.recallId)
    const decisions = state.closures.filter((item) => item.recallId === recall.recallId)
    const customerAttempts = filter.customerId ? attempts.filter((item) => item.customerId === filter.customerId) : attempts
    if (filter.recallId && recall.recallId !== filter.recallId) return false
    if (filter.customerId && customerAttempts.length === 0) return false
    if (filter.outcome && !customerAttempts.some((item) => item.outcome === filter.outcome)) return false
    if (filter.shipmentReference && !customerAttempts.some((item) => item.shipmentReference === filter.shipmentReference)) return false
    if (filter.lotReference && recall.genealogyReference !== filter.lotReference && !customerAttempts.some((item) => item.lotReference === filter.lotReference)) return false
    const unitReference = filter.unitReference
    if (unitReference && !customerAttempts.some((item) => item.unitReferences.includes(unitReference))) return false
    if (filter.retryState === 'unrecovered-failure' && !customerAttempts.some((item) => item.outcome === 'failed' && !state.notificationAttempts.some((retry) => retry.retryOf === item.id && retry.outcome === 'acknowledged'))) return false
    if (filter.retryState === 'recovered-failure' && !customerAttempts.some((item) => item.outcome === 'failed' && state.notificationAttempts.some((retry) => retry.retryOf === item.id && retry.outcome === 'acknowledged'))) return false
    if (filter.acknowledgement === 'acknowledged' && acknowledgements.length === 0) return false
    if (filter.acknowledgement === 'outstanding' && acknowledgements.length >= recall.customerCount) return false
    if (filter.physicalState === 'disposed' && dispositions.length === 0) return false
    if (filter.physicalState === 'undisposed' && dispositions.length > 0) return false
    if (filter.effectiveness === 'open' && decisions.length > 0) return false
    if (filter.effectiveness && filter.effectiveness !== 'open' && !decisions.some((item) => item.determination === filter.effectiveness)) return false
    return true
  }).map((recall) => {
    const timeline = getRecallRecoveryTimeline(state, recall.recallId, filter.customerId)
    const retryLineage = timeline.attempts.map((attempt) => ({ attemptId: attempt.id, retryOf: attempt.retryOf, recoveredBy: state.notificationAttempts.find((item) => item.retryOf === attempt.id)?.id ?? null }))
    return { recall, ...timeline, retryLineage, outstandingAcknowledgements: Math.max(0, recall.customerCount - state.acknowledgements.filter((item) => item.recallId === recall.recallId).length) }
  })
}

export function getRecallOperationalDrillDown(state: RecallPortfolioState, recallId: string, customerId?: string) {
  const recall = state.recalls.find((item) => item.recallId === recallId)
  if (!recall) return null
  const timeline = getRecallRecoveryTimeline(state, recallId, customerId)
  const shipments = timeline.attempts.map((attempt) => ({ shipmentReference: attempt.shipmentReference, customerId: attempt.customerId, lotReference: attempt.lotReference, unitReferences: [...attempt.unitReferences], notificationOutcome: attempt.outcome, acknowledged: timeline.acknowledgements.some((item) => item.customerId === attempt.customerId), recoveredBy: state.notificationAttempts.find((item) => item.retryOf === attempt.id && item.outcome === 'acknowledged')?.id ?? null }))
  return { recallId, authoritativeGenealogy: recall.genealogyReference, owner: recall.owner, shipments, physicalRecovery: { recoveredUnits: recall.recoveredUnits, tracedUnits: recall.tracedUnits, dispositions: timeline.dispositions }, effectivenessDecision: timeline.decisions.at(-1) ?? null }
}

export function getRecallProductionLink(state: RecallPortfolioState, execution: FactoryExecutionState, recallId: string) {
  const recall = state.recalls.find((item) => item.recallId === recallId)
  if (!recall) return null
  const matches = execution.genealogy.filter((item) => item.outputLotId === recall.genealogyReference)
  if (matches.length !== 1) return { status: matches.length === 0 ? 'missing' as const : 'conflicting' as const, lotReference: recall.genealogyReference, sourceRevision: execution.revision, orderId: null }
  const genealogy = matches[0]
  if (!genealogy) throw new Error('Matched factory genealogy disappeared during recall linkage.')
  const allocation = execution.allocations.find((item) => item.orderId === genealogy.orderId && item.lotId === genealogy.inputLotId && item.status === 'consumed')
  if (!allocation) return { status: 'incomplete' as const, lotReference: recall.genealogyReference, sourceRevision: execution.revision, orderId: null }
  return { status: 'verified' as const, lotReference: genealogy.outputLotId, sourceRevision: execution.revision, orderId: genealogy.orderId, inputLotId: genealogy.inputLotId, genealogyId: genealogy.id, allocationId: allocation.id, producedUnits: genealogy.quantity, verifiedBy: genealogy.verifiedBy, verifiedOn: genealogy.at }
}

export interface RecallIntegrityFinding {
  code: 'PRODUCTION_SOURCE' | 'QUANTITY' | 'SHIPMENT_SOURCE' | 'LINEAGE_REVIEW' | 'ACKNOWLEDGEMENT' | 'RETURN_SOURCE' | 'DISPOSITION' | 'EFFECTIVENESS' | 'DUPLICATE_UNIT'
  recordId: string
  detail: string
  remediation: string
}

/** Inspects existing evidence; it never creates or repairs a business record. */
export function inspectRecallIntegrity(state: RecallPortfolioState, execution: FactoryExecutionState, recallId: string): RecallIntegrityFinding[] {
  const recall = state.recalls.find((item) => item.recallId === recallId)
  if (!recall) return []
  const findings: RecallIntegrityFinding[] = []
  const add = (code: RecallIntegrityFinding['code'], recordId: string, detail: string, remediation: string) => { findings.push({ code, recordId, detail, remediation }) }
  const production = getRecallProductionLink(state, execution, recallId)
  if (production?.status !== 'verified') add('PRODUCTION_SOURCE', recallId, `Production genealogy is ${production?.status ?? 'missing'} for ${recall.genealogyReference}.`, 'Inspect the factory execution genealogy and consumed material allocation; do not infer a production lot.')
  const sources = state.shipmentSources.filter((item) => item.recallId === recallId)
  const sourceById = new Map(sources.map((item) => [item.id, item]))
  const activeSources = sources.filter((item) => !rejectedLegacySource(state, item))
  const sourcedUnits = activeSources.reduce((sum, item) => sum + item.affectedUnits, 0)
  if (sourcedUnits > recall.tracedUnits) add('QUANTITY', recallId, `${String(sourcedUnits)} shipment units exceed the ${String(recall.tracedUnits)} affected units.`, 'Reconcile attested shipment lines against the original affected production population.')
  const balance = getRecallLineageBalance(state, recallId)
  if (balance && (balance.untracedUnits < 0 || balance.tracedShipmentUnits + balance.nonShippedUnits + balance.untracedUnits !== balance.affectedUnits)) add('QUANTITY', recallId, 'Reviewed shipment and non-shipped quantities do not reconcile to the affected population.', 'Review accepted lineage and residual disposition evidence before deciding effectiveness.')
  for (const source of sources) {
    if (!source.shipmentReference.trim() || !source.lineReference.trim() || !source.customerId.trim() || source.lotReference !== recall.genealogyReference || (!source.sourceDocument.trim() && !source.legacyAttestation?.trim())) add('SHIPMENT_SOURCE', source.id, `Shipment line ${source.id} lacks an authoritative dispatch or legacy attestation reference.`, 'Locate the original dispatch line and review any legacy attestation independently.')
  }
  for (const resolution of state.lineageResolutions.filter((item) => state.lineageInvestigations.some((investigation) => investigation.id === item.investigationId && investigation.recallId === recallId))) {
    if (resolution.shipmentSourceIds.some((id) => !sourceById.has(id) || sourceById.get(id)?.sourceRevision !== resolution.sourceRevisions?.[id])) add('LINEAGE_REVIEW', resolution.id, `Investigated linkage ${resolution.id} points to a missing or changed shipment source revision.`, 'Inspect the reviewed shipment revision and submit a new investigated linkage if evidence changed.')
  }
  const attempts = state.notificationAttempts.filter((item) => item.recallId === recallId)
  const attemptById = new Map(attempts.map((item) => [item.id, item]))
  const firstUnitOwner = new Map<string, string>()
  for (const attempt of attempts) {
    if (attempt.retryOf) continue // Retries legitimately repeat the same serialized units.
    for (const unit of attempt.unitReferences) {
      const owner = firstUnitOwner.get(unit)
      if (owner && owner !== attempt.customerId) add('DUPLICATE_UNIT', attempt.id, `Unit ${unit} is assigned to both ${owner} and ${attempt.customerId}.`, 'Check the original shipment lines and correct customer lineage through reviewed evidence.')
      else firstUnitOwner.set(unit, attempt.customerId)
    }
  }
  for (const acknowledgement of state.acknowledgements.filter((item) => item.recallId === recallId)) {
    const attempt = attemptById.get(acknowledgement.notificationAttemptId)
    if (attempt?.outcome !== 'acknowledged' || attempt.customerId !== acknowledgement.customerId || attempt.recallRevision !== acknowledgement.recallRevision) add('ACKNOWLEDGEMENT', acknowledgement.id, `Acknowledgement ${acknowledgement.id} has no matching successful notification revision.`, 'Find the original notification attempt and verify its customer and recall revision.')
  }
  for (const source of sources) {
    const returns = state.shipmentReturns.filter((item) => item.shipmentSourceId === source.id)
    const totalReturned = returns.reduce((sum, item) => sum + item.returnedUnits, 0)
    if (returns.some((item) => !Number.isSafeInteger(item.returnedUnits) || item.returnedUnits <= 0) || totalReturned > source.affectedUnits) add('RETURN_SOURCE', source.id, `Shipment ${source.id} records ${String(totalReturned)} returned units against ${String(source.affectedUnits)} affected units.`, 'Reconcile all custody receipts for this shipment line; each returned unit must be counted once.')
  }
  for (const disposition of state.unitDispositions.filter((item) => item.recallId === recallId)) {
    const total = disposition.repairedUnits + disposition.scrappedUnits + disposition.releasedUnits
    if (total > recall.recoveredUnits || !state.closures.some((item) => item.id === disposition.effectivenessDecisionId && item.recallId === recallId)) add('DISPOSITION', disposition.id, `Disposition ${disposition.id} is not supported by recovered units and a linked effectiveness decision.`, 'Inspect returned-unit custody and the original signed effectiveness decision.')
  }
  for (const closure of state.closures.filter((item) => item.recallId === recallId)) {
    if (!state.assignmentHistory.some((item) => item.id === closure.assignmentId && item.recallId === recallId) || (sources.length > 0 && !balance?.complete) || state.acknowledgements.filter((item) => item.recallId === recallId).length < recall.customerCount) add('EFFECTIVENESS', closure.id, `Effectiveness decision ${closure.id} lacks complete assignment, lineage, or customer acknowledgement evidence.`, 'Reopen the evidence review; preserve the original decision and record any correction separately.')
  }
  return findings
}

export interface RecallAttemptPersistence { load(): RecallPortfolioState | null; save(state: RecallPortfolioState): void }
export class BrowserRecallAttemptPersistence implements RecallAttemptPersistence {
  static key = 'forgeaxis:recall-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserRecallAttemptPersistence.key); if (!raw) return null; type SavedAttempt = Omit<RecallNotificationAttempt, 'shipmentReference' | 'lotReference' | 'unitReferences'> & { shipmentReference?: string; lotReference?: string; unitReferences?: string[] }; const saved = JSON.parse(raw) as Omit<Partial<RecallPortfolioState>, 'notificationAttempts' | 'shipmentSources'> & { notificationAttempts?: SavedAttempt[]; shipmentSources?: (Omit<RecallShipmentSource, 'sourceDocument' | 'sourceRevision'> & { sourceDocument?: string; sourceRevision?: number })[] }; const attempts = (saved.notificationAttempts ?? []).map((item) => ({ ...item, shipmentReference: item.shipmentReference ?? '', lotReference: item.lotReference ?? saved.recalls?.find((recall) => recall.recallId === item.recallId)?.genealogyReference ?? item.recallId, unitReferences: item.unitReferences ?? [] })); return { ...(saved as RecallPortfolioState), notificationAttempts: attempts, acknowledgements: saved.acknowledgements ?? attempts.filter((item) => item.outcome === 'acknowledged').map((item) => ({ id: `${item.id}:ack`, recallId: item.recallId, customerId: item.customerId, notificationAttemptId: item.id, acknowledgedBy: item.actor, acknowledgedOn: item.attemptedOn, recallRevision: item.recallRevision, immutable: true })), unitDispositions: saved.unitDispositions ?? [], shipmentSources: (saved.shipmentSources ?? []).map((item) => ({ ...item, sourceDocument: item.sourceDocument ?? '', sourceRevision: item.sourceRevision ?? 0 })), legacyShipmentReviews: saved.legacyShipmentReviews ?? [], shipmentReturns: saved.shipmentReturns ?? [], returnProcessing: saved.returnProcessing ?? [], lineageInvestigations: saved.lineageInvestigations ?? [], lineageResolutions: saved.lineageResolutions ?? [], lineageReviews: saved.lineageReviews ?? [], residualDispositions: saved.residualDispositions ?? [], residualReviews: saved.residualReviews ?? [] } }
  save(state: RecallPortfolioState) { this.storage.setItem(BrowserRecallAttemptPersistence.key, JSON.stringify(state)) }
}
export class RecallPortfolioRepository {
  private readonly persistence: RecallAttemptPersistence
  constructor(persistence: RecallAttemptPersistence) { this.persistence = persistence }
  read(): RecallPortfolioState { return this.persistence.load() ?? structuredClone(initialRecallPortfolioState) }
  dispatch(command: ReassignRecallCommand | RecordRecallNotification | DetermineRecallEffectiveness | Parameters<typeof recordRecallShipmentSource>[1] | Parameters<typeof recordLegacyShipmentAttestation>[1] | Parameters<typeof reviewLegacyShipmentAttestation>[1] | Parameters<typeof recordRecallShipmentReturn>[1] | Parameters<typeof openRecallLineageInvestigation>[1] | Parameters<typeof resolveRecallLineageInvestigation>[1] | Parameters<typeof reviewRecallLineageEvidence>[1] | Parameters<typeof proposeRecallResidualDisposition>[1] | Parameters<typeof reviewRecallResidualDisposition>[1] | Parameters<typeof processReturnedRecallUnits>[1]) { const current = this.read(); const next = 'returnId' in command ? processReturnedRecallUnits(current, command) : 'dispositionId' in command ? reviewRecallResidualDisposition(current, command) : 'investigator' in command ? proposeRecallResidualDisposition(current, command) : 'resolutionId' in command ? reviewRecallLineageEvidence(current, command) : 'shipmentSourceIds' in command ? resolveRecallLineageInvestigation(current, command) : 'evidenceRequired' in command ? openRecallLineageInvestigation(current, command) : 'shipmentSourceId' in command && 'decision' in command ? reviewLegacyShipmentAttestation(current, command) : 'shipmentSourceId' in command ? recordRecallShipmentReturn(current, command) : 'attestationReference' in command ? recordLegacyShipmentAttestation(current, command) : 'sourceDocument' in command ? recordRecallShipmentSource(current, command) : 'customerId' in command ? recordRecallNotification(current, command) : 'determination' in command ? determineRecallEffectiveness(current, command) : reassignCriticalRecall(current, command); if (next !== current) this.persistence.save(next); return next }
}

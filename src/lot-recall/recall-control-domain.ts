import { rankRecallWorkload, seededRecallWorkload, type RecallWorkload } from './recall-portfolio'

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
export interface RecallNotificationAttempt { id: string; recallId: string; customerId: string; recallRevision: number; action: 'recall-notification'; outcome: 'failed' | 'acknowledged'; failureReason: string | null; actor: string; attemptedOn: string; retryOf: string | null; immutable: true }
export interface RecallCustomerAcknowledgement { id: string; recallId: string; customerId: string; notificationAttemptId: string; acknowledgedBy: string; acknowledgedOn: string; recallRevision: number; immutable: true }
export interface RecallUnitDisposition { id: string; recallId: string; repairedUnits: number; scrappedUnits: number; releasedUnits: number; genealogyEvidence: string; decidedOn: string; effectivenessDecisionId: string; immutable: true }
export interface RecallPortfolioState { revision: number; recalls: RecallWorkload[]; assignmentHistory: RecallAssignmentEvent[]; notificationAttempts: RecallNotificationAttempt[]; acknowledgements: RecallCustomerAcknowledgement[]; unitDispositions: RecallUnitDisposition[]; closures: RecallClosure[] }
export const recallCapacityPolicy = { maximumActiveRecalls: 2 } as const
export const initialRecallPortfolioState: RecallPortfolioState = { revision: 0, recalls: structuredClone(seededRecallWorkload), assignmentHistory: [], notificationAttempts: [], acknowledgements: [], unitDispositions: [], closures: [] }

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

interface RecordRecallNotification { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; customerId: string; outcome: 'failed' | 'acknowledged'; failureReason: string | null; actor: string; attemptedOn: string; retryOf: string | null }
export function recordRecallNotification(state: RecallPortfolioState, command: RecordRecallNotification) {
  if (state.notificationAttempts.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall changed before customer notification.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can record consequential recall notification.')
  if (!state.recalls.some((item) => item.recallId === command.recallId)) throw new Error('Recall was not found.')
  if (state.notificationAttempts.some((item) => item.recallId === command.recallId && item.customerId === command.customerId && item.outcome === 'acknowledged')) throw new Error('Customer already acknowledged this recall.')
  if (command.retryOf) {
    const previous = state.notificationAttempts.find((item) => item.id === command.retryOf)
    if (previous?.outcome !== 'failed' || previous.recallId !== command.recallId || previous.customerId !== command.customerId) throw new Error('Retry must reference a failed attempt for the same customer and recall.')
  }
  if (command.outcome === 'failed' && !command.failureReason) throw new Error('Failed notification requires a failure reason.')
  const next = structuredClone(state)
  next.notificationAttempts.push({ id: command.id, recallId: command.recallId, customerId: command.customerId, recallRevision: state.revision, action: 'recall-notification', outcome: command.outcome, failureReason: command.failureReason, actor: command.actor, attemptedOn: command.attemptedOn, retryOf: command.retryOf, immutable: true })
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

export interface RecallAttemptPersistence { load(): RecallPortfolioState | null; save(state: RecallPortfolioState): void }
export class BrowserRecallAttemptPersistence implements RecallAttemptPersistence {
  static key = 'forgeaxis:recall-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserRecallAttemptPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<RecallPortfolioState>; const attempts = saved.notificationAttempts ?? []; return { ...(saved as RecallPortfolioState), notificationAttempts: attempts, acknowledgements: saved.acknowledgements ?? attempts.filter((item) => item.outcome === 'acknowledged').map((item) => ({ id: `${item.id}:ack`, recallId: item.recallId, customerId: item.customerId, notificationAttemptId: item.id, acknowledgedBy: item.actor, acknowledgedOn: item.attemptedOn, recallRevision: item.recallRevision, immutable: true })), unitDispositions: saved.unitDispositions ?? [] } }
  save(state: RecallPortfolioState) { this.storage.setItem(BrowserRecallAttemptPersistence.key, JSON.stringify(state)) }
}
export class RecallPortfolioRepository {
  private readonly persistence: RecallAttemptPersistence
  constructor(persistence: RecallAttemptPersistence) { this.persistence = persistence }
  read(): RecallPortfolioState { return this.persistence.load() ?? structuredClone(initialRecallPortfolioState) }
  dispatch(command: ReassignRecallCommand | RecordRecallNotification | DetermineRecallEffectiveness) { const current = this.read(); const next = 'customerId' in command ? recordRecallNotification(current, command) : 'determination' in command ? determineRecallEffectiveness(current, command) : reassignCriticalRecall(current, command); if (next !== current) this.persistence.save(next); return next }
}

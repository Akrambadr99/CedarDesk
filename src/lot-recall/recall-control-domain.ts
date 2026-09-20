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
export interface RecallPortfolioState { revision: number; recalls: RecallWorkload[]; assignmentHistory: RecallAssignmentEvent[]; closures: RecallClosure[] }
export const recallCapacityPolicy = { maximumActiveRecalls: 2 } as const
export const initialRecallPortfolioState: RecallPortfolioState = { revision: 0, recalls: structuredClone(seededRecallWorkload), assignmentHistory: [], closures: [] }

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

interface DetermineRecallEffectiveness { id: string; expectedRevision: number; authority: RecallAuthority; recallId: string; customerAcknowledgements: number; repairedUnits: number; scrappedUnits: number; releasedUnits: number; genealogyEvidence: string; determination: 'effective' | 'unsuccessful'; decidedBy: string; decidedOn: string }
export function determineRecallEffectiveness(state: RecallPortfolioState, command: DetermineRecallEffectiveness) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new RecallControlError('STALE_REVISION', 'Recall workload changed. Refresh before effectiveness determination.')
  if (command.authority !== 'Quality Director') throw new RecallControlError('UNAUTHORIZED', 'Only the quality director can make the final effectiveness determination.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  const assignment = [...state.assignmentHistory].reverse().find((item) => item.recallId === command.recallId)
  if (!recall || !assignment) throw new Error('A governed recall assignment is required before determination.')
  const reconciliation = reconcileRecallDisposition(recall.tracedUnits, command.repairedUnits, command.scrappedUnits, command.releasedUnits)
  if (command.customerAcknowledgements !== recall.customerCount || !reconciliation.balanced || !command.genealogyEvidence.trim()) throw new RecallControlError('DISPOSITION_MISMATCH', 'Customer, population, disposition, and genealogy evidence must fully reconcile.')
  if (command.determination !== 'effective') throw new Error('An unsuccessful recall requires additional recovery action and cannot close.')
  const next = structuredClone(state)
  const target = next.recalls.find((item) => item.recallId === recall.recallId)
  if (!target) throw new Error('Recall disappeared during closure.')
  next.closures.push({ ...command, assignmentId: assignment.id, immutable: true })
  target.recoveredUnits = recall.tracedUnits
  target.quarantinedUnits = 0
  target.escalated = false
  next.revision += 1
  return next
}

export class RecallPortfolioRepository {
  static key = 'forgeaxis:recall-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): RecallPortfolioState { const raw = this.storage.getItem(RecallPortfolioRepository.key); return raw ? JSON.parse(raw) as RecallPortfolioState : structuredClone(initialRecallPortfolioState) }
  dispatch(command: ReassignRecallCommand | DetermineRecallEffectiveness) { const current = this.read(); const next = 'determination' in command ? determineRecallEffectiveness(current, command) : reassignCriticalRecall(current, command); if (next !== current) this.storage.setItem(RecallPortfolioRepository.key, JSON.stringify(next)); return next }
}

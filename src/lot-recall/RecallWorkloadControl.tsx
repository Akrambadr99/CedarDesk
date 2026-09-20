/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { rankRecallWorkload, seededRecallWorkload, type RecallWorkload } from './recall-portfolio'

export type RecallAuthority = 'Quality Analyst' | 'Quality Director'
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
  if (state.revision !== command.expectedRevision) throw new Error('Recall workload changed. Refresh before effectiveness determination.')
  if (command.authority !== 'Quality Director') throw new Error('Only the quality director can make the final effectiveness determination.')
  const recall = state.recalls.find((item) => item.recallId === command.recallId)
  const assignment = [...state.assignmentHistory].reverse().find((item) => item.recallId === command.recallId)
  if (!recall || !assignment) throw new Error('A governed recall assignment is required before determination.')
  const dispositionTotal = command.repairedUnits + command.scrappedUnits + command.releasedUnits
  if (command.customerAcknowledgements !== recall.customerCount || dispositionTotal !== recall.tracedUnits || !command.genealogyEvidence.trim()) throw new Error('Customer, population, disposition, and genealogy evidence must fully reconcile.')
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

export function RecallWorkloadControl() {
  const [repository] = useState(() => new RecallPortfolioRepository(localStorage))
  const [state, setState] = useState(() => repository.read())
  const [authority, setAuthority] = useState<RecallAuthority>('Quality Analyst')
  const [message, setMessage] = useState('')
  const feedback = useRef<HTMLParagraphElement>(null)
  const workload = rankRecallWorkload(state.recalls, '2026-10-20')
  const reassign = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, recallId: 'RECALL-SEAL-B88', toOwner: 'Senior recall cell', reviewOn: '2026-10-23', asOf: '2026-10-20', reason: 'Low recovery coverage requires dedicated senior recall ownership.' })); setMessage('Critical recall reassigned and effectiveness review scheduled.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Recall reassignment failed.') } queueMicrotask(() => feedback.current?.focus()) }
  const close = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, recallId: 'RECALL-SEAL-B88', customerAcknowledgements: 2, repairedUnits: 30, scrappedUnits: 15, releasedUnits: 0, genealogyEvidence: 'GEN-SEAL-B88-FINAL', determination: 'effective', decidedBy: 'Quality director', decidedOn: '2026-10-24' })); setMessage('Recall effectiveness confirmed after population and disposition reconciliation.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Recall closure failed.') } queueMicrotask(() => feedback.current?.focus()) }
  return <section className="card" aria-label="Recall workload"><h2>Concurrent recall workload</h2><label>Recall portfolio authority<select value={authority} onChange={(event) => { setAuthority(event.target.value as RecallAuthority) }}><option>Quality Analyst</option><option>Quality Director</option></select></label>{workload.map((item) => <p key={item.recallId}>{item.recallId} · {item.priority} · recovery {item.coveragePercent}% · {item.unrecoveredUnits} units outstanding · {item.owner}</p>)}<button disabled={authority !== 'Quality Director' || state.assignmentHistory.length > 0} onClick={reassign}>Reassign critical recall</button><button disabled={authority !== 'Quality Director' || state.assignmentHistory.length === 0 || state.closures.length > 0} onClick={close}>Confirm final recall effectiveness</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Recall assignment history">{state.assignmentHistory.map((item) => <li key={item.id}>{item.recallId} · {item.fromOwner} to {item.toOwner} · review {item.reviewOn} · population {item.tracedPopulation}</li>)}</ol><ol aria-label="Recall closure history">{state.closures.map((item) => <li key={item.id}>{item.recallId} · {item.determination} · repaired {item.repairedUnits} · scrapped {item.scrappedUnits} · genealogy {item.genealogyEvidence}</li>)}</ol></section>
}

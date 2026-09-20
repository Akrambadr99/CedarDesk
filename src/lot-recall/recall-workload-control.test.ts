import { describe, expect, it } from 'vitest'
import { initialRecallPortfolioState, reassignCriticalRecall } from './RecallWorkloadControl'

const command = { id: 'assign-1', expectedRevision: 0, authority: 'Quality Director' as const, recallId: 'RECALL-SEAL-B88', toOwner: 'Senior recall cell', reviewOn: '2026-10-23', asOf: '2026-10-20', reason: 'Low recovery coverage requires dedicated senior recall ownership.' }
describe('critical recall reassignment', () => {
  it('reassigns only the critical recall and schedules its review', () => { const next = reassignCriticalRecall(initialRecallPortfolioState, command); expect(next.recalls.find((item) => item.recallId === command.recallId)?.owner).toBe('Senior recall cell'); expect(next.assignmentHistory[0]).toMatchObject({ fromOwner: 'Customer recovery team', reviewOn: '2026-10-23', tracedPopulation: 45 }) })
  it('enforces director authority and current revision', () => { expect(() => reassignCriticalRecall(initialRecallPortfolioState, { ...command, authority: 'Quality Analyst' })).toThrow('quality director'); expect(() => reassignCriticalRecall(initialRecallPortfolioState, { ...command, expectedRevision: 3 })).toThrow('changed') })
  it('does not duplicate an already applied assignment command', () => { const next = reassignCriticalRecall(initialRecallPortfolioState, command); expect(reassignCriticalRecall(next, command)).toBe(next) })
})

import { describe, expect, it } from 'vitest'
import { counts, timeline } from './fixtures'
import { consumeLot, materialPlan, type MaterialLot } from './materials'
import { changeoverMinutes, scheduleConflicts, sequenceOrders, type ScheduledOrder } from './schedule'
import { summarizeShift } from './shifts'

describe('production scheduling', () => {
  const orders: ScheduledOrder[] = [
    { id: 'wo-1', lineId: 'line-a', startsAt: '2027-03-15T08:00:00Z', endsAt: '2027-03-15T10:00:00Z', changeoverFamily: 'brass', priority: 1 },
    { id: 'wo-2', lineId: 'line-a', startsAt: '2027-03-15T09:00:00Z', endsAt: '2027-03-15T11:00:00Z', changeoverFamily: 'steel', priority: 3 },
    { id: 'wo-3', lineId: 'line-b', startsAt: '2027-03-15T09:00:00Z', endsAt: '2027-03-15T11:00:00Z', changeoverFamily: 'steel', priority: 2 },
  ]
  it('detects line overlap and sequences by operational priority', () => {
    expect(scheduleConflicts(orders)).toEqual([['wo-1', 'wo-2']])
    expect(sequenceOrders(orders).map((order) => order.id)).toEqual(['wo-2', 'wo-3', 'wo-1'])
    expect(changeoverMinutes(sequenceOrders(orders), 25)).toBe(25)
    expect(changeoverMinutes([], 25)).toBe(0)
  })
})

describe('material and shift accounting', () => {
  const lots: MaterialLot[] = [
    { lotId: 'lot-a', material: 'AL-6061', quantity: 600, status: 'released' },
    { lotId: 'lot-b', material: 'AL-6061', quantity: 100, status: 'quarantine' },
  ]
  it('excludes quarantine stock and prevents invalid consumption', () => {
    expect(materialPlan(lots, [{ material: 'AL-6061', quantityPerUnit: 2 }], 420)[0]).toMatchObject({ required: 840, available: 600, shortage: 240 })
    expect(consumeLot(lots, 'lot-a', 600)[0]!.status).toBe('consumed')
    expect(consumeLot(lots, 'lot-a', 20)[0]!.quantity).toBe(580)
    expect(() => consumeLot(lots, 'lot-b', 1)).toThrow(/released/)
    expect(() => consumeLot(lots, 'missing', 1)).toThrow(/not found/)
    expect(() => consumeLot(lots, 'lot-a', 0)).toThrow(/positive/)
    expect(() => consumeLot(lots, 'lot-a', 601)).toThrow(/exceeds/)
  })
  it('clips event-derived totals to shift boundaries', () => {
    const summary = summarizeShift({ id: 'shift-b', startsAt: '2027-03-15T06:00:00Z', endsAt: '2027-03-15T14:00:00Z', crew: 'B' }, counts, timeline)
    expect(summary).toEqual({ shiftId: 'shift-b', good: 306, scrap: 11, downtimeMinutes: 35 })
    expect(summarizeShift({ id: 'night', startsAt: '2027-03-16T00:00:00Z', endsAt: '2027-03-16T08:00:00Z', crew: 'C' }, counts, timeline)).toMatchObject({ good: 0, downtimeMinutes: 0 })
  })
})

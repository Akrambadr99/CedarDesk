import { describe, expect, it } from 'vitest';
import { appendMachineEvent, canStartOrder, completeOrder, intervalsOverlap, oee, productionTotals } from './production';
import { counts, gates, order, timeline } from './fixtures';
describe('factory event model', () => {
    it('derives production totals from immutable counter events', () => {
        expect(productionTotals(counts, order.id)).toEqual({ good: 306, scrap: 11 });
        expect(productionTotals(counts, 'missing')).toEqual({ good: 0, scrap: 0 });
    });
    it('detects overlap and appends a non-overlapping machine state', () => {
        expect(intervalsOverlap(timeline[0]!, timeline[1]!)).toBe(false);
        expect(() => appendMachineEvent(timeline, { id: 'e3', machineId: 'MX-04', state: 'faulted', startedAt: '2027-03-15T11:00:00Z', endedAt: '2027-03-15T11:10:00Z', reason: 'Spindle alarm' })).toThrow(/overlap/);
        expect(appendMachineEvent(timeline, { id: 'e4', machineId: 'MX-04', state: 'maintenance', startedAt: '2027-03-15T12:00:00Z', endedAt: '2027-03-15T12:10:00Z', reason: 'Inspection' })).toHaveLength(3);
    });
    it('enforces material and role release rules', () => {
        expect(canStartOrder({ ...order, materialAvailable: 100 }, 'Supervisor')).toMatchObject({ allowed: false });
        expect(canStartOrder(order, 'Quality Engineer')).toMatchObject({ allowed: false });
        expect(canStartOrder(order, 'Operator')).toEqual({ allowed: true });
    });
    it('requires gates and target count before completion', () => {
        expect(() => completeOrder(order, gates, counts)).toThrow(/quality/);
        expect(() => completeOrder(order, gates.map((gate) => ({ ...gate, result: 'passed' })), counts)).toThrow(/target/);
        const enough = [...counts, { id: 'c3', orderId: order.id, at: '2027-03-15T12:00:00Z', good: 114, scrap: 0, source: 'operator' as const }];
        expect(completeOrder(order, gates.map((gate) => ({ ...gate, result: 'passed' })), enough).status).toBe('complete');
    });
    it('calculates OEE from its three factors', () => { expect(oee(.92, .88, .97)).toBe(78.5); });
});

import { describe, expect, it } from 'vitest';
import { acceptShiftHandoff, consumeMaterial, initialFactoryExecution, recordLotGenealogy, releaseMaterial, requestShiftHandoff, reserveMaterial } from './execution-control';

const actor = (id: string, role: 'Supervisor' | 'Operator' | 'Quality Engineer' | 'Auditor') => ({ id, role });
const meta = (id: string, revision: number, idActor: string, role: Parameters<typeof actor>[1]) => ({ id, expectedRevision: revision, actor: actor(idActor, role), at: '2026-09-13T10:00:00Z' });

describe('factory execution control', () => {
    it('requires the assigned relief operator to accept a durable shift handoff', () => {
        const requested = requestShiftHandoff(initialFactoryExecution, { ...meta('h1', 0, 'operator-a', 'Operator'), line: 'North assembly', incoming: 'operator-b', handoffNote: 'Press four is ready; verify the first-off sample.' });
        expect(() => acceptShiftHandoff(requested, { ...meta('h2', 1, 'operator-c', 'Operator'), handoffId: 'h1-handoff', acceptanceNote: 'I reviewed the line condition and open quality gate.' })).toThrow('assigned relief');
        const accepted = acceptShiftHandoff(requested, { ...meta('h3', 1, 'operator-b', 'Operator'), handoffId: 'h1-handoff', acceptanceNote: 'I reviewed the line condition and open quality gate.' });
        expect(accepted.handoffs[0]?.status).toBe('closed');
    });

    it('reserves lot balance and rejects duplicate order allocation', () => {
        const reserved = reserveMaterial(initialFactoryExecution, { ...meta('a1', 0, 'supervisor-a', 'Supervisor'), orderId: 'order-1', lotId: 'lot-1', kilograms: 200 });
        expect(reserved.lotBalances['lot-1']).toBe(800);
        expect(() => reserveMaterial(reserved, { ...meta('a2', 1, 'supervisor-a', 'Supervisor'), orderId: 'order-1', lotId: 'lot-1', kilograms: 100 })).toThrow('already has');
    });

    it('requires staged release before consumption', () => {
        const reserved = reserveMaterial(initialFactoryExecution, { ...meta('a1', 0, 'supervisor-a', 'Supervisor'), orderId: 'order-1', lotId: 'lot-1', kilograms: 200 });
        expect(() => consumeMaterial(reserved, { ...meta('a2', 1, 'operator-a', 'Operator'), allocationId: 'a1-allocation' })).toThrow('released');
        const released = releaseMaterial(reserved, { ...meta('a3', 1, 'operator-a', 'Operator'), allocationId: 'a1-allocation' });
        const consumed = consumeMaterial(released, { ...meta('a4', 2, 'operator-a', 'Operator'), allocationId: 'a1-allocation' });
        expect(consumed.allocations[0]?.status).toBe('consumed');
    });

    it('records one quality-verified genealogy after consumption', () => {
        let state = reserveMaterial(initialFactoryExecution, { ...meta('a1', 0, 'supervisor-a', 'Supervisor'), orderId: 'order-1', lotId: 'lot-1', kilograms: 200 });
        state = releaseMaterial(state, { ...meta('a2', 1, 'operator-a', 'Operator'), allocationId: 'a1-allocation' });
        state = consumeMaterial(state, { ...meta('a3', 2, 'operator-a', 'Operator'), allocationId: 'a1-allocation' });
        state = recordLotGenealogy(state, { ...meta('g1', 3, 'quality-a', 'Quality Engineer'), allocationId: 'a1-allocation', outputLotId: 'FG-2026-001', quantity: 100 });
        expect(state.genealogy[0]).toMatchObject({ inputLotId: 'lot-1', outputLotId: 'FG-2026-001', verifiedBy: 'quality-a' });
        expect(() => recordLotGenealogy(state, { ...meta('g2', 4, 'quality-a', 'Quality Engineer'), allocationId: 'a1-allocation', outputLotId: 'FG-2026-002', quantity: 100 })).toThrow('already recorded');
    });

    it('rejects stale revisions before changing balances', () => {
        expect(() => reserveMaterial(initialFactoryExecution, { ...meta('a1', 4, 'supervisor-a', 'Supervisor'), orderId: 'order-1', lotId: 'lot-1', kilograms: 200 })).toThrow('Refresh');
        expect(initialFactoryExecution.lotBalances['lot-1']).toBe(1000);
    });
});

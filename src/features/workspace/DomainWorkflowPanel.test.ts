import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { machineReadiness } from './DomainWorkflowPanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, title: id, revision: 1, fields });
describe('machineReadiness', () => {
    it('combines machine and maintenance blockers', () => expect(machineReadiness(entity('m1', 'machine', 'maintenance'), [entity('x', 'maintenance', 'open', { machine: 'm1' })]).reasons).toHaveLength(2));
    it('counts active orders for a ready machine', () => expect(machineReadiness(entity('m1', 'machine', 'ready'), [entity('o1', 'order', 'running', { machine: 'm1' })])).toMatchObject({ ready: true, activeOrders: 1 }));
});

import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { qualityDisposition } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields']): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('qualityDisposition', () => {
    it('blocks release until count and inspection evidence agree', () => expect(qualityDisposition(entity('o', 'order', 'running', { target: 10 }), [entity('c', 'count', 'recorded', { order: 'o', good: 8, scrap: 0 }), entity('i', 'inspection', 'failed', { order: 'o' })], 'release').blockers).toHaveLength(2));
    it('allows rework only for a failed quality finding', () => expect(qualityDisposition(entity('o', 'order', 'held', { target: 10 }), [entity('i', 'inspection', 'failed', { order: 'o' })], 'rework').ready).toBe(true));
});

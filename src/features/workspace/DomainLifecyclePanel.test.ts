import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { qualityDisposition } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields']): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('qualityDisposition', () => {
    it('blocks release until count and inspection evidence agree', () => expect(qualityDisposition(entity('o', 'order', 'running', { target: 10 }), [entity('c', 'count', 'recorded', { order: 'o', good: 8, scrap: 0 }), entity('i', 'inspection', 'failed', { order: 'o' })], 'release').blockers).toHaveLength(2));
    it('allows rework only for a failed quality finding', () => expect(qualityDisposition(entity('o', 'order', 'held', { target: 10 }), [entity('i', 'inspection', 'failed', { order: 'o' })], 'rework').ready).toBe(true));
});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
const run = (state: Snapshot, id: string, target: string, operation: string, actorId: string, input: Record<string, Value> = {}) => execute(state, { id, entityId: target, operation, actorId, input, expectedRevision: state.revision, type: 'operate' }, product, '2026-09-12T10:00:00Z');
const failedRun = () => {
    let state = run(fresh(product), 'release', 'order-1', 'release', 'actor-0');
    state = run(state, 'count', 'order-1', 'count', 'actor-1', { good: 100, scrap: 0 });
    return run(state, 'fail', 'release-1', 'inspect', 'actor-2', { result: 'failed' });
};
describe('durable quality disposition', () => {
    it('holds production, preserves failed evidence and releases only verified rework', () => {
        let state = failedRun();
        expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('held');
        state = run(state, 'plan', 'release-1', 'plan-rework', 'actor-2', { plan: 'Rework the housing mating surface.' });
        expect(() => run(state, 'duplicate', 'release-1', 'plan-rework', 'actor-2', { plan: 'Rework the housing mating surface.' })).toThrow('already exists');
        state = run(state, 'perform', 'plan-1', 'perform-rework', 'actor-1', { evidence: 'Surface reworked to drawing tolerance.' });
        expect(() => run(state, 'early', 'plan-1', 'release-rework', 'actor-2')).toThrow('must pass');
        state = run(state, 'pass', 'perform-1', 'inspect', 'actor-2', { result: 'passed' });
        state = run(state, 'resolve', 'plan-1', 'release-rework', 'actor-2');
        state = run(state, 'finish', 'order-1', 'complete', 'actor-0');
        expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('complete');
        expect(state.entities.find(item => item.id === 'release-1')?.status).toBe('failed');
        expect(state.entities.find(item => item.id === 'lot-1')?.fields['quantity']).toBe(800);
    });
    it('maintenance recovery cannot bypass the quality hold and failed commands are atomic', () => {
        let state = failedRun();
        state = run(state, 'plan', 'release-1', 'plan-rework', 'actor-2', { plan: 'Rework the housing mating surface.' });
        state = run(state, 'hold', 'machine-1', 'hold', 'actor-0', { reason: 'Replace damaged press tooling.' });
        const before = structuredClone(state);
        expect(() => run(state, 'perform', 'plan-1', 'perform-rework', 'actor-1', { evidence: 'Surface reworked to drawing tolerance.' })).toThrow('ready machine');
        expect(state).toEqual(before);
        state = run(state, 'repair', 'hold-1', 'repair', 'actor-0');
        expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('held');
        expect(() => run(state, 'bad-role', 'plan-1', 'perform-rework', 'actor-0', { evidence: 'Surface reworked to drawing tolerance.' })).toThrow('role');
    });
    it('failed rework can recover through a new verification without altering old inspection results', () => {
        let state = run(failedRun(), 'plan', 'release-1', 'plan-rework', 'actor-2', { plan: 'Rework the housing mating surface.' });
        state = run(state, 'perform', 'plan-1', 'perform-rework', 'actor-1', { evidence: 'First machining pass completed.' });
        state = run(state, 'fail-again', 'perform-1', 'inspect', 'actor-2', { result: 'failed' });
        state = run(state, 'retry', 'plan-1', 'retry-rework', 'actor-2', { plan: 'Repeat machining with adjusted tooling.' });
        state = run(state, 'redo', 'retry-1', 'perform-rework', 'actor-1', { evidence: 'Second machining pass completed.' });
        state = run(state, 'verify', 'redo-1', 'inspect', 'actor-2', { result: 'passed' });
        state = run(state, 'release-child', 'retry-1', 'release-rework', 'actor-2');
        expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('held');
        state = run(state, 'release-parent', 'plan-1', 'release-rework', 'actor-2');
        expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('running');
        expect(state.entities.filter(item => item.kind === 'inspection' && item.status === 'failed')).toHaveLength(2);
    });
});

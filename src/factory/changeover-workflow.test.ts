import { describe, expect, it } from 'vitest';
import { product } from '../product/definition';
import { execute, fresh } from '../workspace/engine';
import type { Snapshot, Value } from '../workspace/types';
const evidence = 'Setup, guarding and material clearance evidence verified.';
function act(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, { id: 'c-' + String(state.revision), expectedRevision: state.revision, actorId,
        type: 'operate', operation, entityId, input }, product, '2026-09-12T12:00:00Z');
}
function request() {
    const state = fresh(product); const material = state.entities.find(item => item.kind === 'lot')!.fields['material']!;
    return act(state, 'setup-request', 'machine-1', 'actor-0', { material, evidence });
}
describe('machine setup execution', () => {
    it('blocks production while isolated and releases only after quality approval', () => {
        let state = request();
        expect(() => act(state, 'release', 'order-1', 'actor-0')).toThrow(/both be released/);
        state = act(state, 'setup-complete', 'c-0-1', 'actor-1', { evidence });
        state = act(state, 'setup-release', 'c-0-1', 'actor-2', { evidence });
        expect(act(state, 'release', 'order-1', 'actor-0').entities.find(item => item.id === 'order-1')?.status).toBe('running');
    });
    it('rejects operator self-approval and preserves rejection during rework', () => {
        let state = act(request(), 'setup-complete', 'c-0-1', 'actor-1', { evidence });
        expect(() => act(state, 'setup-release', 'c-0-1', 'actor-1', { evidence })).toThrow(/role/);
        state = act(state, 'setup-reject', 'c-0-1', 'actor-2', { evidence: 'Material residue requires another cleaning pass.' });
        state = act(state, 'setup-complete', 'c-0-1', 'actor-1', { evidence });
        expect(state.audit.some(item => item.summary.includes('residue'))).toBe(true);
        expect(state.entities.find(item => item.id === 'machine-1')?.status).toBe('changeover');
    });
    it('rejects stale machine evidence without partial machine release', () => {
        const state = act(request(), 'setup-complete', 'c-0-1', 'actor-1', { evidence });
        state.entities.find(item => item.id === 'machine-1')!.revision++;
        expect(() => act(state, 'setup-release', 'c-0-1', 'actor-2', { evidence })).toThrow(/Machine state changed/);
        expect(state.entities.find(item => item.id === 'machine-1')?.status).toBe('changeover');
    });
    it('allows cancellation before setup evidence, but not after physical work', () => {
        expect(act(request(), 'setup-cancel', 'c-0-1', 'actor-0', { evidence }).entities.find(item => item.id === 'machine-1')?.status).toBe('ready');
        const state = act(request(), 'setup-complete', 'c-0-1', 'actor-1', { evidence });
        expect(() => act(state, 'setup-cancel', 'c-0-1', 'actor-0', { evidence })).toThrow(/current state/);
    });
    it('rejects changing machines that have active production', () => {
        const state = act(fresh(product), 'release', 'order-1', 'actor-0');
        expect(() => act(state, 'setup-request', 'machine-1', 'actor-0', { material: 'steel', evidence })).toThrow(/active production/);
    });
    it('enforces configured material before consuming a production lot', () => {
        const state = fresh(product);state.entities.find(item => item.id === 'machine-1')!.fields['configuredMaterial'] = 'OTHER';
        const before = JSON.stringify(state);
        expect(() => act(state, 'release', 'order-1', 'actor-0')).toThrow(/does not match/);
        expect(JSON.stringify(state)).toBe(before);
    });
});

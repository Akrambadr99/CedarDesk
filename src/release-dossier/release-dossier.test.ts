import { describe, expect, it } from 'vitest';
import {
  approveRelease,
  dispatchReleasedBatch,
  initialReleaseDossierState,
  openReleaseDossier,
  recordGenealogy,
  verifyReleaseQuality,
} from './release-dossier';

const meta = (id: string, revision: number, actor: string, role: 'Production Supervisor' | 'Operator' | 'Quality Engineer' | 'Shipping') => ({
  id,
  expectedRevision: revision,
  actor: { id: actor, role },
});

describe('integrated release dossier', () => {
  it('consumes genealogy and transfers released batch custody', () => {
    let state = openReleaseDossier(initialReleaseDossierState, meta('open', 0, 'supervisor', 'Production Supervisor'));
    state = recordGenealogy(state, {
      ...meta('genealogy', 1, 'operator', 'Operator'),
      allocations: [
        { lot: 'AL-2409-A', quantity: 80, version: 2 },
        { lot: 'AL-2409-B', quantity: 40, version: 3 },
      ],
    });
    state = verifyReleaseQuality(state, {
      ...meta('quality', 2, 'quality', 'Quality Engineer'),
      sampleSize: 12,
      defects: 0,
      evidence: 'Dimensional sample and surface results meet the released specification.',
    });
    state = approveRelease(state, meta('approve', 3, 'supervisor', 'Production Supervisor'));
    state = dispatchReleasedBatch(state, meta('dispatch', 4, 'shipping', 'Shipping'));
    expect(state.inventory.map((lot) => lot.consumed)).toEqual([80, 40]);
    expect(state.order.status).toBe('dispatched');
    expect(state.shipment).toMatchObject({ status: 'dispatched', quantity: 120, custodian: 'shipping' });
    expect(state.dossier?.status).toBe('dispatched');
  });

  it('rejects stale material allocation without partial consumption', () => {
    const state = openReleaseDossier(initialReleaseDossierState, meta('open', 0, 'supervisor', 'Production Supervisor'));
    expect(() => recordGenealogy(state, {
      ...meta('genealogy', 1, 'operator', 'Operator'),
      allocations: [
        { lot: 'AL-2409-A', quantity: 80, version: 1 },
        { lot: 'AL-2409-B', quantity: 40, version: 3 },
      ],
    })).toThrow('Material lot changed');
    expect(state.inventory.map((lot) => lot.consumed)).toEqual([0, 0]);
  });

  it('routes detected defects to nonconformance instead of release', () => {
    let state = openReleaseDossier(initialReleaseDossierState, meta('open', 0, 'supervisor', 'Production Supervisor'));
    state = recordGenealogy(state, {
      ...meta('genealogy', 1, 'operator', 'Operator'),
      allocations: [
        { lot: 'AL-2409-A', quantity: 80, version: 2 },
        { lot: 'AL-2409-B', quantity: 40, version: 3 },
      ],
    });
    expect(() => verifyReleaseQuality(state, {
      ...meta('quality', 2, 'quality', 'Quality Engineer'),
      sampleSize: 12,
      defects: 1,
      evidence: 'Dimensional sample identified one result outside release tolerance.',
    })).toThrow('nonconformance');
  });
});

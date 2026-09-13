export type DossierRole = 'Production Supervisor' | 'Operator' | 'Quality Engineer' | 'Shipping';

export interface DossierActor {
  id: string;
  role: DossierRole;
}

export interface ReleaseDossier {
  id: string;
  status: 'draft' | 'genealogy-recorded' | 'quality-verified' | 'approved' | 'dispatched' | 'cancelled';
  owner: string;
  orderVersion: number;
  gaugeVersion: number;
  materialLots: string[];
  producedQuantity: number;
  sampleSize: number;
  defects: number;
  qualityEvidence: string;
  verifier?: string;
  approver?: string;
}

export interface ReleaseDossierState {
  revision: number;
  order: {
    id: string;
    status: 'completed' | 'released' | 'dispatched';
    version: number;
    completedQuantity: number;
    requiredQuantity: number;
  };
  gauge: {
    id: string;
    status: 'verified';
    version: number;
    dueOn: string;
  };
  inventory: {
    lot: string;
    available: number;
    consumed: number;
    version: number;
  }[];
  shipment: {
    status: 'not-ready' | 'ready' | 'dispatched';
    quantity: number;
    custodian?: string;
    version: number;
  };
  dossier: ReleaseDossier | null;
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialReleaseDossierState: ReleaseDossierState = {
  revision: 0,
  order: {
    id: 'WO-8842',
    status: 'completed',
    version: 8,
    completedQuantity: 120,
    requiredQuantity: 120,
  },
  gauge: {
    id: 'GAUGE-A17',
    status: 'verified',
    version: 4,
    dueOn: '2026-10-01',
  },
  inventory: [
    { lot: 'AL-2409-A', available: 80, consumed: 0, version: 2 },
    { lot: 'AL-2409-B', available: 60, consumed: 0, version: 3 },
  ],
  shipment: { status: 'not-ready', quantity: 0, version: 1 },
  dossier: null,
  events: [],
};

interface CommandMeta {
  id: string;
  expectedRevision: number;
  actor: DossierActor;
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function begin(state: ReleaseDossierState, command: CommandMeta) {
  assert(state.revision === command.expectedRevision, 'Release dossier changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(state: ReleaseDossierState, command: CommandMeta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}

function evidence(value: string) {
  const normalized = value.trim();
  assert(normalized.length >= 20, 'Quality evidence must contain at least 20 characters.');
  return normalized;
}

function requireDossier(state: ReleaseDossierState) {
  const dossier = state.dossier;
  assert(dossier, 'Release dossier does not exist.');
  return dossier;
}

function materialLot(state: ReleaseDossierState, id: string) {
  const lot = state.inventory.find((item) => item.lot === id);
  assert(lot, 'Material lot was not found.');
  return lot;
}

function assertPinnedProduction(state: ReleaseDossierState, dossier: ReleaseDossier) {
  assert(dossier.orderVersion === state.order.version, 'Work order changed. Rebuild the release dossier.');
  assert(dossier.gaugeVersion === state.gauge.version, 'Calibration changed. Repeat quality verification.');
}

export function openReleaseDossier(state: ReleaseDossierState, command: CommandMeta) {
  assert(command.actor.role === 'Production Supervisor', 'Only production supervisors can open release dossiers.');
  const next = begin(state, command);
  assert(next.order.status === 'completed', 'Only completed work can enter release review.');
  assert(next.order.completedQuantity === next.order.requiredQuantity, 'Production quantity is incomplete.');
  assert(!next.dossier || ['dispatched', 'cancelled'].includes(next.dossier.status), 'An active release dossier exists.');
  next.dossier = {
    id: `${command.id}-dossier`,
    status: 'draft',
    owner: command.actor.id,
    orderVersion: next.order.version,
    gaugeVersion: next.gauge.version,
    materialLots: [],
    producedQuantity: next.order.completedQuantity,
    sampleSize: 0,
    defects: 0,
    qualityEvidence: '',
  };
  return finish(next, command, 'release-dossier-opened', next.dossier.id);
}

export function recordGenealogy(
  state: ReleaseDossierState,
  command: CommandMeta & { allocations: { lot: string; quantity: number; version: number }[] },
) {
  assert(command.actor.role === 'Operator', 'Only operators can record production genealogy.');
  const next = begin(state, command);
  const dossier = requireDossier(next);
  assert(dossier.status === 'draft', 'Dossier is not awaiting genealogy.');
  assertPinnedProduction(next, dossier);
  assert(command.allocations.length > 0, 'At least one material lot is required.');
  const total = command.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  assert(total === dossier.producedQuantity, 'Material allocation must equal produced quantity.');
  for (const allocation of command.allocations) {
    assert(Number.isInteger(allocation.quantity) && allocation.quantity > 0, 'Lot quantity must be positive and whole.');
    const lot = materialLot(next, allocation.lot);
    assert(lot.version === allocation.version, 'Material lot changed. Refresh genealogy.');
    assert(lot.available >= allocation.quantity, 'Material lot has insufficient available quantity.');
  }
  for (const allocation of command.allocations) {
    const lot = materialLot(next, allocation.lot);
    lot.available -= allocation.quantity;
    lot.consumed += allocation.quantity;
    lot.version += 1;
  }
  dossier.materialLots = command.allocations.map((allocation) => allocation.lot);
  dossier.status = 'genealogy-recorded';
  return finish(next, command, 'production-genealogy-recorded', dossier.materialLots.join(', '));
}

export function verifyReleaseQuality(
  state: ReleaseDossierState,
  command: CommandMeta & { sampleSize: number; defects: number; evidence: string },
) {
  assert(command.actor.role === 'Quality Engineer', 'Only quality engineering can verify release evidence.');
  const next = begin(state, command);
  const dossier = requireDossier(next);
  assert(dossier.status === 'genealogy-recorded', 'Material genealogy is required before quality review.');
  assertPinnedProduction(next, dossier);
  assert(command.actor.id !== dossier.owner, 'Quality verification must be independent.');
  assert(Number.isInteger(command.sampleSize) && command.sampleSize >= 12, 'Release sample must include at least 12 units.');
  assert(Number.isInteger(command.defects) && command.defects >= 0, 'Defect count must be nonnegative.');
  assert(command.defects === 0, 'Detected defects require a nonconformance workflow.');
  dossier.sampleSize = command.sampleSize;
  dossier.defects = command.defects;
  dossier.qualityEvidence = evidence(command.evidence);
  dossier.verifier = command.actor.id;
  dossier.status = 'quality-verified';
  return finish(next, command, 'release-quality-verified', String(command.sampleSize));
}

export function approveRelease(state: ReleaseDossierState, command: CommandMeta) {
  assert(command.actor.role === 'Production Supervisor', 'Only production supervisors can authorize release.');
  const next = begin(state, command);
  const dossier = requireDossier(next);
  assert(dossier.status === 'quality-verified', 'Independent quality verification is required.');
  assertPinnedProduction(next, dossier);
  assert(dossier.verifier !== command.actor.id, 'Release approval must be separate from quality verification.');
  dossier.approver = command.actor.id;
  dossier.status = 'approved';
  next.order.status = 'released';
  next.order.version += 1;
  next.shipment.status = 'ready';
  next.shipment.quantity = dossier.producedQuantity;
  next.shipment.version += 1;
  return finish(next, command, 'production-release-approved', String(dossier.producedQuantity));
}

export function dispatchReleasedBatch(state: ReleaseDossierState, command: CommandMeta) {
  assert(command.actor.role === 'Shipping', 'Only shipping can dispatch released production.');
  const next = begin(state, command);
  const dossier = requireDossier(next);
  assert(dossier.status === 'approved', 'Approved release dossier is required.');
  assert(next.order.status === 'released' && next.shipment.status === 'ready', 'Released shipment is not ready.');
  next.order.status = 'dispatched';
  next.order.version += 1;
  next.shipment.status = 'dispatched';
  next.shipment.custodian = command.actor.id;
  next.shipment.version += 1;
  dossier.status = 'dispatched';
  return finish(next, command, 'released-batch-dispatched', command.actor.id);
}

export function cancelReleaseDossier(state: ReleaseDossierState, command: CommandMeta) {
  assert(command.actor.role === 'Production Supervisor', 'Only production supervisors can cancel a release dossier.');
  const next = begin(state, command);
  const dossier = requireDossier(next);
  assert(dossier.owner === command.actor.id, 'Only the dossier owner can cancel it.');
  assert(['draft', 'genealogy-recorded'].includes(dossier.status), 'Verified release evidence can no longer be cancelled.');
  if (dossier.status === 'genealogy-recorded') {
    for (const lotId of dossier.materialLots) {
      const lot = materialLot(next, lotId);
      const allocation = lotId === 'AL-2409-A' ? 80 : 40;
      lot.available += allocation;
      lot.consumed -= allocation;
      lot.version += 1;
    }
  }
  dossier.status = 'cancelled';
  return finish(next, command, 'release-dossier-cancelled', dossier.id);
}

export class ReleaseDossierRepository {
  static key = 'forgeaxis:release-dossier:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.storage = storage;
  }

  read() {
    const raw = this.storage.getItem(ReleaseDossierRepository.key);
    return raw ? JSON.parse(raw) as ReleaseDossierState : structuredClone(initialReleaseDossierState);
  }

  commit(expectedRevision: number, change: (state: ReleaseDossierState) => ReleaseDossierState) {
    const current = this.read();
    assert(current.revision === expectedRevision, 'Another session changed the release dossier. Refresh before retrying.');
    const next = change(current);
    this.storage.setItem(ReleaseDossierRepository.key, JSON.stringify(next));
    return next;
  }
}

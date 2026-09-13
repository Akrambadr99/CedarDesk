export type IncomingRole = 'Receiving Inspector' | 'Quality Technician' | 'Quality Manager' | 'Inventory Controller';
export interface IncomingState {
  revision: number;
  lot: { id: string; supplier: string; quantity: number; certificateVersion: number; status: 'received' | 'sampled' | 'accepted' | 'released' | 'rejected' };
  specification: { id: string; version: number; minimumStrength: number; sampleSize: number };
  inventory: { sku: string; quarantined: number; usable: number; version: number };
  inspection: null | { id: string; status: 'draft' | 'sampled' | 'passed' | 'approved' | 'released'; lotCertificateVersion: number; specificationVersion: number; inventoryVersion: number; inspector: string; technician?: string; manager?: string; measuredStrength?: number };
  evidence: { id: string; kind: string; value: string; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialIncomingState: IncomingState = { revision: 0, lot: { id: 'LOT-AL-773', supplier: 'AlloyWorks', quantity: 240, certificateVersion: 5, status: 'received' }, specification: { id: 'SPEC-AL-17', version: 8, minimumStrength: 275, sampleSize: 3 }, inventory: { sku: 'AL-6061-BAR', quarantined: 240, usable: 80, version: 9 }, inspection: null, evidence: [], events: [] };
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: IncomingRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: IncomingState, command: Meta) { assert(state.revision === command.expectedRevision, 'Incoming inspection changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: IncomingState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentInspection(state: IncomingState) { assert(state.inspection, 'No incoming inspection exists.'); return state.inspection; }
function assertEvidenceCurrent(state: IncomingState) { const inspection = currentInspection(state); assert(inspection.lotCertificateVersion === state.lot.certificateVersion, 'Supplier certificate changed after inspection opened.'); assert(inspection.specificationVersion === state.specification.version, 'Material specification changed after inspection opened.'); assert(inspection.inventoryVersion === state.inventory.version, 'Quarantine inventory changed after inspection opened.'); }

export function openIncomingInspection(state: IncomingState, command: Meta) {
  assert(command.actor.role === 'Receiving Inspector', 'Only receiving inspectors can open inspections.');
  const next = begin(state, command);
  assert(!next.inspection && next.lot.status === 'received', 'A newly received lot is required.');
  assert(next.inventory.quarantined >= next.lot.quantity, 'The full supplier lot must be quarantined.');
  next.inspection = { id: `${command.id}-inspection`, status: 'draft', lotCertificateVersion: next.lot.certificateVersion, specificationVersion: next.specification.version, inventoryVersion: next.inventory.version, inspector: command.actor.id };
  return finish(next, command, 'incoming-inspection-opened', next.lot.id);
}

export function recordSample(state: IncomingState, command: Meta & { strengths: number[] }) {
  assert(command.actor.role === 'Quality Technician', 'Only quality technicians can record samples.');
  const next = begin(state, command), inspection = currentInspection(next);
  assert(inspection.status === 'draft' && command.actor.id !== inspection.inspector, 'Independent sample testing is required.');
  assertEvidenceCurrent(next);
  assert(command.strengths.length === next.specification.sampleSize, 'Sample count does not match the specification.');
  assert(command.strengths.every((value) => Number.isFinite(value) && value > 0), 'Sample measurements must be positive numbers.');
  const minimum = Math.min(...command.strengths);
  next.evidence.push({ id: `${command.id}-results`, kind: 'strength-sample', value: command.strengths.join(','), immutable: true });
  inspection.measuredStrength = minimum; inspection.technician = command.actor.id; inspection.status = 'sampled'; next.lot.status = 'sampled';
  return finish(next, command, 'incoming-sample-recorded', String(minimum));
}

export function evaluateSample(state: IncomingState, command: Meta) {
  assert(command.actor.role === 'Quality Technician', 'Only quality technicians can evaluate samples.');
  const next = begin(state, command), inspection = currentInspection(next);
  assert(inspection.status === 'sampled' && inspection.measuredStrength !== undefined, 'Recorded sample evidence is required.');
  assert(command.actor.id === inspection.technician, 'The testing technician must evaluate their recorded sample.');
  assertEvidenceCurrent(next);
  if (inspection.measuredStrength < next.specification.minimumStrength) {
    next.lot.status = 'rejected';
    return finish(next, command, 'incoming-lot-rejected', String(inspection.measuredStrength));
  }
  inspection.status = 'passed'; next.lot.status = 'accepted';
  return finish(next, command, 'incoming-sample-passed', String(inspection.measuredStrength));
}

export function approveLotRelease(state: IncomingState, command: Meta) {
  assert(command.actor.role === 'Quality Manager', 'Only quality managers can approve lot release.');
  const next = begin(state, command), inspection = currentInspection(next);
  assert(inspection.status === 'passed' && next.lot.status === 'accepted', 'Passing lot evidence is required.');
  assert(command.actor.id !== inspection.inspector && command.actor.id !== inspection.technician, 'Quality approval must be independent.');
  assertEvidenceCurrent(next);
  inspection.status = 'approved'; inspection.manager = command.actor.id;
  next.evidence.push({ id: `${command.id}-approval`, kind: 'quality-release', value: command.actor.id, immutable: true });
  return finish(next, command, 'incoming-lot-approved', next.lot.id);
}

export function releaseInventory(state: IncomingState, command: Meta) {
  assert(command.actor.role === 'Inventory Controller', 'Only inventory controllers can release stock.');
  const next = begin(state, command), inspection = currentInspection(next);
  assert(inspection.status === 'approved' && next.lot.status === 'accepted', 'Approved lot is required.');
  assertEvidenceCurrent(next);
  assert(next.inventory.quarantined >= next.lot.quantity, 'Quarantine quantity no longer covers the lot.');
  next.inventory.quarantined -= next.lot.quantity; next.inventory.usable += next.lot.quantity; next.inventory.version += 1;
  inspection.inventoryVersion = next.inventory.version; inspection.status = 'released'; next.lot.status = 'released';
  return finish(next, command, 'incoming-inventory-released', String(next.lot.quantity));
}

export class IncomingRepository {
  static key = 'forgeaxis:incoming-quality:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(IncomingRepository.key); return raw ? JSON.parse(raw) as IncomingState : structuredClone(initialIncomingState); }
  commit(expectedRevision: number, operation: (state: IncomingState) => IncomingState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed incoming quality. Refresh before retrying.'); const next = operation(current); this.storage.setItem(IncomingRepository.key, JSON.stringify(next)); return next; }
}

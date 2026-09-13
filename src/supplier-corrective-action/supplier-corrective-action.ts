export type ScarRole = 'Supplier Quality Engineer' | 'Supplier Representative' | 'Quality Manager' | 'Procurement Manager';
export interface ScarState {
  revision: number;
  supplier: { id: string; version: number; status: 'approved' | 'conditional' | 'suspended'; openActions: number };
  rejectedLot: { id: string; quantity: number; defect: string; version: number; status: 'quarantined' | 'rework-approved' | 'scrapped' };
  inventory: { sku: string; quarantined: number; rework: number; scrapped: number; version: number };
  action: null | { id: string; status: 'issued' | 'response-submitted' | 'effectiveness-verified' | 'closed'; supplierVersion: number; lotVersion: number; inventoryVersion: number; issuer: string; rootCause?: string; containment?: string; reviewer?: string; procurementApprover?: string; disposition?: 'rework' | 'scrap' };
  evidence: { id: string; kind: string; detail: string; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialScarState: ScarState = { revision: 0, supplier: { id: 'SUP-ALLOYWORKS', version: 8, status: 'approved', openActions: 0 }, rejectedLot: { id: 'LOT-AL-774', quantity: 180, defect: 'Tensile strength below specification', version: 5, status: 'quarantined' }, inventory: { sku: 'AL-6061-BAR', quarantined: 180, rework: 0, scrapped: 0, version: 11 }, action: null, evidence: [], events: [] };
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: ScarRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: ScarState, command: Meta) { assert(state.revision === command.expectedRevision, 'Corrective action changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: ScarState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentAction(state: ScarState) { assert(state.action, 'No supplier corrective action exists.'); return state.action; }
function assertCurrent(state: ScarState) { const action = currentAction(state); assert(action.supplierVersion === state.supplier.version, 'Supplier status changed after action issue.'); assert(action.lotVersion === state.rejectedLot.version, 'Rejected lot changed after action issue.'); assert(action.inventoryVersion === state.inventory.version, 'Quarantine inventory changed after action issue.'); }

export function issueCorrectiveAction(state: ScarState, command: Meta) {
  assert(command.actor.role === 'Supplier Quality Engineer', 'Only supplier quality engineers can issue corrective actions.');
  const next = begin(state, command);
  assert(!next.action && next.rejectedLot.status === 'quarantined', 'A quarantined rejected lot is required.');
  assert(next.inventory.quarantined >= next.rejectedLot.quantity, 'Quarantine does not cover the rejected lot.');
  next.supplier.status = 'conditional'; next.supplier.openActions += 1; next.supplier.version += 1;
  next.action = { id: `${command.id}-scar`, status: 'issued', supplierVersion: next.supplier.version, lotVersion: next.rejectedLot.version, inventoryVersion: next.inventory.version, issuer: command.actor.id };
  return finish(next, command, 'supplier-corrective-action-issued', next.supplier.id);
}

export function submitSupplierResponse(state: ScarState, command: Meta & { rootCause: string; containment: string }) {
  assert(command.actor.role === 'Supplier Representative', 'Only supplier representatives can submit responses.');
  const next = begin(state, command), action = currentAction(next);
  assert(action.status === 'issued', 'Issued supplier action is required.');
  assertCurrent(next);
  assert(command.rootCause.trim().length >= 20 && command.containment.trim().length >= 20, 'Root cause and containment require substantive evidence.');
  action.rootCause = command.rootCause.trim(); action.containment = command.containment.trim(); action.status = 'response-submitted';
  next.evidence.push({ id: `${command.id}-root`, kind: 'root-cause', detail: action.rootCause, immutable: true }, { id: `${command.id}-containment`, kind: 'containment', detail: action.containment, immutable: true });
  return finish(next, command, 'supplier-response-submitted', action.id);
}

export function verifyEffectiveness(state: ScarState, command: Meta & { passingSamples: number; requiredSamples: number }) {
  assert(command.actor.role === 'Quality Manager', 'Only quality managers can verify effectiveness.');
  const next = begin(state, command), action = currentAction(next);
  assert(action.status === 'response-submitted' && action.rootCause && action.containment, 'Complete supplier response is required.');
  assert(command.actor.id !== action.issuer, 'Effectiveness review must be independent.');
  assertCurrent(next);
  assert(command.requiredSamples >= 3 && command.passingSamples === command.requiredSamples, 'All required effectiveness samples must pass.');
  action.status = 'effectiveness-verified'; action.reviewer = command.actor.id;
  next.evidence.push({ id: `${command.id}-sample`, kind: 'effectiveness-sample', detail: `${String(command.passingSamples)}/${String(command.requiredSamples)}`, immutable: true });
  return finish(next, command, 'corrective-effectiveness-verified', String(command.passingSamples));
}

export function closeCorrectiveAction(state: ScarState, command: Meta & { disposition: 'rework' | 'scrap' }) {
  assert(command.actor.role === 'Procurement Manager', 'Only procurement managers can close supplier actions.');
  const next = begin(state, command), action = currentAction(next);
  assert(action.status === 'effectiveness-verified', 'Verified corrective action is required.');
  assert(command.actor.id !== action.reviewer && command.actor.id !== action.issuer, 'Corrective-action closure must be independent.');
  assertCurrent(next);
  next.inventory.quarantined -= next.rejectedLot.quantity;
  if (command.disposition === 'rework') { next.inventory.rework += next.rejectedLot.quantity; next.rejectedLot.status = 'rework-approved'; }
  else { next.inventory.scrapped += next.rejectedLot.quantity; next.rejectedLot.status = 'scrapped'; }
  next.inventory.version += 1; next.rejectedLot.version += 1; next.supplier.openActions -= 1; next.supplier.status = 'approved'; next.supplier.version += 1;
  action.inventoryVersion = next.inventory.version; action.lotVersion = next.rejectedLot.version; action.supplierVersion = next.supplier.version; action.disposition = command.disposition; action.procurementApprover = command.actor.id; action.status = 'closed';
  return finish(next, command, 'supplier-corrective-action-closed', command.disposition);
}

export class ScarRepository { static key = 'forgeaxis:supplier-corrective-action:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>; constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; } read() { const raw = this.storage.getItem(ScarRepository.key); return raw ? JSON.parse(raw) as ScarState : structuredClone(initialScarState); } commit(expectedRevision: number, operation: (state: ScarState) => ScarState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed corrective action. Refresh before retrying.'); const next = operation(current); this.storage.setItem(ScarRepository.key, JSON.stringify(next)); return next; } }

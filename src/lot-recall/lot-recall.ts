export type RecallRole = 'Quality Engineer' | 'Traceability Analyst' | 'Quality Director' | 'Inventory Controller' | 'Customer Safety Officer';
export type LotFilter = 'all' | 'affected' | 'shipped';
export interface RecallState {
  revision: number;
  queueVersion: number;
  traceFeedVersion: number;
  filter: LotFilter;
  selectedIds: string[];
  lots: { id: string; version: number; componentBatch: string; available: number; shipped: number; status: 'released' | 'recall-pending' | 'recalled' }[];
  shipments: { id: string; version: number; lotId: string; customerId: string; quantity: number; status: 'delivered' | 'recall-notified' | 'recall-acknowledged' }[];
  workOrders: { id: string; lotId: string; version: number; status: 'scheduled' | 'stopped' }[];
  recall: null | { id: string; status: 'draft' | 'approved' | 'contained' | 'notified' | 'acknowledged' | 'closed' | 'returns-reconciled' | 'disposition-pending' | 'finally-closed'; initiator: string; approver: string | null; lotIds: string[]; expectedLotVersions: Record<string, number>; expectedShipmentVersions: Record<string, number>; traceFeedVersion: number };
  inventory: { available: number; quarantine: number };
  notices: { id: string; customerId: string; shipmentId: string; quantity: number; immutable: true }[];
  acknowledgements: { id: string; shipmentId: string; reference: string; immutable: true }[];
  returns: { id: string; shipmentId: string; quantity: number; custodyReference: string; immutable: true }[];
  effectiveness: { id: string; customerPopulation: number; recoveredUnits: number; coveragePercent: number; immutable: true }[];
  dispositions: { id: string; destroyed: number; repaired: number; certificate: string; immutable: true }[];
  gapAssignments: { id: string; recallId: string; owner: string; dueOn: string; unrecoveredUnits: number; immutable: true }[];
  evidence: { id: string; kind: 'trace-refresh' | 'assessment' | 'containment' | 'notification' | 'acknowledgement' | 'closure' | 'return-reconciliation' | 'effectiveness' | 'final-disposition'; immutable: true }[];
  events: { id: string; action: string; actor: string; immutable: true }[];
}
export const initialRecallState: RecallState = {
  revision: 0,
  queueVersion: 24,
  traceFeedVersion: 10,
  filter: 'all',
  selectedIds: [],
  lots: [
    { id: 'LOT-VX-31', version: 5, componentBatch: 'SEAL-B88', available: 35, shipped: 25, status: 'released' },
    { id: 'LOT-VX-32', version: 7, componentBatch: 'SEAL-B88', available: 20, shipped: 20, status: 'released' },
    { id: 'LOT-VX-33', version: 3, componentBatch: 'SEAL-C02', available: 30, shipped: 0, status: 'released' },
  ],
  shipments: [
    { id: 'SHIP-501', version: 4, lotId: 'LOT-VX-31', customerId: 'CUSTOMER-A', quantity: 25, status: 'delivered' },
    { id: 'SHIP-502', version: 6, lotId: 'LOT-VX-32', customerId: 'CUSTOMER-B', quantity: 20, status: 'delivered' },
  ],
  workOrders: [{ id: 'WO-820', lotId: 'LOT-VX-31', version: 3, status: 'scheduled' }, { id: 'WO-821', lotId: 'LOT-VX-32', version: 2, status: 'scheduled' }],
  recall: null,
  inventory: { available: 85, quarantine: 0 },
  notices: [], acknowledgements: [], returns: [], effectiveness: [], dispositions: [], gapAssignments: [],
  evidence: [],
  events: [],
};
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: RecallRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: RecallState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Recall queue changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Recall command already applied.');
  return structuredClone(state);
}
function finish(state: RecallState, command: Meta, action: string) {
  state.revision += 1;
  state.queueVersion += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true });
  return state;
}
export function visibleRecallLots(state: RecallState) {
  if (state.filter === 'affected') return state.lots.filter((lot) => lot.componentBatch === 'SEAL-B88' && lot.status === 'released');
  if (state.filter === 'shipped') return state.lots.filter((lot) => lot.shipped > 0 && lot.status === 'released');
  return state.lots;
}
export function changeRecallFilter(state: RecallState, command: Meta & { filter: LotFilter }) {
  const next = begin(state, command);
  next.filter = command.filter;
  const visible = new Set(visibleRecallLots(next).map((lot) => lot.id));
  next.selectedIds = next.selectedIds.filter((id) => visible.has(id));
  return finish(next, command, 'recall-filter-changed');
}
export function toggleRecallLot(state: RecallState, command: Meta & { lotId: string }) {
  assert(command.actor.role === 'Quality Engineer', 'Only quality engineers can select recall lots.');
  const next = begin(state, command);
  assert(visibleRecallLots(next).some((lot) => lot.id === command.lotId), 'Only visible lots can be selected.');
  next.selectedIds = next.selectedIds.includes(command.lotId) ? next.selectedIds.filter((id) => id !== command.lotId) : [...next.selectedIds, command.lotId];
  return finish(next, command, 'recall-lot-selection-changed');
}
export function applyTraceRefresh(state: RecallState, command: Meta & { capturedQueueVersion: number; responseVersion: number; lotVersions: Record<string, number>; shipmentVersions: Record<string, number> }) {
  assert(command.actor.role === 'Traceability Analyst', 'Only traceability analysts can refresh shipment trace.');
  const next = begin(state, command);
  assert(command.capturedQueueVersion === state.queueVersion, 'Recall queue changed while trace data was loading. Retry refresh.');
  assert(command.responseVersion > next.traceFeedVersion, 'Stale trace response ignored.');
  for (const lot of next.lots) assert(command.lotVersions[lot.id] === lot.version, `Lot ${lot.id} changed before trace refresh.`);
  for (const shipment of next.shipments) assert(command.shipmentVersions[shipment.id] === shipment.version, `Shipment ${shipment.id} changed before trace refresh.`);
  next.traceFeedVersion = command.responseVersion;
  next.evidence.push({ id: `${command.id}-trace`, kind: 'trace-refresh', immutable: true });
  return finish(next, command, 'recall-trace-refreshed');
}
export function createLotRecall(state: RecallState, command: Meta & { expectedLotVersions: Record<string, number>; expectedShipmentVersions: Record<string, number> }) {
  assert(command.actor.role === 'Quality Engineer', 'Only quality engineers can create recalls.');
  const next = begin(state, command);
  assert(!next.recall && next.traceFeedVersion === 11, 'Fresh trace data without an active recall is required.');
  assert(next.selectedIds.length === 2, 'Select exactly two affected lots.');
  const lots = next.selectedIds.map((id) => next.lots.find((lot) => lot.id === id));
  assert(lots.every((lot) => lot), 'A selected lot no longer exists.');
  const selected = lots as RecallState['lots'];
  const primary = selected[0];
  assert(primary, 'A primary recall lot is required.');
  assert(selected.every((lot) => lot.status === 'released' && lot.componentBatch === primary.componentBatch), 'Recall lots must share the affected component batch.');
  for (const lot of selected) assert(command.expectedLotVersions[lot.id] === lot.version, `Lot ${lot.id} changed before recall assessment.`);
  const affectedShipments = next.shipments.filter((shipment) => next.selectedIds.includes(shipment.lotId));
  assert(affectedShipments.length === 2, 'Every shipped recall lot requires traceable shipment custody.');
  for (const shipment of affectedShipments) assert(command.expectedShipmentVersions[shipment.id] === shipment.version, `Shipment ${shipment.id} changed before recall assessment.`);
  for (const lot of selected) { lot.status = 'recall-pending'; lot.version += 1; }
  next.recall = { id: 'RECALL-SEAL-B88', status: 'draft', initiator: command.actor.id, approver: null, lotIds: next.selectedIds, expectedLotVersions: Object.fromEntries(selected.map((lot) => [lot.id, lot.version])), expectedShipmentVersions: command.expectedShipmentVersions, traceFeedVersion: next.traceFeedVersion };
  next.evidence.push({ id: `${command.id}-assessment`, kind: 'assessment', immutable: true });
  return finish(next, command, 'lot-recall-created');
}
export function approveLotRecall(state: RecallState, command: Meta) {
  assert(command.actor.role === 'Quality Director', 'Only quality directors can approve recalls.');
  const next = begin(state, command);
  assert(next.recall?.status === 'draft' && next.recall.initiator !== command.actor.id, 'Independent approval of a draft recall is required.');
  assert(next.recall.traceFeedVersion === next.traceFeedVersion, 'Trace data became stale before recall approval.');
  next.recall.approver = command.actor.id;
  next.recall.status = 'approved';
  return finish(next, command, 'lot-recall-approved');
}
export function containRecalledLots(state: RecallState, command: Meta) {
  assert(command.actor.role === 'Inventory Controller', 'Only inventory controllers can contain recalled lots.');
  const next = begin(state, command);
  assert(next.recall?.status === 'approved' && next.recall.approver, 'An independently approved recall is required.');
  let quarantined = 0;
  for (const id of next.recall.lotIds) {
    const lot = next.lots.find((item) => item.id === id);
    assert(lot, `Lot ${id} no longer exists.`);
    assert(lot.version === next.recall.expectedLotVersions[id] && lot.status === 'recall-pending', `Lot ${id} became stale before containment.`);
    lot.status = 'recalled'; lot.version += 1; quarantined += lot.available;
    const order = next.workOrders.find((item) => item.lotId === id);
    assert(order, `Work order for ${id} is missing.`);
    order.status = 'stopped'; order.version += 1;
  }
  next.inventory.available -= quarantined;
  next.inventory.quarantine += quarantined;
  next.recall.status = 'contained';
  next.evidence.push({ id: `${command.id}-containment`, kind: 'containment', immutable: true });
  return finish(next, command, 'recalled-lots-contained');
}
export function notifyRecallCustomers(state: RecallState, command: Meta) {
  assert(command.actor.role === 'Customer Safety Officer', 'Only customer safety officers can notify recall customers.');
  const next = begin(state, command);
  assert(next.recall?.status === 'contained', 'Contained recall inventory is required before notification.');
  const shipments = next.shipments.filter((shipment) => next.recall?.lotIds.includes(shipment.lotId));
  for (const shipment of shipments) {
    assert(shipment.version === next.recall.expectedShipmentVersions[shipment.id] && shipment.status === 'delivered', `Shipment ${shipment.id} became stale before notification.`);
    shipment.status = 'recall-notified'; shipment.version += 1;
    next.notices.push({ id: `${command.id}-${shipment.id}`, customerId: shipment.customerId, shipmentId: shipment.id, quantity: shipment.quantity, immutable: true });
  }
  next.recall.status = 'notified';
  next.selectedIds = [];
  next.evidence.push({ id: `${command.id}-notification`, kind: 'notification', immutable: true });
  return finish(next, command, 'recall-customers-notified');
}
export function recordRecallAcknowledgements(state: RecallState, command: Meta & { references: Record<string, string> }) {
  assert(command.actor.role === 'Customer Safety Officer', 'Only customer safety officers can record acknowledgements.');
  const next = begin(state, command); assert(next.recall?.status === 'notified', 'Notified recall is required.');
  const shipments = next.shipments.filter((shipment) => next.recall?.lotIds.includes(shipment.lotId));
  for (const shipment of shipments) { const reference = command.references[shipment.id]?.trim(); assert(reference && reference.length >= 8, `Customer acknowledgement for ${shipment.id} is required.`); assert(shipment.status === 'recall-notified', `Shipment ${shipment.id} is not awaiting acknowledgement.`); shipment.status = 'recall-acknowledged'; shipment.version += 1; next.acknowledgements.push({ id: `${command.id}-${shipment.id}`, shipmentId: shipment.id, reference, immutable: true }); }
  next.recall.status = 'acknowledged'; next.evidence.push({ id: `${command.id}-acknowledgement`, kind: 'acknowledgement', immutable: true }); return finish(next, command, 'recall-customers-acknowledged');
}
export function closeLotRecall(state: RecallState, command: Meta) { assert(command.actor.role === 'Quality Director', 'Only quality directors can close recalls.'); const next = begin(state, command); assert(next.recall?.status === 'acknowledged' && next.acknowledgements.length === next.notices.length, 'Every recall notice requires acknowledgement before closure.'); assert(next.recall.approver === command.actor.id, 'The approving quality director must close the recall.'); next.recall.status = 'closed'; next.evidence.push({ id: `${command.id}-closure`, kind: 'closure', immutable: true }); return finish(next, command, 'lot-recall-closed'); }
export function recallRecoveryOverview(state: RecallState, asOf: string) { const notifiedUnits=state.notices.reduce((sum,item)=>sum+item.quantity,0), recoveredUnits=state.returns.reduce((sum,item)=>sum+item.quantity,0), assignment=state.gapAssignments.at(-1); return { notifiedUnits, recoveredUnits, unrecoveredUnits:notifiedUnits-recoveredUnits, coveragePercent:notifiedUnits ? Math.round(recoveredUnits/notifiedUnits*100) : 0, owner:assignment?.owner ?? 'Unassigned', dueOn:assignment?.dueOn ?? null, overdue:Boolean(assignment && assignment.dueOn < asOf && notifiedUnits > recoveredUnits), shipmentIds:state.notices.map(item=>item.shipmentId) }; }
export function assignRecallRecovery(state: RecallState, command: Meta & { owner: string; dueOn: string }) { assert(command.actor.role === 'Quality Director', 'Only quality directors can assign recall recovery.'); const next=begin(state,command); assert(next.recall?.status==='closed','Closed recall is required before recovery assignment.'); const overview=recallRecoveryOverview(next,command.dueOn); assert(overview.unrecoveredUnits>0,'No unrecovered recall units require assignment.'); assert(command.owner.trim().length>=4,'A responsible recovery owner is required.'); assert(!next.gapAssignments.some(item=>item.recallId===next.recall?.id),'Recall recovery is already assigned.'); next.gapAssignments.push({id:`${command.id}-assignment`,recallId:next.recall.id,owner:command.owner.trim(),dueOn:command.dueOn,unrecoveredUnits:overview.unrecoveredUnits,immutable:true}); return finish(next,command,'recall-recovery-assigned'); }
export function reconcileRecalledReturns(state: RecallState, command: Meta & { returns: { shipmentId: string; quantity: number; custodyReference: string }[] }) { assert(command.actor.role === 'Inventory Controller', 'Only inventory controllers can reconcile recalled returns.'); const next = begin(state, command); assert(next.recall?.status === 'closed', 'Closed recall is required before physical return reconciliation.'); const shipments = next.shipments.filter((shipment) => next.recall?.lotIds.includes(shipment.lotId)); assert(command.returns.length === shipments.length, 'Every recalled shipment requires a return record.'); const returned = command.returns.map((item) => { const shipment = shipments.find((candidate) => candidate.id === item.shipmentId); assert(shipment?.quantity === item.quantity, `Returned quantity for ${item.shipmentId} must match the recalled shipment.`); assert(/^CUST-[A-Z0-9-]{8,}$/.test(item.custodyReference), `Valid custody reference for ${item.shipmentId} is required.`); return { id: `${command.id}-${item.shipmentId}`, ...item, immutable: true as const }; }); assert(new Set(returned.map((item) => item.shipmentId)).size === shipments.length, 'Each recalled shipment must be reconciled exactly once.'); next.returns.push(...returned); next.inventory.quarantine += returned.reduce((total, item) => total + item.quantity, 0); next.recall.status = 'returns-reconciled'; next.evidence.push({ id: `${command.id}-returns`, kind: 'return-reconciliation', immutable: true }); return finish(next, command, 'recalled-returns-reconciled'); }
export function assessRecallEffectiveness(state: RecallState, command: Meta & { customerPopulation: number }) { assert(command.actor.role === 'Customer Safety Officer', 'Only customer safety officers can assess recall effectiveness.'); const next = begin(state, command), recall = next.recall; assert(recall?.status === 'returns-reconciled', 'Reconciled recall returns are required before effectiveness review.'); const notifiedUnits = next.notices.reduce((total, notice) => total + notice.quantity, 0); const recoveredUnits = next.returns.reduce((total, item) => total + item.quantity, 0); assert(command.customerPopulation === notifiedUnits, 'Effectiveness population must match immutable customer notices.'); assert(recoveredUnits === command.customerPopulation, 'Every notified customer unit must be recovered before final disposition.'); next.effectiveness.push({ id: `${command.id}-effectiveness`, customerPopulation: command.customerPopulation, recoveredUnits, coveragePercent: 100, immutable: true }); recall.status = 'disposition-pending'; next.evidence.push({ id: `${command.id}-effectiveness-evidence`, kind: 'effectiveness', immutable: true }); return finish(next, command, 'recall-effectiveness-confirmed'); }
export function disposeRecalledInventory(state: RecallState, command: Meta & { destroyed: number; repaired: number; certificate: string }) { assert(command.actor.role === 'Quality Director', 'Only quality directors can authorize final recall disposition.'); const next = begin(state, command), recall = next.recall, effectiveness = next.effectiveness.at(-1); assert(recall?.status === 'disposition-pending' && effectiveness?.coveragePercent === 100, 'Complete recall effectiveness evidence is required.'); assert(recall.approver === command.actor.id, 'The approving quality director must authorize final disposition.'); assert(Number.isInteger(command.destroyed) && Number.isInteger(command.repaired) && command.destroyed >= 0 && command.repaired >= 0 && command.destroyed + command.repaired === next.inventory.quarantine, 'Disposition quantities must reconcile all quarantined units.'); assert(/^DISP-B88-[0-9]{3}$/.test(command.certificate), 'Valid final disposition certificate is required.'); next.dispositions.push({ id: `${command.id}-disposition`, destroyed: command.destroyed, repaired: command.repaired, certificate: command.certificate, immutable: true }); next.inventory.quarantine = 0; next.inventory.available += command.repaired; recall.status = 'finally-closed'; next.evidence.push({ id: `${command.id}-disposition-evidence`, kind: 'final-disposition', immutable: true }); return finish(next, command, 'recall-final-disposition-recorded'); }
export class LotRecallRepository {
  static key = 'forgeaxis:lot-recall:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(LotRecallRepository.key); return raw ? JSON.parse(raw) as RecallState : structuredClone(initialRecallState); }
  commit(expectedRevision: number, operation: (state: RecallState) => RecallState) { const state = this.read(); assert(state.revision === expectedRevision, 'Another session changed lot recall. Refresh before retrying.'); const next = operation(state); this.storage.setItem(LotRecallRepository.key, JSON.stringify(next)); return next; }
}

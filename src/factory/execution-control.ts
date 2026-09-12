export type FactoryRole = 'Supervisor' | 'Operator' | 'Quality Engineer' | 'Auditor';
export interface FactoryActor { id: string; role: FactoryRole }
export interface ShiftHandoff { id: string; line: string; outgoing: string; incoming: string; note: string; status: 'awaiting-relief' | 'closed'; revision: number }
export interface MaterialAllocation { id: string; orderId: string; lotId: string; kilograms: number; requestedBy: string; releasedBy?: string; status: 'reserved' | 'released' | 'consumed'; revision: number }
export interface GenealogyRecord { id: string; orderId: string; inputLotId: string; outputLotId: string; quantity: number; verifiedBy: string; at: string }
export interface FactoryEvent { id: string; action: string; actor: string; at: string; entityId: string; detail: string }
export interface FactoryExecutionState {
    revision: number;
    lotBalances: Record<string, number>;
    handoffs: ShiftHandoff[];
    allocations: MaterialAllocation[];
    genealogy: GenealogyRecord[];
    events: FactoryEvent[];
}

export const initialFactoryExecution: FactoryExecutionState = {
    revision: 0, lotBalances: { 'lot-1': 1000 }, handoffs: [], allocations: [], genealogy: [], events: [],
};

interface CommandMeta { id: string; expectedRevision: number; actor: FactoryActor; at: string }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const note = (value: string, label: string) => { const clean = value.trim(); assert(clean.length >= 20, label + ' must contain at least 20 characters.'); return clean; };
function begin(state: FactoryExecutionState, command: CommandMeta) {
    assert(state.revision === command.expectedRevision, 'Factory execution changed. Refresh before retrying.');
    assert(command.id.trim().length > 0 && Number.isFinite(Date.parse(command.at)), 'Command identity and timestamp are required.');
    assert(!state.events.some(event => event.id === command.id), 'Command identifier was already used.');
    return structuredClone(state);
}
function finish(state: FactoryExecutionState, command: CommandMeta, action: string, entityId: string, detail: string) {
    state.revision++;
    state.events.push({ id: command.id, action, actor: command.actor.id, at: command.at, entityId, detail });
    return state;
}

export function requestShiftHandoff(state: FactoryExecutionState, command: CommandMeta & { line: string; incoming: string; handoffNote: string }) {
    assert(command.actor.role === 'Operator', 'Only an operator can request shift relief.');
    const next = begin(state, command);
    assert(!next.handoffs.some(item => item.line === command.line && item.status === 'awaiting-relief'), 'This line already has a pending handoff.');
    const handoff: ShiftHandoff = { id: command.id + '-handoff', line: command.line.trim(), outgoing: command.actor.id,
        incoming: command.incoming.trim(), note: note(command.handoffNote, 'Handoff note'), status: 'awaiting-relief', revision: 1 };
    assert(handoff.line.length >= 3 && handoff.incoming.length > 0 && handoff.incoming !== command.actor.id, 'Choose a line and a different incoming operator.');
    next.handoffs.push(handoff);
    return finish(next, command, 'shift-handoff-requested', handoff.id, handoff.note);
}

export function acceptShiftHandoff(state: FactoryExecutionState, command: CommandMeta & { handoffId: string; acceptanceNote: string }) {
    assert(command.actor.role === 'Operator', 'Only an operator can accept shift relief.');
    const next = begin(state, command), handoff = next.handoffs.find(item => item.id === command.handoffId);
    assert(handoff?.status === 'awaiting-relief', 'Shift handoff is no longer pending.');
    assert(handoff.incoming === command.actor.id && handoff.outgoing !== command.actor.id, 'Only the assigned relief operator can accept this handoff.');
    handoff.status = 'closed'; handoff.revision++;
    return finish(next, command, 'shift-handoff-accepted', handoff.id, note(command.acceptanceNote, 'Acceptance note'));
}

export function reserveMaterial(state: FactoryExecutionState, command: CommandMeta & { orderId: string; lotId: string; kilograms: number }) {
    assert(command.actor.role === 'Supervisor', 'Only a supervisor can reserve production material.');
    const next = begin(state, command), available = next.lotBalances[command.lotId];
    assert(Number.isSafeInteger(command.kilograms) && command.kilograms > 0, 'Reservation quantity must be a positive whole number.');
    assert(available !== undefined && available >= command.kilograms, 'Released lot balance is insufficient.');
    assert(!next.allocations.some(item => item.orderId === command.orderId && item.status !== 'consumed'), 'This order already has an active material allocation.');
    const allocation: MaterialAllocation = { id: command.id + '-allocation', orderId: command.orderId, lotId: command.lotId,
        kilograms: command.kilograms, requestedBy: command.actor.id, status: 'reserved', revision: 1 };
    next.lotBalances[command.lotId] = available - command.kilograms;
    next.allocations.push(allocation);
    return finish(next, command, 'material-reserved', allocation.id, String(command.kilograms) + ' kg reserved');
}

export function releaseMaterial(state: FactoryExecutionState, command: CommandMeta & { allocationId: string }) {
    assert(command.actor.role === 'Operator', 'Only an operator can acknowledge staged material.');
    const next = begin(state, command), allocation = next.allocations.find(item => item.id === command.allocationId);
    assert(allocation?.status === 'reserved', 'Material allocation is no longer awaiting release.');
    assert(allocation.requestedBy !== command.actor.id, 'Material staging requires a second actor.');
    allocation.status = 'released'; allocation.releasedBy = command.actor.id; allocation.revision++;
    return finish(next, command, 'material-released', allocation.id, 'Staged material accepted by production');
}

export function consumeMaterial(state: FactoryExecutionState, command: CommandMeta & { allocationId: string }) {
    assert(command.actor.role === 'Operator', 'Only an operator can record material consumption.');
    const next = begin(state, command), allocation = next.allocations.find(item => item.id === command.allocationId);
    assert(allocation?.status === 'released', 'Only released material can be consumed.');
    assert(allocation.releasedBy === command.actor.id, 'The receiving operator must record consumption.');
    allocation.status = 'consumed'; allocation.revision++;
    return finish(next, command, 'material-consumed', allocation.id, 'Allocation consumed by completed production');
}

export function recordLotGenealogy(state: FactoryExecutionState, command: CommandMeta & { allocationId: string; outputLotId: string; quantity: number }) {
    assert(command.actor.role === 'Quality Engineer', 'Quality must verify output genealogy.');
    const next = begin(state, command), allocation = next.allocations.find(item => item.id === command.allocationId);
    assert(allocation?.status === 'consumed', 'Complete material consumption before genealogy verification.');
    assert(!next.genealogy.some(item => item.orderId === allocation.orderId), 'Genealogy is already recorded for this order.');
    assert(command.outputLotId.trim().length >= 4 && command.outputLotId !== allocation.lotId, 'Provide a distinct output lot identifier.');
    assert(Number.isSafeInteger(command.quantity) && command.quantity > 0, 'Output quantity must be a positive whole number.');
    const record: GenealogyRecord = { id: command.id + '-genealogy', orderId: allocation.orderId, inputLotId: allocation.lotId,
        outputLotId: command.outputLotId.trim(), quantity: command.quantity, verifiedBy: command.actor.id, at: command.at };
    next.genealogy.push(record);
    return finish(next, command, 'genealogy-recorded', record.id, record.inputLotId + ' -> ' + record.outputLotId);
}

export class FactoryExecutionRepository {
    static readonly key = 'forgeaxis:factory-execution:v1';
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
    constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
    read(): FactoryExecutionState {
        const raw = this.storage.getItem(FactoryExecutionRepository.key);
        if (!raw) return structuredClone(initialFactoryExecution);
        const parsed = JSON.parse(raw) as FactoryExecutionState;
        assert(Number.isSafeInteger(parsed.revision) && Array.isArray(parsed.events), 'Stored factory execution is invalid.');
        return parsed;
    }
    commit(expectedRevision: number, change: (state: FactoryExecutionState) => FactoryExecutionState) {
        const current = this.read();
        assert(current.revision === expectedRevision, 'Another session changed factory execution. Refresh before retrying.');
        const next = change(current);
        this.storage.setItem(FactoryExecutionRepository.key, JSON.stringify(next));
        return next;
    }
}

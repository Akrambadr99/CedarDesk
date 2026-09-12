export type MachineState = 'running' | 'starved' | 'blocked' | 'faulted' | 'maintenance';
export type FactoryRole = 'Operator' | 'Supervisor' | 'Quality Engineer' | 'Maintenance Engineer';
export interface MachineEvent {
    id: string;
    machineId: string;
    state: MachineState;
    startedAt: string;
    endedAt?: string;
    reason: string;
}
export interface CountEvent {
    id: string;
    orderId: string;
    at: string;
    good: number;
    scrap: number;
    source: 'sensor' | 'operator';
}
export interface QualityGate {
    id: string;
    orderId: string;
    name: string;
    required: boolean;
    result: 'pending' | 'passed' | 'failed';
}
export interface WorkOrder {
    id: string;
    product: string;
    target: number;
    dueAt: string;
    materialAvailable: number;
    unitMaterial: number;
    status: 'queued' | 'running' | 'held' | 'complete';
}
const at = (value: string) => new Date(value).getTime();
export function intervalsOverlap(a: MachineEvent, b: MachineEvent): boolean { const aEnd = a.endedAt ? at(a.endedAt) : Infinity; const bEnd = b.endedAt ? at(b.endedAt) : Infinity; return at(a.startedAt) < bEnd && at(b.startedAt) < aEnd; }
export function appendMachineEvent(events: MachineEvent[], next: MachineEvent): MachineEvent[] {
    if (events.some((event) => event.machineId === next.machineId && intervalsOverlap(event, next)))
        throw new Error('Machine events cannot overlap on the operating timeline.');
    return [...events, next].sort((a, b) => at(a.startedAt) - at(b.startedAt));
}
export function productionTotals(events: CountEvent[], orderId: string) { return events.filter((e) => e.orderId === orderId).reduce((totals, e) => ({ good: totals.good + e.good, scrap: totals.scrap + e.scrap }), { good: 0, scrap: 0 }); }
export function canStartOrder(order: WorkOrder, role: FactoryRole): {
    allowed: boolean;
    reason?: string;
} {
    if (!['Operator', 'Supervisor'].includes(role))
        return { allowed: false, reason: 'Only operations staff can release a work order.' };
    if (order.materialAvailable < order.target * order.unitMaterial)
        return { allowed: false, reason: 'Material staging is below the production requirement.' };
    return { allowed: true };
}
export function completeOrder(order: WorkOrder, gates: QualityGate[], events: CountEvent[]): WorkOrder {
    const unresolved = gates.filter((g) => g.orderId === order.id && g.required && g.result !== 'passed');
    if (unresolved.length)
        throw new Error('Mandatory quality gates must pass before batch completion.');
    if (productionTotals(events, order.id).good < order.target)
        throw new Error('Good production count has not reached the work-order target.');
    return { ...order, status: 'complete' };
}
export function oee(availability: number, performance: number, quality: number) { return Math.round(availability * performance * quality * 1000) / 10; }

export interface ScheduledOrder {
    id: string;
    lineId: string;
    startsAt: string;
    endsAt: string;
    changeoverFamily: string;
    priority: number;
}
const time = (value: string) => new Date(value).getTime();
export function scheduleConflicts(orders: ScheduledOrder[]): [
    string,
    string
][] {
    const conflicts: [
        string,
        string
    ][] = [];
    for (const [first, a] of orders.entries()) {
        for (const b of orders.slice(first + 1)) {
            if (a.lineId === b.lineId && time(a.startsAt) < time(b.endsAt) && time(b.startsAt) < time(a.endsAt))
                conflicts.push([a.id, b.id]);
        }
    }
    return conflicts;
}
export function sequenceOrders(orders: ScheduledOrder[]): ScheduledOrder[] {
    return [...orders].sort((a, b) => b.priority - a.priority || a.changeoverFamily.localeCompare(b.changeoverFamily) || time(a.startsAt) - time(b.startsAt));
}
export function changeoverMinutes(orders: ScheduledOrder[], standardMinutes: number): number {
    return orders.slice(1).reduce((sum, order, index) => sum + (orders[index]?.changeoverFamily === order.changeoverFamily ? 0 : standardMinutes), 0);
}

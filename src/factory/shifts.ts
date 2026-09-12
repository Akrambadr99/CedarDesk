import type { CountEvent, MachineEvent } from './production';
export interface Shift {
    id: string;
    startsAt: string;
    endsAt: string;
    crew: string;
}
export interface ShiftSummary {
    shiftId: string;
    good: number;
    scrap: number;
    downtimeMinutes: number;
}
const time = (value: string) => new Date(value).getTime();
export function summarizeShift(shift: Shift, counts: CountEvent[], states: MachineEvent[]): ShiftSummary {
    const inShift = (at: string) => time(at) >= time(shift.startsAt) && time(at) < time(shift.endsAt);
    const production = counts.filter((event) => inShift(event.at)).reduce((sum, event) => ({ good: sum.good + event.good, scrap: sum.scrap + event.scrap }), { good: 0, scrap: 0 });
    const downtimeMinutes = states.filter((event) => event.state !== 'running').reduce((sum, event) => {
        const start = Math.max(time(event.startedAt), time(shift.startsAt));
        const end = Math.min(event.endedAt ? time(event.endedAt) : time(shift.endsAt), time(shift.endsAt));
        return sum + Math.max(0, Math.round((end - start) / 60000));
    }, 0);
    return { shiftId: shift.id, ...production, downtimeMinutes };
}

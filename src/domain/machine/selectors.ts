import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isMachine } from './model';
export function selectMachine(records: readonly Entity[]): Entity[] { return records.filter(isMachine).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findMachine(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isMachine(record) && record.id === id); }
export function searchMachine(records: readonly Entity[], query: string): Entity[] { return selectMachine(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countMachineByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectMachine(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}

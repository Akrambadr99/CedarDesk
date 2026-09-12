import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isMaintenance } from './model';
export function selectMaintenance(records: readonly Entity[]): Entity[] { return records.filter(isMaintenance).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findMaintenance(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isMaintenance(record) && record.id === id); }
export function searchMaintenance(records: readonly Entity[], query: string): Entity[] { return selectMaintenance(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countMaintenanceByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectMaintenance(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}

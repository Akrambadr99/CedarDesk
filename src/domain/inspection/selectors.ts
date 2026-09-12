import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isInspection } from './model';
export function selectInspection(records: readonly Entity[]): Entity[] { return records.filter(isInspection).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findInspection(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isInspection(record) && record.id === id); }
export function searchInspection(records: readonly Entity[], query: string): Entity[] { return selectInspection(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countInspectionByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectInspection(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}

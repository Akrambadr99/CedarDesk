import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isOrder } from './model';
export function selectOrder(records: readonly Entity[]): Entity[] { return records.filter(isOrder).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findOrder(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isOrder(record) && record.id === id); }
export function searchOrder(records: readonly Entity[], query: string): Entity[] { return selectOrder(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countOrderByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectOrder(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}

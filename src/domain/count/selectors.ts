import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isCount } from './model';
export function selectCount(records: readonly Entity[]): Entity[] { return records.filter(isCount).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findCount(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isCount(record) && record.id === id); }
export function searchCount(records: readonly Entity[], query: string): Entity[] { return selectCount(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countCountByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectCount(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}

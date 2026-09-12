import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isLot } from './model';
export function selectLot(records: readonly Entity[]): Entity[] { return records.filter(isLot).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findLot(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isLot(record) && record.id === id); }
export function searchLot(records: readonly Entity[], query: string): Entity[] { return selectLot(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countLotByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectLot(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}

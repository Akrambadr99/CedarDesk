import type { Entity } from '../../workspace/types';
export type LotRecord = Entity & {
    kind: 'lot';
};
export function isLot(record: Entity): record is LotRecord { return record.kind === 'lot'; }
